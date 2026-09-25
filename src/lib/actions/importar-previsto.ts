"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { createServerClient } from "@/lib/supabase/server";
import { assertOk } from "@/lib/actions/assert-ok";
import { hashImport, lerPlanilha } from "@/lib/previsto/planilha";
import { sugerirCategoria, sugerirEmpresa } from "@/lib/previsto/sugestoes-import";
import { documentoDePrevisto } from "@/lib/conciliacao/baixa-previsto";

const MAX_BYTES = 2 * 1024 * 1024;

export type LinhaPreview = {
  linha: number;
  descricao: string;
  valor: number | null;
  dataVencimento: string | null;
  classe: "fixa" | "variavel" | null;
  documento: string | null;
  empresaTexto: string | null;
  empresaId: string | null;
  categoriaId: string | null;
  /** 'novo' | 'duplicado' (já existe no banco) | 'repetida' (igual a outra linha do mesmo arquivo) | 'invalida' */
  situacao: "novo" | "duplicado" | "repetida" | "invalida";
  motivoInvalida: string | null;
};

export type ResultadoPreview =
  | { erro: string }
  | {
      erro: null;
      linhas: LinhaPreview[];
      empresas: { id: string; nome: string }[];
      categorias: { id: string; nome: string }[];
    };

const competenciaDe = (dataVencimento: string) => dataVencimento.slice(0, 7);

export async function previewPlanilhaAction(formData: FormData): Promise<ResultadoPreview> {
  await requirePermission("financeiro.lancamentos", "create");
  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Selecione o arquivo .xlsx." };
  if (arquivo.size > MAX_BYTES) return { erro: "Arquivo maior que 2MB." };

  const lido = await lerPlanilha(Buffer.from(await arquivo.arrayBuffer()), new Date().toISOString().slice(0, 10));
  if (lido.erro) return { erro: lido.erro };
  if (lido.linhas.length === 0) {
    return { erro: "Nenhuma linha reconhecida nesta planilha. Confira se o arquivo está no formato esperado (seções com nome, contato/data e valor)." };
  }

  const supabase = await createServerClient();
  const [companiesRes, categoriasRes] = await Promise.all([
    supabase.from("companies").select("id, name, cnpj").eq("ativo", true).order("name"),
    supabase.from("categorias_financeiras").select("id, nome").eq("escola_id", DEFAULT_SCHOOL_ID).eq("tipo", "despesa").eq("ativo", true).order("nome"),
  ]);
  const empresas = (companiesRes.data ?? []).map((c) => ({ id: c.id as string, nome: c.name as string, cnpj: (c.cnpj as string | null) ?? null }));
  const categorias = (categoriasRes.data ?? []).map((c) => ({ id: c.id as string, nome: c.nome as string }));

  const hashes = lido.linhas.flatMap((l) =>
    l.valor !== null && l.dataVencimento !== null && l.descricao
      ? [
          hashImport({
            competencia: competenciaDe(l.dataVencimento),
            descricao: l.descricao,
            valor: l.valor,
            dataVencimento: l.dataVencimento,
            empresaId: sugerirEmpresa(l.empresa, empresas),
          }),
        ]
      : [],
  );
  const { data: existentes } = await supabase
    .from("lancamento_financeiro")
    .select("import_hash")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .in("import_hash", hashes);
  const jaNoBanco = new Set((existentes ?? []).map((e) => e.import_hash as string));

  const vistos = new Set<string>();
  const linhas: LinhaPreview[] = lido.linhas.map((l) => {
    const base = {
      linha: l.linha, descricao: l.descricao, valor: l.valor, dataVencimento: l.dataVencimento,
      classe: l.classe, documento: l.documento, empresaTexto: l.empresa,
      empresaId: sugerirEmpresa(l.empresa, empresas),
      categoriaId: sugerirCategoria(l.categoria, categorias),
    };
    if (!l.descricao || l.valor === null || l.dataVencimento === null) {
      const falta = !l.descricao ? "descrição" : l.valor === null ? "valor" : "data de vencimento";
      return { ...base, situacao: "invalida", motivoInvalida: `${falta} ilegível` };
    }
    const h = hashImport({
      competencia: competenciaDe(l.dataVencimento),
      descricao: l.descricao,
      valor: l.valor,
      dataVencimento: l.dataVencimento,
      empresaId: base.empresaId,
    });
    if (jaNoBanco.has(h)) return { ...base, situacao: "duplicado", motivoInvalida: null };
    if (vistos.has(h)) return { ...base, situacao: "repetida", motivoInvalida: null };
    vistos.add(h);
    return { ...base, situacao: "novo", motivoInvalida: null };
  });

  return { erro: null, linhas, empresas: empresas.map(({ id, nome }) => ({ id, nome })), categorias };
}

const linhaConfirmadaSchema = z.object({
  descricao: z.string().min(1).max(200),
  valor: z.number().positive(),
  dataVencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  empresaId: z.string().uuid("Toda linha precisa de empresa (E4)"),
  categoriaId: z.string().uuid("Toda linha precisa de categoria"),
  classe: z.enum(["fixa", "variavel"]).nullable(),
  documento: z.string().max(40).nullable(),
});

export async function confirmarImportacaoAction(linhasJson: string): Promise<{ criados: number; jaExistiam: number }> {
  const session = await requirePermission("financeiro.lancamentos", "create");

  let bruto: unknown;
  try {
    bruto = JSON.parse(linhasJson);
  } catch {
    throw new Error("Linhas inválidas");
  }
  const parsed = z.array(linhaConfirmadaSchema).min(1, "Nenhuma linha marcada").max(500).safeParse(bruto);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Linhas inválidas");

  const supabase = await createServerClient();
  const registros = parsed.data.map((l) => ({
    escola_id: DEFAULT_SCHOOL_ID,
    tipo: "despesa" as const,
    competencia: competenciaDe(l.dataVencimento),
    descricao: l.descricao,
    categoria_id: l.categoriaId,
    company_id: l.empresaId,
    classe_despesa: l.classe,
    // só grava contraparte quando é documento de verdade — é o que o casamento usa
    contraparte: l.documento && documentoDePrevisto(l.documento) ? l.documento : null,
    valor: l.valor,
    data_vencimento: l.dataVencimento,
    status: "aberta" as const,
    origem_tipo: "manual" as const,
    import_hash: hashImport({
      competencia: competenciaDe(l.dataVencimento),
      descricao: l.descricao,
      valor: l.valor,
      dataVencimento: l.dataVencimento,
      empresaId: l.empresaId,
    }),
    criado_por: session.profile.id,
  }));

  // Dedup dentro do próprio envio + contra o banco: o índice único barra o resto.
  const unicos = Array.from(new Map(registros.map((r) => [r.import_hash, r])).values());
  const { data: existentes } = await supabase
    .from("lancamento_financeiro")
    .select("import_hash")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .in("import_hash", unicos.map((r) => r.import_hash));
  const jaTem = new Set((existentes ?? []).map((e) => e.import_hash as string));
  const novos = unicos.filter((r) => !jaTem.has(r.import_hash));

  if (novos.length > 0) {
    assertOk(await supabase.from("lancamento_financeiro").insert(novos), "Não foi possível importar as linhas");
  }

  revalidatePath("/financeiro/lancamentos");
  revalidatePath("/financeiro/previsto-realizado");
  return { criados: novos.length, jaExistiam: registros.length - novos.length };
}
