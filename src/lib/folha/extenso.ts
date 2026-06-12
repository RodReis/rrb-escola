const UNIDADES = [
  "", "um", "dois", "três", "quatro", "cinco",
  "seis", "sete", "oito", "nove", "dez",
  "onze", "doze", "treze", "quatorze", "quinze",
  "dezesseis", "dezessete", "dezoito", "dezenove",
];

const DEZENAS = [
  "", "", "vinte", "trinta", "quarenta", "cinquenta",
  "sessenta", "setenta", "oitenta", "noventa",
];

const CENTENAS = [
  "", "cem", "duzentos", "trezentos", "quatrocentos", "quinhentos",
  "seiscentos", "setecentos", "oitocentos", "novecentos",
];

function centoAteNovecentosENove(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";

  const c = Math.floor(n / 100);
  const resto = n % 100;

  if (c === 0) {
    if (resto < 20) return UNIDADES[resto];
    const d = Math.floor(resto / 10);
    const u = resto % 10;
    return u === 0 ? DEZENAS[d] : `${DEZENAS[d]} e ${UNIDADES[u]}`;
  }

  const centena = c === 1 ? "cento" : CENTENAS[c];
  if (resto === 0) return centena;

  const restoStr = (() => {
    if (resto < 20) return UNIDADES[resto];
    const d = Math.floor(resto / 10);
    const u = resto % 10;
    return u === 0 ? DEZENAS[d] : `${DEZENAS[d]} e ${UNIDADES[u]}`;
  })();

  return `${centena} e ${restoStr}`;
}

function inteiroParaExtenso(n: number): string {
  if (n === 0) return "zero";

  const milhares = Math.floor(n / 1000);
  const resto = n % 1000;

  if (milhares === 0) return centoAteNovecentosENove(resto);

  const milharesStr = (() => {
    if (milhares === 1) return "mil";
    return `${centoAteNovecentosENove(milhares)} mil`;
  })();

  if (resto === 0) return milharesStr;

  return `${milharesStr} ${centoAteNovecentosENove(resto)}`;
}

export function valorPorExtenso(n: number): string {
  const arredondado = Math.round(n * 100);
  const reais = Math.floor(arredondado / 100);
  const centavos = arredondado % 100;

  const parteReais = (() => {
    if (reais === 0) return null;
    const ext = inteiroParaExtenso(reais);
    return reais === 1 ? `${ext} real` : `${ext} reais`;
  })();

  const parteCentavos = (() => {
    if (centavos === 0) return null;
    const ext = inteiroParaExtenso(centavos);
    return centavos === 1 ? `${ext} centavo` : `${ext} centavos`;
  })();

  if (parteReais && parteCentavos) return `${parteReais} e ${parteCentavos}`;
  if (parteReais) return parteReais;
  if (parteCentavos) return parteCentavos;
  return "zero reais";
}
