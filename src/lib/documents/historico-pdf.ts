import { jsPDF } from "jspdf";
import { montarGrade } from "@/lib/historico/grade";
import { formatarDataCurta } from "./certificado-texto";
import {
  NIVEL_EXIBE_CH,
  NIVEL_LABEL,
  SERIES_POR_NIVEL,
  type HistoricoAno,
  type HistoricoData
} from "@/lib/historico/tipos";

export type HistoricoPdfOptions = {
  dataEmissao?: Date;
  /** PNG em data URL. Sem ele, o cabeçalho sai sem logo. */
  logoDataUrl?: string;
};

const PAGINA = { largura: 595, altura: 842 };
const MARGEM_ESQ = 22;
const MARGEM_DIR = 573;
const TRACO = "-";

/**
 * Topo da tabela de estabelecimentos no modelo de referência. A grade de notas
 * só empurra este bloco para baixo quando o aluno tem disciplinas demais.
 */
const Y_ESTABELECIMENTOS = 373;

/**
 * O formulário oficial imprime o ciclo inteiro em toda emissão do Fundamental —
 * o aluno do 1º ANO recebe a mesma folha do 9º, com as séries não cursadas em
 * branco. Só o Infantil e o Médio usam a própria faixa.
 */
const CICLO_FUNDAMENTAL = [
  ...SERIES_POR_NIVEL.fund1,
  ...SERIES_POR_NIVEL.fund2,
  ...SERIES_POR_NIVEL.medio
];

const COLUNAS_IMPRESSAS: Record<HistoricoData["nivel"], string[]> = {
  infantil: SERIES_POR_NIVEL.infantil,
  fund1: CICLO_FUNDAMENTAL,
  fund2: CICLO_FUNDAMENTAL,
  medio: CICLO_FUNDAMENTAL
};

/**
 * Rótulo impresso da coluna. A série continua sendo "1ª SÉRIE" nos dados (é o
 * nome cadastrado); no documento a escola imprime "1º MÉDIO".
 */
const ROTULO_COLUNA: Record<string, string> = {
  "1ª SÉRIE": "1º MÉDIO",
  "2ª SÉRIE": "2º MÉDIO",
  "3ª SÉRIE": "3º MÉDIO"
};

const rotuloDaColuna = (serie: string) => ROTULO_COLUNA[serie] ?? serie;

/** Espessuras das réguas: a externa fecha o bloco, a interna separa células. */
const TRACO_BORDA = 0.7;
const TRACO_CELULA = 0.3;

/** Converte y do PDF de referência (origem embaixo) para y do jsPDF (origem no topo). */
const y = (yPdf: number) => PAGINA.altura - yPdf;

function texto(doc: jsPDF, str: string, x: number, yPdf: number, tamanho: number, bold = false) {
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setFontSize(tamanho);
  doc.text(str, x, y(yPdf));
}

function textoCentro(doc: jsPDF, str: string, yPdf: number, tamanho: number, bold = false) {
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setFontSize(tamanho);
  doc.text(str, PAGINA.largura / 2, y(yPdf), { align: "center" });
}

/** Texto centrado numa faixa horizontal — usado em toda célula de grade. */
function textoNaCelula(
  doc: jsPDF,
  str: string,
  xEsq: number,
  xDir: number,
  yPdf: number,
  tamanho: number,
  bold = false
) {
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setFontSize(tamanho);
  doc.text(str, (xEsq + xDir) / 2, y(yPdf), { align: "center" });
}

function linhaH(doc: jsPDF, xEsq: number, xDir: number, yPdf: number, espessura = TRACO_CELULA) {
  doc.setLineWidth(espessura);
  doc.line(xEsq, y(yPdf), xDir, y(yPdf));
}

function linhaV(doc: jsPDF, x: number, yTopo: number, yBase: number, espessura = TRACO_CELULA) {
  doc.setLineWidth(espessura);
  doc.line(x, y(yTopo), x, y(yBase));
}

