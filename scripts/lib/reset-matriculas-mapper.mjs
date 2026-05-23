function normalize(s) {
  return String(s ?? "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function mapHeaderToTarget(raw) {
  const s = normalize(raw);
  if (!s) return null;

  let m = s.match(/^MATERNAL\s*-\s*(MATUTINO|VESPERTINO)$/);
  if (m) {
    return { serie_nome: "MATERNAL", turma_nome: m[1], turno: m[1].toLowerCase() };
  }

  m = s.match(/^INFANTIL\s*(\d+)\s*-\s*(MATUTINO|VESPERTINO)$/);
  if (m) {
    return {
      serie_nome: `INFANTIL${m[1]}`,
      turma_nome: m[2],
      turno: m[2].toLowerCase()
    };
  }

  m = s.match(/^(\d+)A?\s*SERIE\s*-\s*EM\s*-\s*([AB])$/);
  if (m) {
    return {
      serie_nome: `${m[1]}ª SÉRIE`,
      turma_nome: m[2] === "A" ? "MATUTINO" : "VESPERTINO",
      turno: m[2] === "A" ? "matutino" : "vespertino"
    };
  }

  m = s.match(/^(\d+)O?\s*ANO\s*-\s*([AB])$/);
  if (m) {
    const n = Number(m[1]);
    const letra = m[2];
    if (n >= 6) {
      return { serie_nome: `${n}º ANO`, turma_nome: "MATUTINO", turno: "matutino" };
    }
    return {
      serie_nome: `${n}º ANO`,
      turma_nome: letra === "A" ? "MATUTINO" : "VESPERTINO",
      turno: letra === "A" ? "matutino" : "vespertino"
    };
  }

  return null;
}

export const SERIES_ALVO = [
  { nome: "MATERNAL", ordem: 1, segmento: "INFANTIL" },
  { nome: "INFANTIL3", ordem: 2, segmento: "INFANTIL" },
  { nome: "INFANTIL4", ordem: 3, segmento: "INFANTIL" },
  { nome: "INFANTIL5", ordem: 4, segmento: "INFANTIL" },
  { nome: "1º ANO", ordem: 5, segmento: "FUNDAMENTAL1" },
  { nome: "2º ANO", ordem: 6, segmento: "FUNDAMENTAL1" },
  { nome: "3º ANO", ordem: 7, segmento: "FUNDAMENTAL1" },
  { nome: "4º ANO", ordem: 8, segmento: "FUNDAMENTAL1" },
  { nome: "5º ANO", ordem: 9, segmento: "FUNDAMENTAL1" },
  { nome: "6º ANO", ordem: 10, segmento: "FUNDAMENTAL2" },
  { nome: "7º ANO", ordem: 11, segmento: "FUNDAMENTAL2" },
  { nome: "8º ANO", ordem: 12, segmento: "FUNDAMENTAL2" },
  { nome: "9º ANO", ordem: 13, segmento: "FUNDAMENTAL2" },
  { nome: "1ª SÉRIE", ordem: 14, segmento: "MEDIO" },
  { nome: "2ª SÉRIE", ordem: 15, segmento: "MEDIO" },
  { nome: "3ª SÉRIE", ordem: 16, segmento: "MEDIO" },
];

export const TURMAS_ALVO = [
  { serie: "MATERNAL",   turma: "MATUTINO",   turno: "matutino" },
  { serie: "MATERNAL",   turma: "VESPERTINO", turno: "vespertino" },
  { serie: "INFANTIL3",  turma: "MATUTINO",   turno: "matutino" },
  { serie: "INFANTIL3",  turma: "VESPERTINO", turno: "vespertino" },
  { serie: "INFANTIL4",  turma: "MATUTINO",   turno: "matutino" },
  { serie: "INFANTIL4",  turma: "VESPERTINO", turno: "vespertino" },
  { serie: "INFANTIL5",  turma: "MATUTINO",   turno: "matutino" },
  { serie: "INFANTIL5",  turma: "VESPERTINO", turno: "vespertino" },
  { serie: "1º ANO", turma: "MATUTINO",   turno: "matutino" },
  { serie: "1º ANO", turma: "VESPERTINO", turno: "vespertino" },
  { serie: "2º ANO", turma: "MATUTINO",   turno: "matutino" },
  { serie: "2º ANO", turma: "VESPERTINO", turno: "vespertino" },
  { serie: "3º ANO", turma: "MATUTINO",   turno: "matutino" },
  { serie: "3º ANO", turma: "VESPERTINO", turno: "vespertino" },
  { serie: "4º ANO", turma: "MATUTINO",   turno: "matutino" },
  { serie: "4º ANO", turma: "VESPERTINO", turno: "vespertino" },
  { serie: "5º ANO", turma: "MATUTINO",   turno: "matutino" },
  { serie: "5º ANO", turma: "VESPERTINO", turno: "vespertino" },
  { serie: "6º ANO", turma: "MATUTINO", turno: "matutino" },
  { serie: "7º ANO", turma: "MATUTINO", turno: "matutino" },
  { serie: "8º ANO", turma: "MATUTINO", turno: "matutino" },
  { serie: "9º ANO", turma: "MATUTINO", turno: "matutino" },
  { serie: "1ª SÉRIE", turma: "MATUTINO", turno: "matutino" },
  { serie: "2ª SÉRIE", turma: "MATUTINO", turno: "matutino" },
  { serie: "3ª SÉRIE", turma: "MATUTINO", turno: "matutino" },
];
