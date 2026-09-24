"use server";

import { requirePermission } from "@/lib/auth/session";
import { buscarDadosDeclaracao } from "@/lib/data/declaracao-emissao";
import { getDeclaracaoModeloById } from "@/lib/data/declaracoes";
import { resolverDeclaracao } from "@/lib/documents/declaracao-resolver";
import { getCredenciamentoVigente } from "@/lib/data/historico";
import { createServerClient } from "@/lib/supabase/server";
import type { DeclaracaoPdfDados } from "@/lib/documents/declaracao-pdf";

/**
 * Resolve o modelo escolhido para UM aluno de referência (o selecionado, ou
 * o primeiro do filtro) — usado pela tela para mostrar Título/Texto/Fecho
 * já com os parâmetros trocados, antes de emitir. A pessoa pode editar esse
 * resultado; a edição não é salva em lugar nenhum, só usada nesta emissão
 * quando for para UM único aluno (ver `carregarDeclaracoesAction`,
 * parâmetro `overrides`) — em lote, a pré-visualização é só conferência.
 */
export async function previsualizarDeclaracaoAction(
  matriculaId: string,
  modeloId: string
): Promise<{ titulo: string; texto: string; fecho: string }> {
  await requirePermission("historico", "read");

  const modelo = await getDeclaracaoModeloById(modeloId);
  if (!modelo) throw new Error("Modelo de declaração não encontrado.");

  const dados = await buscarDadosDeclaracao(matriculaId);
  return resolverDeclaracao(modelo, dados);
}

/**
 * Resolve os dados de cada aluno e devolve as páginas já prontas para o
 * gerador de PDF (client-side), além da lista de alunos que ficaram de fora
 * (credenciamento ausente ou exceção ao buscar os dados). `overrides` é o
 * que a pré-visualização foi editada para nesta emissão — aplicado por cima
 * do modelo salvo, sem gravar nada no banco. Só faz sentido quando
 * `matriculaIds` tem exatamente 1 item: a UI (`declaracao-emissao-form.tsx`)
 * nunca envia `overrides` em emissão de lote — caso contrário, o texto já
 * resolvido para o primeiro aluno (sem nenhum `[TOKEN]` restante) seria
 * usado como "modelo" de todos os demais, vazando os dados pessoais desse
 * primeiro aluno para o lote inteiro (achado CRITICAL da revisão final).
 * Uma matrícula com erro (ex.: sem série vinculada) não interrompe as
 * demais — ver Review Focus do plano: emissão em lote precisa ser
 * resiliente por aluno.
 */
export async function carregarDeclaracoesAction(
  matriculaIds: string[],
  modeloId: string,
  overrides?: { titulo?: string; texto?: string; fecho?: string }
): Promise<{ paginas: DeclaracaoPdfDados[]; falhas: Array<{ nome: string; motivo: string }> }> {
  await requirePermission("historico", "read");

  const modelo = await getDeclaracaoModeloById(modeloId);
  if (!modelo) throw new Error("Modelo de declaração não encontrado.");

  const modeloEfetivo = {
    titulo: overrides?.titulo ?? modelo.titulo,
    texto: overrides?.texto ?? modelo.texto,
    fecho: overrides?.fecho ?? modelo.fecho
  };

  const supabase = await createServerClient();
  const paginas: DeclaracaoPdfDados[] = [];
  const falhas: Array<{ nome: string; motivo: string }> = [];

  for (const matriculaId of matriculaIds) {
    let nomeAluno = matriculaId;
    try {
      const dados = await buscarDadosDeclaracao(matriculaId);
      nomeAluno = dados.nomeAluno || matriculaId;

      const { data: matriculaRow } = await supabase
        .from("matriculas")
        .select("serie_id, ano_letivo")
        .eq("id", matriculaId)
        .maybeSingle();

      const credenciamento = matriculaRow?.serie_id
        ? await getCredenciamentoVigente(matriculaRow.serie_id as string, matriculaRow.ano_letivo as number)
        : null;
      if (!credenciamento) {
        falhas.push({ nome: nomeAluno, motivo: "Credenciamento não encontrado para a série/ano da matrícula." });
        continue;
      }

      const resolvido = resolverDeclaracao(modeloEfetivo, dados);
      paginas.push({ credenciamento, titulo: resolvido.titulo, corpo: resolvido.texto, fecho: resolvido.fecho });
    } catch (e) {
      // Aluno com dado incompleto não derruba o lote inteiro — só fica de
      // fora do PDF final, e a UI mostra o motivo (Review Focus do plano).
      falhas.push({ nome: nomeAluno, motivo: e instanceof Error ? e.message : "Erro desconhecido ao montar a declaração." });
      continue;
    }
  }

  return { paginas, falhas };
}