function caixa(doc: jsPDF, xEsq: number, xDir: number, yTopo: number, yBase: number) {
  doc.setLineWidth(TRACO_BORDA);
  doc.rect(xEsq, y(yTopo), xDir - xEsq, yTopo - yBase);
}

function numero(valor: number | null, casas = 1): string {
  return valor === null ? TRACO : valor.toFixed(casas).replace(".", ",");
}

function inteiro(valor: number | null): string {
  return valor === null ? TRACO : String(valor);
}


const RESULTADO_LABEL: Record<HistoricoAno["resultado"], string> = {
  aprovado: "Aprovado",
  reprovado: "Reprovado",
  cursando: "Cursando",
  transferido: "Transferido"
};

function desenharCabecalho(doc: jsPDF, dados: HistoricoData, opts: HistoricoPdfOptions) {
  const c = dados.credenciamento;
  texto(doc, c.nomeFantasia, MARGEM_ESQ, 810, 8, true);
  texto(doc, c.razaoSocial, MARGEM_ESQ, 798, 8);
  if (c.cnpj) texto(doc, `CNPJ: ${c.cnpj}`, MARGEM_ESQ, 786, 8);
  if (c.resolucao) texto(doc, c.resolucao, MARGEM_ESQ, 774, 8);
  if (c.endereco) texto(doc, c.endereco, MARGEM_ESQ, 762, 8);
  if (c.telefones) texto(doc, c.telefones, MARGEM_ESQ, 750, 8);
  if (c.email) texto(doc, c.email, MARGEM_ESQ, 738, 8);

  if (opts.logoDataUrl) {
    doc.addImage(opts.logoDataUrl, "PNG", 408.5, y(734 + 88), 157.6, 88);
  }

  textoCentro(doc, "HISTÓRICO ESCOLAR", 708, 14, true);
  textoCentro(doc, NIVEL_LABEL[dados.nivel], 692, 14, true);
}

/**
 * Bloco de identificação em caixa, como no modelo: três faixas (aluno, filiação,
 * documentos) com divisórias internas. Retorna o y da base para o próximo bloco.
 */
function desenharIdentificacao(doc: jsPDF, dados: HistoricoData): number {
  const a = dados.aluno;
  // Âncoras do modelo: os valores caem em 662 (aluno), 642 (filiação) e 622
  // (documentos); as faixas são desenhadas em volta deles.
  const topo = 678;
  const faixa1 = 658; // aluno | cpf | matrícula
  const faixa2 = 638; // filiação
  const base = 618; // nascimento | naturalidade | nacionalidade | rg | órgão | data

  const xCpf = 418.4;
  const xMatricula = 497.7;

  caixa(doc, MARGEM_ESQ, MARGEM_DIR, topo, base);
  linhaH(doc, MARGEM_ESQ, MARGEM_DIR, faixa1);
  linhaH(doc, MARGEM_ESQ, MARGEM_DIR, faixa2);
  linhaV(doc, xCpf, topo, faixa1);
  linhaV(doc, xMatricula, topo, faixa1);

  const campo = (rotulo: string, valor: string | null, x: number, yTopo: number) => {
    texto(doc, rotulo, x + 2, yTopo - 7, 6);
    texto(doc, valor ?? "", x + 2, yTopo - 16, 7, true);
  };

  campo("Aluno(a):", a.nome, MARGEM_ESQ, topo);
  campo("CPF:", a.cpf, xCpf, topo);
  campo("Matrícula:", a.matricula, xMatricula, topo);
  campo("Filiação:", a.filiacao, MARGEM_ESQ, faixa1);

  // Faixa de documentos: colunas de largura desigual, como no modelo.
  const docs: Array<[string, string | null, number]> = [
    ["Data de Nascimento:", formatarDataCurta(a.dataNascimento), MARGEM_ESQ],
    ["Naturalidade:", a.naturalidade, 101.3],
    ["Nacionalidade:", a.nacionalidade, 259.9],
    ["RG:", a.rg, 339.1],
    ["Orgão Expedidor:", a.orgaoExpedidor, xCpf],
    ["Data Expedição:", formatarDataCurta(a.dataExpedicao), xMatricula]
  ];
  docs.forEach(([rotulo, valor, x], i) => {
    if (i > 0) linhaV(doc, x, faixa2, base);
    campo(rotulo, valor, x, faixa2);
  });

  return base;
}

