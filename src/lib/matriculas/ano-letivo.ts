/**
 * Ano letivo a partir da data da matrícula.
 *
 * A escola matricula de setembro a dezembro PARA o ano seguinte. Derivar o ano
 * letivo de `getFullYear()` jogava toda a matrícula de fim de ano um ano para
 * trás — foi o que corrompeu o histórico importado do sistema antigo.
 */

/** Setembro: a partir dele a rematrícula é para o ano seguinte. */
export const MES_CORTE_ANO_LETIVO = 9;

export function anoLetivoDaData(data: Date, anoReferencia: number): number {
  const mes = data.getMonth() + 1;
  return mes >= MES_CORTE_ANO_LETIVO ? anoReferencia + 1 : anoReferencia;
}

/** O ano do corte, avançando enquanto o aluno já tiver matrícula naquele ano. */
export function anoLetivoSugerido(
  data: Date,
  anosOcupados: Iterable<number>,
  anoReferencia: number
): number {
  const ocupados = new Set(anosOcupados);
  let ano = anoLetivoDaData(data, anoReferencia);
  while (ocupados.has(ano)) ano += 1;
  return ano;
}
