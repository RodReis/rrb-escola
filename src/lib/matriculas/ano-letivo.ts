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
  // O corte de setembro soma 1 ao ano DA DATA, nunca ao da referência: se
  // somasse à referência, uma matrícula de dezembro depois que a secretaria
  // já avançou a referência pularia um ano a mais (referência 2027 + corte =
  // 2028, quando o aluno está matriculando para 2027). A referência só entra
  // como piso — nunca deixa o ano letivo regredir se a referência ficou
  // atrasada em relação ao relógio.
  const anoPeloCorte = mes >= MES_CORTE_ANO_LETIVO ? data.getFullYear() + 1 : data.getFullYear();
  return Math.max(anoReferencia, anoPeloCorte);
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