/** Geometria da grade: uma coluna por série do nível, mais rótulo e C.H. total. */
type GeometriaGrade = {
  xRotulo: number;
  xColuna: (i: number) => number;
  xFimColuna: (i: number) => number;
  xMeioColuna: (i: number) => number;
  larguraColuna: number;
  exibeCh: boolean;
  xChTotal: number;
  xFimGrade: number;
};

function geometria(dados: HistoricoData, colunas: string[]): GeometriaGrade {
  const exibeCh = NIVEL_EXIBE_CH[dados.nivel];
  const xRotulo = MARGEM_ESQ;
  // Rótulo de disciplina ocupa a primeira faixa; a C.H. total fecha à direita.
  // 124 alinha os centros de coluna com o modelo de referência.
  const xInicio = 124;
  const larguraChTotal = exibeCh ? 26 : 0;
  const xChTotal = MARGEM_DIR - larguraChTotal;
  const larguraColuna = (xChTotal - xInicio) / colunas.length;

  return {
    xRotulo,
    xColuna: (i) => xInicio + i * larguraColuna,
    xFimColuna: (i) => xInicio + (i + 1) * larguraColuna,
    xMeioColuna: (i) => xInicio + (i + 0.5) * larguraColuna,
    larguraColuna,
    exibeCh,
    xChTotal,
    xFimGrade: MARGEM_DIR
  };
}

/**
 * Grade de notas, desenhada de cima para baixo a partir de `yTopo`.
 * A altura é derivada do conteúdo — com 21 disciplinas o rodapé descia sobre
 * as linhas quando as âncoras eram fixas.
 * Retorna o y da base para o bloco seguinte.
 */
