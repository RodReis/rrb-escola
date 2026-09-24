"use server";

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
 * (ver `carregarDeclaracoesAction`, parâmetro `overrides`).
 */
export async function previsualizarDeclaracaoAction(
  matriculaId: string,
  modeloId: string
): Promise<{ titulo: string; texto: string; fecho: string }> {
  const modelo = await getDeclaracaoModeloById(modeloId);
  if (!modelo) throw new Error("Modelo de declaração não encontrado.");

  const dados = await buscarDadosDeclaracao(matriculaId);
  return resolverDeclaracao(modelo, dados);
}

/**
 * Resolve os dados de cada aluno e devolve as páginas já prontas para o
 * gerador de PDF (client-side). `overrides` é o que a pré-visualização foi
 * editada para nesta emissão — aplicado por cima do modelo salvo, sem
 * gravar nada no banco. Uma matrícula com erro (ex.: sem série vinculada)
 * não interrompe as demais — ver Review Focus do plano: emissão em lote
 * precisa ser resiliente por aluno.
 */
export async function carregarDeclaracoesAction(
  matriculaIds: string[],
  modeloId: string,
  overrides?: { titulo?: string; texto?: string; fecho?: string }
): Promise<DeclaracaoPdfDados[]> {
  const modelo = await getDeclaracaoModeloById(modeloId);
  if (!modelo) throw new Error("Modelo de declaração não encontrado.");

  const modeloEfetivo = {
    titulo: overrides?.titulo ?? modelo.titulo,
    texto: overrides?.texto ?? modelo.texto,
    fecho: overrides?.fecho ?? modelo.fecho
  };

  const supabase = await createServerClient();
  const paginas: DeclaracaoPdfDados[] = [];

  for (const matriculaId of matriculaIds) {
    try {
      const dados = await buscarDadosDeclaracao(matriculaId);

      const { data: matriculaRow } = await supabase
        .from("matriculas")
        .select("serie_id, ano_letivo")
        .eq("id", matriculaId)
        .maybeSingle();

      const credenciamento = matriculaRow?.serie_id
        ? await getCredenciamentoVigente(matriculaRow.serie_id as string, matriculaRow.ano_letivo as number)
        : null;
      if (!credenciamento) continue;

      const resolvido = resolverDeclaracao(modeloEfetivo, dados);
      paginas.push({ credenciamento, titulo: resolvido.titulo, corpo: resolvido.texto, fecho: resolvido.fecho });
    } catch {
      // Aluno com dado incompleto não derruba o lote inteiro — só fica de
      // fora do PDF final. Sem log aqui: Server Action, sem acesso a
      // console do cliente; o comportamento observável é "não apareceu" e
      // já é o suficiente para o Review Focus deste plano.
      continue;
    }
  }

  return paginas;
}
