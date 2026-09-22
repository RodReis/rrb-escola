"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { createServerClient } from "@/lib/supabase/server";
import { formText } from "@/lib/utils";
import type { ActionResult } from "@/lib/actions/types";
import { getAliasesIsaac, getAlunosParaCasamento } from "@/lib/data/isaac";
import { lerAnalitico, lerResumo } from "@/lib/isaac/ler-arquivos";
import { prepararImportacao, type Divergencia, type PreparoImportacao } from "@/lib/isaac/preparar-importacao";
import { validarAnalitico } from "@/lib/isaac/parse-analitico";
import { validarResumo } from "@/lib/isaac/parse-resumo";

const BUCKET = "isaac-repasses";

export type PreviaImportacao = {
  unidadeId: string;
  unidadeNome: string;
  competenciaRepasse: string;
  dataRepasse: string;
  totais: {
    mensalidades: number;
    mudancas: number;
    base: number;
    taxa: number;
    final: number;
    totalResumo: number;
  };
  transferencias: Array<{ data: string; valor: number }>;
  linhas: Array<{ grupo: string; tipo: string; valor: number }>;
  contagens: PreparoImportacao["resumoContagens"];
  bloqueios: Divergencia[];
  avisos: Divergencia[];
  pendencias: Array<{ idParcela: string; nomeIsaac: string; produto: string; valorBase: number; motivo: string }>;
  /** Payload pronto para a RPC. Volta para o cliente e reenviado na confirmação. */
  payload: Record<string, unknown>;
};

function nomeSeguro(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-");
}

function ehXlsx(file: File): boolean {
  return file.name.toLowerCase().endsWith(".xlsx");
}

function ehPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function mensagemDeErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : "Não foi possível ler os arquivos.";
}

/**
 * Passo 1: sobe os dois arquivos, parseia, casa alunos e monta a prévia.
 * NÃO grava nada no repasse — quem grava é `confirmarImportacaoIsaacAction`,
 * depois que alguém olhou a prévia.
 */
export async function analisarRepasseIsaacAction(
  formData: FormData,
): Promise<ActionResult<PreviaImportacao>> {
  await requirePermission("financeiro.isaac", "create");

  const unidadeId = formText(formData, "unidade_id");
  const dataRepasse = formText(formData, "data_repasse");
  const analiticoFile = formData.get("analitico");
  const resumoFile = formData.get("resumo");

  if (!unidadeId) return { ok: false, error: "Escolha a unidade isaac." };
  if (!(analiticoFile instanceof File) || analiticoFile.size === 0) {
    return { ok: false, error: "Envie o analítico .xlsx." };
  }
  if (!(resumoFile instanceof File) || resumoFile.size === 0) {
    return { ok: false, error: "Envie o resumo .pdf." };
  }
  if (!ehXlsx(analiticoFile)) return { ok: false, error: "O analítico precisa ser um arquivo .xlsx." };
  if (!ehPdf(resumoFile)) return { ok: false, error: "O resumo precisa ser um arquivo .pdf." };

  const supabase = await createServerClient();

  const { data: unidade, error: erroUnidade } = await supabase
    .from("isaac_unidade")
    .select("id, nome_isaac, company_id")
    .eq("id", unidadeId)
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .single();

  if (erroUnidade || !unidade) return { ok: false, error: "Unidade isaac não encontrada." };

  let analitico;
  let resumo;
  try {
    const [bytesAnalitico, bytesResumo] = await Promise.all([
      analiticoFile.arrayBuffer().then((b) => Buffer.from(b)),
      resumoFile.arrayBuffer().then((b) => Buffer.from(b)),
    ]);
    [analitico, resumo] = await Promise.all([lerAnalitico(bytesAnalitico), lerResumo(bytesResumo)]);
  } catch (erro) {
    // Erro de layout do arquivo é informação para quem importou, não stack
    // trace: os parsers já lançam mensagem dizendo qual coluna ou rótulo faltou.
    return { ok: false, error: mensagemDeErro(erro) };
  }

  // Coerência interna de cada arquivo, antes de compará-los entre si.
  const problemasArquivo = [
    ...validarAnalitico(analitico).map((d) => `Analítico: ${d.o_que} (esperado ${d.esperado}, obtido ${d.obtido})`),
    ...validarResumo(resumo).map((d) => `Resumo: ${d.o_que} (esperado ${d.esperado}, obtido ${d.obtido})`),
  ];
  if (problemasArquivo.length > 0) {
    return { ok: false, error: problemasArquivo.join(" | ") };
  }

  const [alunos, aliases] = await Promise.all([getAlunosParaCasamento(), getAliasesIsaac()]);
  const preparo = prepararImportacao(analitico, resumo, alunos, aliases);

  // Os arquivos sobem mesmo que a prévia tenha bloqueio: eles são a evidência
  // de que o problema existia, e o caminho já vai no payload da confirmação.
  const carimbo = Date.now();
  const base = `${resumo.competencia}/${carimbo}`;
  const pathAnalitico = `${base}-${nomeSeguro(analiticoFile.name)}`;
  const pathResumo = `${base}-${nomeSeguro(resumoFile.name)}`;

  const [upAnalitico, upResumo] = await Promise.all([
    supabase.storage.from(BUCKET).upload(pathAnalitico, Buffer.from(await analiticoFile.arrayBuffer()), {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: false,
    }),
    supabase.storage.from(BUCKET).upload(pathResumo, Buffer.from(await resumoFile.arrayBuffer()), {
      contentType: "application/pdf",
      upsert: false,
    }),
  ]);
  if (upAnalitico.error) return { ok: false, error: `Falha ao guardar o analítico: ${upAnalitico.error.message}` };
  if (upResumo.error) return { ok: false, error: `Falha ao guardar o resumo: ${upResumo.error.message}` };

  const totalResumo = resumo.total;
  const payload: Record<string, unknown> = {
    unidade_id: unidade.id,
    competencia_repasse: resumo.competencia,
    data_repasse: dataRepasse || resumo.transferencias[0]?.data || `${resumo.competencia}-05`,
    bruto: analitico.totais.mensalidades,
    ajustes: analitico.totais.mudancas,
    base: analitico.totais.base,
    taxa: analitico.totais.taxa,
    liquido: totalResumo,
    alunos_informados: resumo.alunosInformados,
    cobrancas_informadas: resumo.cobrancasInformadas,
    arquivo_analitico_path: pathAnalitico,
    arquivo_resumo_path: pathResumo,
    linhas: resumo.linhas,
    transferencias: resumo.transferencias,
    mudancas: analitico.mudancas,
    parcelas: preparo.parcelas,
  };

  return {
    ok: true,
    data: {
      unidadeId: unidade.id,
      unidadeNome: unidade.nome_isaac as string,
      competenciaRepasse: resumo.competencia,
      dataRepasse: payload.data_repasse as string,
      totais: {
        mensalidades: analitico.totais.mensalidades,
        mudancas: analitico.totais.mudancas,
        base: analitico.totais.base,
        taxa: analitico.totais.taxa,
        final: analitico.totais.final,
        totalResumo,
      },
      transferencias: resumo.transferencias,
      linhas: resumo.linhas,
      contagens: preparo.resumoContagens,
      bloqueios: preparo.bloqueios,
      avisos: preparo.avisos,
      pendencias: preparo.parcelas
        .filter((p) => p.motivoPendencia !== null)
        .map((p) => ({
          idParcela: p.idParcela,
          nomeIsaac: p.nomeIsaac,
          produto: p.produto,
          valorBase: p.valorBase,
          motivo: p.motivoPendencia as string,
        })),
      payload,
    },
  };
}

