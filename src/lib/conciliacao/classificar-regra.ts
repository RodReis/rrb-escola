/**
 * Casa um débito com a regra de contraparte mais específica que se aplica.
 *
 * Ordem de especificidade, da mais forte para a mais fraca:
 *   1. documento + valor esperado + janela de dias  (pró-labore, D7)
 *   2. documento + conta
 *   3. documento
 *   4. texto + conta
 *   5. texto
 *
 * O valor esperado existe por causa da D7: o pró-labore é R$ 4.000 no dia 05 e
 * R$ 1.500 no dia 15. Casar por "maior pagamento do mês" foi testado contra os
 * dados reais e classificou como pró-labore os R$ 10.000 de fevereiro e os
 * R$ 6.500 de maio ao Renato — retiradas extraordinárias. Por isso valor exato.
 */

export type Regra = {
  id: string;
  tipoMatch: "documento" | "texto";
  documento: string | null;
  padraoTexto: string | null;
  valorEsperado: number | null;
  diaInicio: number | null;
  diaFim: number | null;
  contaId: string | null;
  categoriaId: string;
  companyId: string | null;
  classeDespesa: "fixa" | "variavel" | null;
};

export type DebitoParaRegra = {
  id: string;
  contaId: string;
  data: string;
  valor: number;
  descricao: string;
  documento: string | null;
};

const centavos = (v: number) => Math.round(v * 100);

/** Minúsculas, sem acento — a descrição do banco varia em caixa e acentuação. */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function aplica(regra: Regra, debito: DebitoParaRegra): boolean {
  if (regra.contaId !== null && regra.contaId !== debito.contaId) return false;

  if (regra.valorEsperado !== null) {
    if (centavos(regra.valorEsperado) !== centavos(debito.valor)) return false;
  }

  if (regra.diaInicio !== null && regra.diaFim !== null) {
    const dia = Number(debito.data.slice(8, 10));
    if (dia < regra.diaInicio || dia > regra.diaFim) return false;
  }

  if (regra.tipoMatch === "documento") {
    return debito.documento !== null && regra.documento === debito.documento;
  }

  return regra.padraoTexto !== null && normalizar(debito.descricao).includes(normalizar(regra.padraoTexto));
}

/** Quanto maior, mais específica. Decide qual regra vale quando mais de uma casa. */
function peso(regra: Regra): number {
  let p = regra.tipoMatch === "documento" ? 100 : 0;
  if (regra.valorEsperado !== null) p += 40;
  if (regra.diaInicio !== null) p += 20;
  if (regra.contaId !== null) p += 10;
  return p;
}

export function classificarPorRegra(debito: DebitoParaRegra, regras: Regra[]): Regra | null {
  const candidatas = regras.filter((r) => aplica(r, debito));
  if (candidatas.length === 0) return null;
  // Empate de peso resolve pelo id, para o resultado ser determinístico.
  return candidatas.sort((a, b) => peso(b) - peso(a) || a.id.localeCompare(b.id))[0];
}