function desenharGrade(doc: jsPDF, dados: HistoricoData, yTopo: number): number {
  const colunas = COLUNAS_IMPRESSAS[dados.nivel];
  const g = geometria(dados, colunas);
  const linhas = montarGrade(dados.anos, colunas);

  const yTituloBase = yTopo - 4;
  textoCentro(
    doc,
    `RESULTADOS REALIZADOS NO ${NIVEL_LABEL[dados.nivel].toUpperCase()}`,
    yTituloBase + 4,
    8,
    true
  );

  // ─── Cabeçalho da grade ───────────────────────────────────────────────────
  const yCabTopo = yTituloBase;
  const ySerie = yCabTopo - 13; // faixa dos nomes de série
  const yCabBase = ySerie - 13; // faixa "Média / C.H."

  colunas.forEach((coluna, i) => {
    textoNaCelula(doc, rotuloDaColuna(coluna), g.xColuna(i), g.xFimColuna(i), ySerie + 4, 6.5, true);
    if (g.exibeCh) {
      const meio = g.xMeioColuna(i);
      textoNaCelula(doc, "Média", g.xColuna(i), meio, yCabBase + 4, 5.5, true);
      textoNaCelula(doc, "C.H.", meio, g.xFimColuna(i), yCabBase + 4, 5.5, true);
      linhaV(doc, meio, ySerie, yCabBase);
    } else {
      textoNaCelula(doc, "Média", g.xColuna(i), g.xFimColuna(i), yCabBase + 4, 6.5, true);
    }
  });

  textoNaCelula(doc, "Disciplinas", g.xRotulo, g.xColuna(0), yCabBase + 4, 7, true);
  if (g.exibeCh) {
    textoNaCelula(doc, "C.H.", g.xChTotal, g.xFimGrade, ySerie + 1, 5.5, true);
    textoNaCelula(doc, "Total", g.xChTotal, g.xFimGrade, yCabBase + 4, 5.5, true);
  }

  // ─── Linhas de disciplina ─────────────────────────────────────────────────
  const alturaLinha = 11;
  let yAtual = yCabBase;

  for (const linha of linhas) {
    const yBase = yAtual - alturaLinha;
    texto(doc, linha.disciplina, g.xRotulo + 2, yBase + 3, 6.5);
    linha.celulas.forEach((celula, i) => {
      if (g.exibeCh) {
        const meio = g.xMeioColuna(i);
        textoNaCelula(doc, numero(celula.nota), g.xColuna(i), meio, yBase + 3, 6.5, true);
        textoNaCelula(doc, inteiro(celula.cargaHoraria), meio, g.xFimColuna(i), yBase + 3, 6.5);
        linhaV(doc, meio, yAtual, yBase);
      } else {
        textoNaCelula(doc, numero(celula.nota), g.xColuna(i), g.xFimColuna(i), yBase + 3, 6.5, true);
      }
    });
    if (g.exibeCh) {
      textoNaCelula(doc, inteiro(linha.chTotal), g.xChTotal, g.xFimGrade, yBase + 3, 6.5, true);
    }
    linhaH(doc, MARGEM_ESQ, g.xFimGrade, yBase);
    yAtual = yBase;
  }

  // ─── Rodapé da grade: resultado, carga horária, dias letivos ──────────────
  const porColuna = new Map(dados.anos.map((a) => [a.serieNome, a]));
  const rodape: Array<[string, (a: HistoricoAno | undefined) => string]> = [
    ["Resultado Final", (a) => (a ? RESULTADO_LABEL[a.resultado] : TRACO)],
    ["Carga Horária Anual", (a) => inteiro(a?.cargaHoraria ?? null)],
    ["Dias Letivos", (a) => inteiro(a?.diasLetivos ?? null)]
  ];
  const chTotalAnual = dados.anos.reduce((acc, a) => acc + (a.cargaHoraria ?? 0), 0);

  for (const [rotulo, valor] of rodape) {
    const yBase = yAtual - alturaLinha;
    texto(doc, rotulo, g.xRotulo + 2, yBase + 3, 6.5, true);
    colunas.forEach((coluna, i) => {
      textoNaCelula(
        doc,
        valor(porColuna.get(coluna)),
        g.xColuna(i),
        g.xFimColuna(i),
        yBase + 3,
        6.5,
        true
      );
    });
    if (g.exibeCh && rotulo === "Carga Horária Anual" && chTotalAnual > 0) {
      textoNaCelula(doc, String(chTotalAnual), g.xChTotal, g.xFimGrade, yBase + 3, 6.5, true);
    }
    linhaH(doc, MARGEM_ESQ, g.xFimGrade, yBase);
    yAtual = yBase;
  }

  // ─── Réguas verticais e moldura, agora que a altura é conhecida ───────────
  linhaH(doc, MARGEM_ESQ, g.xFimGrade, ySerie);
  linhaH(doc, MARGEM_ESQ, g.xFimGrade, yCabBase);
  linhaV(doc, g.xColuna(0), yCabTopo, yAtual);
  colunas.forEach((_, i) => linhaV(doc, g.xFimColuna(i), yCabTopo, yAtual));
  if (g.exibeCh) linhaV(doc, g.xChTotal, yCabTopo, yAtual);
  caixa(doc, MARGEM_ESQ, g.xFimGrade, yCabTopo, yAtual);

  return yAtual;
}

/**
 * Tabela de estabelecimentos: uma linha por série do nível, com bordas.
 * Retorna o y da base.
 */
