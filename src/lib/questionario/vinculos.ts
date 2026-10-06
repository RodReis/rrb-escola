import type { QuestaoTipo } from "@/lib/validation/questionario";

export type VinculoInput = { id?: string; questaoId: string; escalaId: string | null };
export type VinculoNormalizado = VinculoInput & { ordem: number };
export type QuestaoInfo = { tipo: QuestaoTipo; pergunta: string; ativa: boolean };

export type ResultadoVinculos =
  | { ok: true; vinculos: VinculoNormalizado[] }
  | { ok: false; error: string };

/** Ordem = posição na lista. Só `objetiva_escala` guarda escala (e a exige). */
export function normalizarVinculos(
  vinculos: VinculoInput[],
  questoes: Map<string, QuestaoInfo>,
): ResultadoVinculos {
  const vistos = new Set<string>();
  const saida: VinculoNormalizado[] = [];
  for (let i = 0; i < vinculos.length; i++) {
    const v = vinculos[i];
    const info = questoes.get(v.questaoId);
    if (!info) return { ok: false, error: "Questão inexistente no questionário." };
    if (vistos.has(v.questaoId)) return { ok: false, error: `A questão "${info.pergunta}" está repetida.` };
    vistos.add(v.questaoId);
    const comEscala = info.tipo === "objetiva_escala";
    if (comEscala && !v.escalaId) return { ok: false, error: `Escolha a escala da questão "${info.pergunta}".` };
    saida.push({ id: v.id, questaoId: v.questaoId, escalaId: comEscala ? v.escalaId : null, ordem: i + 1 });
  }
  return { ok: true, vinculos: saida };
}

/**
 * Compara o que está gravado com o que o formulário mandou. O vínculo é casado
 * pelo id (se pertence ao questionário E é da mesma questão) ou, na falta, pela
 * questão: remover e re-adicionar a mesma questão reaproveita a linha em vez de
 * violar a unicidade (questionario, questao). O id nunca troca de questão.
 */
export function diffVinculos(
  atuais: Array<{ id: string; questaoId: string }>,
  novos: VinculoNormalizado[],
) {
  const porId = new Map(atuais.map((a) => [a.id, a] as const));
  const idPorQuestao = new Map(atuais.map((a) => [a.questaoId, a.id] as const));
  const mantidos = new Set<string>();
  const atualizar: Array<VinculoNormalizado & { id: string }> = [];
  const inserir: VinculoNormalizado[] = [];
  for (const n of novos) {
    const doId = n.id ? porId.get(n.id) : undefined;
    const alvo = doId && doId.questaoId === n.questaoId ? doId.id : idPorQuestao.get(n.questaoId);
    if (alvo && !mantidos.has(alvo)) {
      mantidos.add(alvo);
      atualizar.push({ ...n, id: alvo });
    } else {
      inserir.push({ ...n, id: undefined });
    }
  }
  const remover = atuais.filter((a) => !mantidos.has(a.id)).map((a) => a.id);
  return { inserir, atualizar, remover };
}

/** Botão "Adicionar": questão escolhida, ou "Todos" (as do grupo, ou de todos os grupos). */
export function questoesParaAdicionar(
  todas: Array<{ id: string; grupoId: string }>,
  jaAdicionadas: Set<string>,
  grupoId: string | null,
  questaoId: string | null,
): string[] {
  if (questaoId) return jaAdicionadas.has(questaoId) ? [] : [questaoId];
  return todas
    .filter((q) => (!grupoId || q.grupoId === grupoId) && !jaAdicionadas.has(q.id))
    .map((q) => q.id);
}
