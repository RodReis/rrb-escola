// Algoritmo de Gauss (Anonymous Gregorian) — calcula a Páscoa de qualquer ano.
export function calcularPascoa(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3=março, 4=abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export type Feriado = {
  data: string;       // YYYY-MM-DD
  descricao: string;
};

function addDias(isoDate: string, dias: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + dias));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function feriadosNacionais(ano: number): Feriado[] {
  const pascoa = calcularPascoa(ano);
  return [
    { data: `${ano}-01-01`, descricao: "Confraternização Universal" },
    { data: addDias(pascoa, -47), descricao: "Carnaval" },
    { data: addDias(pascoa, -2), descricao: "Sexta-feira Santa" },
    { data: `${ano}-04-21`, descricao: "Tiradentes" },
    { data: `${ano}-05-01`, descricao: "Dia do Trabalho" },
    { data: addDias(pascoa, 60), descricao: "Corpus Christi" },
    { data: `${ano}-09-07`, descricao: "Independência do Brasil" },
    { data: `${ano}-10-12`, descricao: "Nossa Senhora Aparecida" },
    { data: `${ano}-11-02`, descricao: "Finados" },
    { data: `${ano}-11-15`, descricao: "Proclamação da República" },
    { data: `${ano}-12-25`, descricao: "Natal" },
  ];
}

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Feriados estaduais civis por UF. Apenas datas fixas.
// UFs sem feriado estadual civil exclusivo são omitidas (retornam []).
const ESTADUAIS: Record<string, Array<{ mesDia: string; descricao: string }>> = {
  SP: [{ mesDia: "07-09", descricao: "Revolução Constitucionalista" }],
  RJ: [{ mesDia: "04-23", descricao: "Dia de São Jorge" }],
  BA: [{ mesDia: "07-02", descricao: "Independência da Bahia" }],
  // GO: sem feriado estadual civil exclusivo
};

// Feriados municipais por UF + cidade (cidade normalizada: minúscula, sem acento).
const MUNICIPAIS: Record<string, Record<string, Array<{ mesDia: string; descricao: string }>>> = {
  GO: {
    trindade: [{ mesDia: "08-31", descricao: "Aniversário de Trindade" }],
  },
};

export function feriadosEstaduais(uf: string, ano: number): Feriado[] {
  const lista = ESTADUAIS[uf.toUpperCase()] ?? [];
  return lista.map((f) => ({
    data: `${ano}-${f.mesDia}`,
    descricao: f.descricao,
  }));
}

export function feriadosMunicipais(uf: string, cidade: string, ano: number): Feriado[] {
  const porCidade = MUNICIPAIS[uf.toUpperCase()] ?? {};
  const lista = porCidade[normalizar(cidade)] ?? [];
  return lista.map((f) => ({
    data: `${ano}-${f.mesDia}`,
    descricao: f.descricao,
  }));
}

export function todosFeriados(ano: number, uf: string, cidade: string): Feriado[] {
  const todos = [
    ...feriadosNacionais(ano),
    ...feriadosEstaduais(uf, ano),
    ...feriadosMunicipais(uf, cidade, ano),
  ];
  // Dedup por data — nacional tem precedência (vem primeiro).
  const vistos = new Set<string>();
  const resultado: Feriado[] = [];
  for (const f of todos) {
    if (vistos.has(f.data)) continue;
    vistos.add(f.data);
    resultado.push(f);
  }
  return resultado;
}