function desenharEstabelecimentos(doc: jsPDF, dados: HistoricoData, yTopo: number): number {
  const colunas = COLUNAS_IMPRESSAS[dados.nivel];
  const porSerie = new Map(dados.anos.map((a) => [a.serieNome, a]));

  const xSerie = MARGEM_ESQ;
  const xAno = 120.8;
  const xEstabelecimento = 170;
  const xCidade = 420;
  const xUf = 545;
  const divisorias = [xAno, xEstabelecimento, xCidade, xUf];

  const alturaLinha = 12;
  const yCabBase = yTopo - alturaLinha;

  textoNaCelula(doc, "Série", xSerie, xAno, yCabBase + 3, 7, true);
  textoNaCelula(doc, "Ano", xAno, xEstabelecimento, yCabBase + 3, 7, true);
  textoNaCelula(doc, "Estabelecimento", xEstabelecimento, xCidade, yCabBase + 3, 7, true);
  textoNaCelula(doc, "Cidade", xCidade, xUf, yCabBase + 3, 7, true);
  textoNaCelula(doc, "UF", xUf, MARGEM_DIR, yCabBase + 3, 7, true);
  linhaH(doc, MARGEM_ESQ, MARGEM_DIR, yCabBase);

  let yAtual = yCabBase;
  for (const coluna of colunas) {
    const ano = porSerie.get(coluna);
    const yBase = yAtual - alturaLinha;
    texto(doc, rotuloDaColuna(coluna), xSerie + 3, yBase + 3, 7);
    textoNaCelula(doc, ano ? String(ano.ano) : TRACO, xAno, xEstabelecimento, yBase + 3, 7);
    texto(doc, ano?.instituicao ?? TRACO, xEstabelecimento + 3, yBase + 3, 7);
    texto(doc, ano?.cidade ?? TRACO, xCidade + 3, yBase + 3, 7);
    textoNaCelula(doc, ano?.uf ?? TRACO, xUf, MARGEM_DIR, yBase + 3, 7);
    linhaH(doc, MARGEM_ESQ, MARGEM_DIR, yBase);
    yAtual = yBase;
  }

  for (const x of divisorias) linhaV(doc, x, yTopo, yAtual);
  caixa(doc, MARGEM_ESQ, MARGEM_DIR, yTopo, yAtual);

  return yAtual;
}

function desenharRodape(doc: jsPDF, dados: HistoricoData, opts: HistoricoPdfOptions) {
  const c = dados.credenciamento;
  const data = opts.dataEmissao ?? new Date();
  const dataTexto = data.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
  const cidade = c.cidade && c.uf ? `${c.cidade}-${c.uf}` : (c.cidade ?? "");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`${cidade}, ${dataTexto}.`, MARGEM_DIR, y(89), { align: "right" });

  const assinaturas: Array<[string | null, string, number]> = [
    [c.secretarioNome, c.secretarioCargo, 160],
    [c.diretorNome, c.diretorCargo, 434]
  ];

  for (const [nome, cargo, centro] of assinaturas) {
    doc.setLineWidth(0.5);
    doc.line(centro - 125, y(48), centro + 125, y(48));
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(nome ?? "", centro, y(39), { align: "center" });
    doc.setFontSize(8);
    doc.text(cargo, centro, y(29), { align: "center" });
  }
}

/**
 * Preview e emissão chamam esta mesma função: o que se vê é o que sai.
 * Uma página por aluno. Os blocos encadeiam pela base do anterior, então uma
 * grade longa empurra o resto para baixo em vez de escrever por cima dele.
 */
export function renderHistoricos(
  alunos: HistoricoData[],
  opts: HistoricoPdfOptions = {}
): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });

  alunos.forEach((dados, i) => {
    if (i > 0) doc.addPage();
    desenharCabecalho(doc, dados, opts);
    const yIdentificacao = desenharIdentificacao(doc, dados);
    const yGrade = desenharGrade(doc, dados, yIdentificacao - 10);
    // A tabela de estabelecimentos fica ancorada na parte baixa da página, como
    // no modelo; só desce mais quando uma grade longa avança sobre ela.
    desenharEstabelecimentos(doc, dados, Math.min(Y_ESTABELECIMENTOS, yGrade - 14));
    desenharRodape(doc, dados, opts);
  });

  return doc;
}
