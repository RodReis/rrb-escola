import type { CertificadoData, CertificadoOptions } from "./certificado-tipos";

/**
 * Montagem do parágrafo do certificado. jsPDF não tem rich text, então o texto
 * sai como lista de segmentos e o gerador desenha cada um com a fonte certa.
 * Módulo puro: nada de jsPDF aqui.
 */
export type Segmento = { texto: string; negrito: boolean };

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro"
];

/**
 * Parte `YYYY-MM-DD` como data local, por regex.
 * `new Date(iso)` trata a string como UTC e, em fuso negativo, devolve o dia
 * anterior — 2026-01-01 viraria 31/12/2025.
 */
function partesData(iso: string): { dia: number; mes: number; ano: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return { ano: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) };
}

export function formatarDataExtenso(iso: string): string {
  const p = partesData(iso);
  if (!p) return "";
  const mes = MESES[p.mes - 1];
  if (!mes) return "";
  return `${p.dia} de ${mes} de ${p.ano}`;
}

/** ISO → dd/mm/aaaa. Valor já formatado (base importada) passa direto. */
export function formatarDataCurta(iso: string | null): string {
  if (!iso) return "";
  const p = partesData(iso);
  if (!p) return iso;
  return `${String(p.dia).padStart(2, "0")}/${String(p.mes).padStart(2, "0")}/${p.ano}`;
}

/**
 * ISO → `Date` no fuso local, para quem exige um `Date` (o gerador do
 * histórico). `new Date("2026-09-19")` devolveria 18/09 em GMT-3, porque o
 * construtor lê a string como meia-noite UTC. Data inválida devolve hoje.
 */
export function dataLocalDeIso(iso: string): Date {
  const p = partesData(iso);
  return p ? new Date(p.ano, p.mes - 1, p.dia) : new Date();
}

/**
 * Junta segmentos e normaliza espaços, para que campo ausente não deixe buraco.
 * Também remove o espaço que sobra antes de pontuação quando o trecho anterior
 * cai (ex.: aluno sem RG deixaria "… GOIÂNIA-GO , concluiu …").
 */
function normalizar(segs: Segmento[]): Segmento[] {
  const saida: Segmento[] = [];

  for (const seg of segs) {
    if (seg.texto === "") continue;
    const texto = seg.texto.replace(/\s+/g, " ");
    const anterior = saida[saida.length - 1];
    if (anterior && anterior.negrito === seg.negrito) {
      anterior.texto += texto;
    } else {
      saida.push({ texto, negrito: seg.negrito });
    }
  }

  // Espaço duplicado na junção de dois segmentos de ênfase diferente.
  for (let i = 0; i < saida.length - 1; i++) {
    if (saida[i].texto.endsWith(" ") && saida[i + 1].texto.startsWith(" ")) {
      saida[i + 1].texto = saida[i + 1].texto.replace(/^\s+/, "");
    }
  }

  // Espaço antes de pontuação, que aparece quando um campo opcional some.
  for (let i = 0; i < saida.length - 1; i++) {
    if (saida[i].texto.endsWith(" ") && /^[,.;:]/.test(saida[i + 1].texto)) {
      saida[i].texto = saida[i].texto.replace(/\s+$/, "");
    }
  }

  if (saida.length > 0) {
    saida[0].texto = saida[0].texto.replace(/^\s+/, "");
    const ultimo = saida[saida.length - 1];
    ultimo.texto = ultimo.texto.replace(/\s+$/, "");
  }

  return saida.filter((s) => s.texto !== "");
}

function montarCustomizado(
  modelo: string,
  data: CertificadoData,
  opts: CertificadoOptions
): Segmento[] {
  const valores: Record<string, string> = {
    aluno: data.aluno.nome,
    curso: opts.descricaoCurso,
    ano: String(opts.anoConclusao),
    escola: data.escola.nomeFantasia,
    serie: data.aluno.serie,
    nascimento: formatarDataCurta(data.aluno.dataNascimento),
    naturalidade: data.aluno.naturalidade ?? "",
    nacionalidade: data.aluno.nacionalidade ?? "",
    rg: data.aluno.rg ?? "",
    filiacao: data.aluno.filiacao ?? ""
  };

  const segs: Segmento[] = [];
  const re = /\{\{(\w+)\}\}/g;
  let pos = 0;
  let achado: RegExpExecArray | null;

  while ((achado = re.exec(modelo)) !== null) {
    if (achado.index > pos) {
      segs.push({ texto: modelo.slice(pos, achado.index), negrito: false });
    }
    const valor = valores[achado[1]];
    // Placeholder desconhecido fica literal, para a secretária ver o erro de
    // digitação em vez de um buraco silencioso no documento.
    segs.push(
      valor === undefined ? { texto: achado[0], negrito: false } : { texto: valor, negrito: true }
    );
    pos = achado.index + achado[0].length;
  }

  if (pos < modelo.length) segs.push({ texto: modelo.slice(pos), negrito: false });
  return normalizar(segs);
}

export function montarCorpo(data: CertificadoData, opts: CertificadoOptions): Segmento[] {
  if (opts.textoCustomizado && opts.textoCustomizado.trim() !== "") {
    return montarCustomizado(opts.textoCustomizado, data, opts);
  }

  const { aluno, escola } = data;
  const segs: Segmento[] = [
    { texto: `${opts.textoInicio} `, negrito: false },
    { texto: escola.nomeFantasia, negrito: true },
    { texto: ", certifica que ", negrito: false },
    { texto: aluno.nome, negrito: true }
  ];

  if (aluno.nacionalidade?.trim()) {
    segs.push({ texto: " de nacionalidade ", negrito: false });
    segs.push({ texto: aluno.nacionalidade.trim(), negrito: true });
  }

  // `filiacao` já vem como string única do histórico ("PAI e MÃE").
  if (aluno.filiacao?.trim()) {
    segs.push({ texto: " filho(a) de ", negrito: false });
    segs.push({ texto: aluno.filiacao.trim(), negrito: true });
  }

  if (aluno.naturalidade?.trim()) {
    segs.push({ texto: " natural de ", negrito: false });
    segs.push({ texto: aluno.naturalidade.trim(), negrito: true });
  }

  const nascimento = formatarDataCurta(aluno.dataNascimento);
  if (nascimento) {
    segs.push({ texto: " nascido(a) em ", negrito: false });
    segs.push({ texto: nascimento, negrito: true });
  }

  if (aluno.rg?.trim()) {
    segs.push({ texto: ", portador(a) do RG Nº ", negrito: false });
    segs.push({ texto: aluno.rg.trim(), negrito: false });
  }

  segs.push({ texto: ", concluiu no ano letivo de ", negrito: false });
  segs.push({ texto: String(opts.anoConclusao), negrito: true });
  segs.push({ texto: " o ", negrito: false });
  segs.push({ texto: opts.descricaoCurso, negrito: true });
  segs.push({ texto: " neste Estabelecimento de Ensino ", negrito: false });
  segs.push({ texto: opts.baseLegal, negrito: false });

  return normalizar(segs);
}
