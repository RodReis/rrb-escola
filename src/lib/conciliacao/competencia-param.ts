/**
 * Validação dos parâmetros `mes`/`ano` do backfill de extrato.
 *
 * Função pura, separada da rota, porque a rota importa `server-only` e não
 * roda no vitest.
 */

export type CompetenciaParam =
  | { ok: true; mes: number; ano: number }
  | { ok: false; erro: string };

/** Antes disso não há operação no sistema; ano menor é erro de digitação. */
const ANO_MINIMO = 2020;

export function parseCompetencia(
  mes: string | null,
  ano: string | null,
  hoje: Date,
): CompetenciaParam {
  if (mes === null || ano === null) {
    return { ok: false, erro: "Informe mes e ano na querystring." };
  }

  // Number("") é 0 e Number("8x") é NaN: os dois caem no teste de inteiro.
  const mesNum = Number(mes);
  if (!Number.isInteger(mesNum) || mesNum < 1 || mesNum > 12) {
    return { ok: false, erro: `Mês inválido: ${mes}.` };
  }

  const anoNum = Number(ano);
  if (!Number.isInteger(anoNum) || anoNum < ANO_MINIMO || anoNum > hoje.getUTCFullYear()) {
    return { ok: false, erro: `Ano inválido: ${ano}.` };
  }

  const futura =
    anoNum > hoje.getUTCFullYear() ||
    (anoNum === hoje.getUTCFullYear() && mesNum > hoje.getUTCMonth() + 1);
  if (futura) {
    return { ok: false, erro: `Competência ${mesNum}/${anoNum} é futura.` };
  }

  return { ok: true, mes: mesNum, ano: anoNum };
}
