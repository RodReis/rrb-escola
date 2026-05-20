const TURNO_MAP = {
  MATUTINO: "matutino",
  VESPERTINO: "vespertino",
  NOTURNO: "noturno",
  INTEGRAL: "integral"
};

function clean(s) {
  return String(s ?? "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function mapTurmaHeader(raw) {
  const s = clean(raw);
  if (!s) return null;

  // MATERNAL - <TURNO>
  let m = s.match(/^MATERNAL\s*-\s*(MATUTINO|VESPERTINO|NOTURNO|INTEGRAL)$/);
  if (m) {
    const turno = TURNO_MAP[m[1]];
    return {
      serie_nome: "Maternal",
      turma_nome: turno === "matutino" ? "A" : "B",
      turno
    };
  }

  // INFANTIL <N> - <TURNO>
  m = s.match(/^INFANTIL\s*(\d+)\s*-\s*(MATUTINO|VESPERTINO|NOTURNO|INTEGRAL)$/);
  if (m) {
    const turno = TURNO_MAP[m[2]];
    return {
      serie_nome: `Infantil ${m[1]}`,
      turma_nome: turno === "matutino" ? "A" : "B",
      turno
    };
  }

  // <N>O ANO - <LETRA>
  m = s.match(/^(\d+)O\s*ANO\s*-\s*([AB])$/);
  if (m) {
    const letra = m[2];
    return {
      serie_nome: `${m[1]}º Ano`,
      turma_nome: letra,
      turno: letra === "A" ? "matutino" : "vespertino"
    };
  }

  // <N>A SERIE - EM - <LETRA>
  m = s.match(/^(\d+)A\s*SERIE\s*-\s*EM\s*-\s*([AB])$/);
  if (m) {
    const letra = m[2];
    return {
      serie_nome: `${m[1]}ª Série EM`,
      turma_nome: letra,
      turno: letra === "A" ? "matutino" : "vespertino"
    };
  }

  return null;
}