/**
 * Passo 2: grava. O payload vem da prévia que já foi olhada, e a RPC faz tudo
 * numa transação — ou o mês entra completo, ou não entra.
 */
export async function confirmarImportacaoIsaacAction(
  payloadJson: string,
): Promise<ActionResult<{ repasseId: string; cobrancas: number; pendencias: number }>> {
  await requirePermission("financeiro.isaac", "create");

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(payloadJson) as Record<string, unknown>;
  } catch {
    return { ok: false, error: "Prévia inválida. Refaça o envio dos arquivos." };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("importar_repasse_isaac", { p_payload: payload });

  if (error) return { ok: false, error: error.message };

  const resultado = data as { ok?: boolean; error?: string; repasse_id?: string; cobrancas?: number; pendencias?: number } | null;
  if (!resultado?.ok) return { ok: false, error: resultado?.error ?? "Falha ao importar o repasse." };

  revalidatePath("/financeiro/isaac");
  revalidatePath("/financeiro/lancamentos");

  return {
    ok: true,
    data: {
      repasseId: resultado.repasse_id ?? "",
      cobrancas: resultado.cobrancas ?? 0,
      pendencias: resultado.pendencias ?? 0,
    },
    message: `Repasse importado: ${resultado.cobrancas ?? 0} cobrança(s), ${resultado.pendencias ?? 0} pendência(s).`,
    redirectTo: "/financeiro/isaac",
  };
}

/**
 * Resolve uma pendência vinculando a parcela a um aluno, e grava o alias para
 * que o próximo repasse case sozinho. Não cria cobrança retroativa: quem
 * decide isso é a reimportação do mês, com a prévia na frente.
 */
export async function resolverPendenciaIsaacAction(formData: FormData): Promise<ActionResult> {
  await requirePermission("financeiro.isaac", "update");

  const parcelaId = formText(formData, "parcela_id");
  const alunoId = formText(formData, "aluno_id");
  if (!parcelaId) return { ok: false, error: "Parcela não informada." };
  if (!alunoId) return { ok: false, error: "Escolha o aluno." };

  const supabase = await createServerClient();
  const { data: parcela, error: erroParcela } = await supabase
    .from("isaac_parcela")
    .select("id, nome_isaac")
    .eq("id", parcelaId)
    .single();

  if (erroParcela || !parcela) return { ok: false, error: "Parcela não encontrada." };

  const { normalizarNomeIsaac } = await import("@/lib/isaac/normalizar-nome");
  const nomeNormalizado = normalizarNomeIsaac(parcela.nome_isaac as string);

  const { error: erroAlias } = await supabase
    .from("aluno_alias")
    .upsert({ aluno_id: alunoId, nome_normalizado: nomeNormalizado, fonte: "isaac" }, { onConflict: "fonte,nome_normalizado" });
  if (erroAlias) return { ok: false, error: erroAlias.message };

  const { data: perfil } = await supabase.rpc("current_perfil");
  const { error: erroUpdate } = await supabase
    .from("isaac_parcela")
    .update({
      aluno_id: alunoId,
      resolvido_em: new Date().toISOString(),
      resolvido_por: (perfil as { id?: string } | null)?.id ?? null,
    })
    .eq("id", parcelaId);

  if (erroUpdate) return { ok: false, error: erroUpdate.message };

  revalidatePath("/financeiro/isaac/pendencias");
  return { ok: true, data: undefined, message: "Pendência resolvida. O alias fica salvo para os próximos repasses." };
}
