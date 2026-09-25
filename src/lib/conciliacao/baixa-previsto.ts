import { chaveDeDocumento } from "@/lib/conciliacao/documento-contraparte";

/**
 * Casamento de débito do extrato com título a pagar (status 'aberta').
 *
 * Só valor EXATO em centavos (E3): tolerância em percentual esconde justamente
 * o erro que a frente existe para mostrar. Empate não casa — mesmo padrão das
 * outras etapas do pipeline, e pela mesma razão: escolher no chute liga dinheiro
 * ao título errado e ninguém vê.
 */

export const JANELA_BAIXA_DIAS = 5;

export type DebitoParaBaixa = {
  id: string;
  companyId: string | null;
  data: string;
  valor: number;
  documento: string | null;
};

export type PrevistoAberto = {
  id: string;
  valor: number;
  dataVencimento: string;
  /** Já em forma de chave (ver documentoDePrevisto); null quando o título não tem documento. */
  documento: string | null;
  companyId: string | null;
};

export type BaixaUnica = { debitoId: string; lancamentoId: string };
export type BaixaAmbigua = { debitoId: string; candidatos: string[] };
export type ResultadoBaixas = { unicas: BaixaUnica[]; ambiguas: BaixaAmbigua[] };

const centavos = (v: number) => Math.round(v * 100);

function diasEntre(a: string, b: string): number {
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  return Math.abs(Date.UTC(ya, ma - 1, da) - Date.UTC(yb, mb - 1, db)) / 86_400_000;
}

/**
 * `lancamento_financeiro.contraparte` é texto livre: pode ser nome de fornecedor
 * ou documento. Só vira documento se não tiver letra e tiver 6, 11 ou 14 dígitos.
 */
export function documentoDePrevisto(contraparte: string | null): string | null {
  if (!contraparte || /[a-z]/i.test(contraparte)) return null;
  const digitos = contraparte.replace(/\D/g, "");
  if (digitos.length !== 6 && digitos.length !== 11 && digitos.length !== 14) return null;
  return chaveDeDocumento(digitos);
}

function compativel(d: DebitoParaBaixa, p: PrevistoAberto): boolean {
  if (centavos(d.valor) !== centavos(p.valor)) return false;
  if (diasEntre(d.data, p.dataVencimento) > JANELA_BAIXA_DIAS) return false;
  if (d.documento !== null && p.documento !== null && chaveDeDocumento(d.documento) !== p.documento) return false;
  if (d.companyId !== null && p.companyId !== null && d.companyId !== p.companyId) return false;
  return true;
}

export function casarPrevistos(debitos: DebitoParaBaixa[], previstos: PrevistoAberto[]): ResultadoBaixas {
  const candidatosPor = new Map<string, string[]>();
  for (const d of debitos) {
    candidatosPor.set(d.id, previstos.filter((p) => compativel(d, p)).map((p) => p.id));
  }

  // Título disputado por mais de um débito nunca casa sozinho.
  const disputas = new Map<string, number>();
  for (const ids of Array.from(candidatosPor.values())) {
    for (const id of ids) disputas.set(id, (disputas.get(id) ?? 0) + 1);
  }

  const unicas: BaixaUnica[] = [];
  const ambiguas: BaixaAmbigua[] = [];
  for (const d of debitos) {
    const ids = candidatosPor.get(d.id) ?? [];
    if (ids.length === 0) continue;
    if (ids.length === 1 && disputas.get(ids[0]) === 1) {
      unicas.push({ debitoId: d.id, lancamentoId: ids[0] });
    } else {
      ambiguas.push({ debitoId: d.id, candidatos: ids });
    }
  }
  return { unicas, ambiguas };
}
