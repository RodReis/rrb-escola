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

/**
 * Página A4 em paisagem — o modelo de referência (verso do certificado de
 * conclusão, e a própria emissão avulsa) usa a folha deitada, não em pé: dá
 * a largura que a caixa de REGISTRO à direita e a grade de 3 séries lado a
 * lado precisam.
 */
const PAGINA = { largura: 842, altura: 595 };
const MARGEM_ESQ = 14;
/** Fim do conteúdo principal — a coluna REGISTRO ocupa o que sobra até a
 * margem direita real da página. */
const MARGEM_DIR = 590;
const REGISTRO_X = 605;
const REGISTRO_DIR = 828;
const TRACO = "-";

/**
 * Topo da tabela de estabelecimentos no modelo de referência. A grade de notas
 * só empurra este bloco para baixo quando o aluno tem disciplinas demais.
 */
const Y_ESTABELECIMENTOS = 210;

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
  // Bug corrigido: o Médio imprimia o ciclo inteiro (12 colunas, 1º ANO ao
  // 9º + as 3 séries), contradizendo o comentário acima e o modelo oficial
  // (CERTIFICADO.pdf), que mostra só as 3 colunas do próprio Médio.
  medio: SERIES_POR_NIVEL.medio
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
  textoCentroEm(doc, str, MARGEM_ESQ, MARGEM_DIR, yPdf, tamanho, bold);
}

/** Texto centrado numa faixa horizontal arbitrária — usa fora da grade, como
 * no cabeçalho da coluna REGISTRO. */
function textoCentroEm(
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
  // Título alinhado à esquerda, como no modelo — não centralizado na largura
  // do conteúdo principal.
  texto(doc, "HISTÓRICO ESCOLAR", MARGEM_ESQ, 571, 13, true);
  texto(doc, NIVEL_LABEL[dados.nivel], MARGEM_ESQ, 561, 9, true);

  const a = dados.aluno;
  texto(doc, `O(A) aluno(a) ${a.nome} — ${dados.credenciamento.nomeFantasia}`, MARGEM_ESQ, 550, 8);

  if (opts.logoDataUrl) {
    doc.addImage(opts.logoDataUrl, "PNG", MARGEM_DIR - 110, y(578 + 46), 110, 46);
  }
}

/**
 * Bloco de identificação em caixa, como no modelo: três faixas (aluno, filiação,
 * documentos) com divisórias internas. Retorna o y da base para o próximo bloco.
 */
function desenharIdentificacao(doc: jsPDF, dados: HistoricoData, yTopo: number): number {
  const a = dados.aluno;
  const faixa1 = yTopo - 20; // aluno | cpf | matrícula
  const faixa2 = faixa1 - 20; // filiação
  const base = faixa2 - 20; // nascimento | naturalidade | nacionalidade | rg | órgão | data

  const xCpf = MARGEM_ESQ + (MARGEM_DIR - MARGEM_ESQ) * 0.68;
  const xMatricula = MARGEM_ESQ + (MARGEM_DIR - MARGEM_ESQ) * 0.85;

  caixa(doc, MARGEM_ESQ, MARGEM_DIR, yTopo, base);
  linhaH(doc, MARGEM_ESQ, MARGEM_DIR, faixa1);
  linhaH(doc, MARGEM_ESQ, MARGEM_DIR, faixa2);
  linhaV(doc, xCpf, yTopo, faixa1);
  linhaV(doc, xMatricula, yTopo, faixa1);

  const campo = (rotulo: string, valor: string | null, x: number, yFaixaTopo: number) => {
    texto(doc, rotulo, x + 2, yFaixaTopo - 7, 6);
    texto(doc, valor ?? "", x + 2, yFaixaTopo - 16, 7, true);
  };

  campo("Aluno(a):", a.nome, MARGEM_ESQ, yTopo);
  campo("CPF:", a.cpf, xCpf, yTopo);
  campo("Matrícula:", a.matricula, xMatricula, yTopo);
  campo("Filiação:", a.filiacao, MARGEM_ESQ, faixa1);

  // Faixa de documentos: colunas de largura desigual, como no modelo.
  const larguraUtil = MARGEM_DIR - MARGEM_ESQ;
  const docs: Array<[string, string | null, number]> = [
    ["Data de Nascimento:", formatarDataCurta(a.dataNascimento), MARGEM_ESQ],
    ["Naturalidade:", a.naturalidade, MARGEM_ESQ + larguraUtil * 0.14],
    ["Nacionalidade:", a.nacionalidade, MARGEM_ESQ + larguraUtil * 0.34],
    ["RG:", a.rg, MARGEM_ESQ + larguraUtil * 0.5],
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
  const xInicio = MARGEM_ESQ + 155;
  const larguraChTotal = exibeCh ? 34 : 0;
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
 * A altura é derivada do conteúdo — com muitas disciplinas o rodapé desceria
 * sobre as linhas se as âncoras fossem fixas.
 * Retorna o y da base para o bloco seguinte.
 */
function desenharGrade(doc: jsPDF, dados: HistoricoData, yTopo: number): number {
  const colunas = COLUNAS_IMPRESSAS[dados.nivel];
  const g = geometria(dados, colunas);
  const linhas = montarGrade(dados.anos, colunas);

  const yTituloBase = yTopo - 4;
  textoCentroEm(
    doc,
    `RESULTADOS REALIZADOS NO ${NIVEL_LABEL[dados.nivel].toUpperCase()}`,
    MARGEM_ESQ,
    MARGEM_DIR,
    yTituloBase + 4,
    8,
    true
  );

  // ─── Cabeçalho da grade ───────────────────────────────────────────────────
  const yCabTopo = yTituloBase;
  const ySerie = yCabTopo - 13; // faixa dos nomes de série
  const yCabBase = ySerie - 13; // faixa "Média / C.H."

  colunas.forEach((coluna, i) => {
    textoNaCelula(doc, rotuloDaColuna(coluna), g.xColuna(i), g.xFimColuna(i), ySerie + 4, 7, true);
    if (g.exibeCh) {
      const meio = g.xMeioColuna(i);
      textoNaCelula(doc, "Média", g.xColuna(i), meio, yCabBase + 4, 6, true);
      textoNaCelula(doc, "C.H.", meio, g.xFimColuna(i), yCabBase + 4, 6, true);
      linhaV(doc, meio, ySerie, yCabBase);
    } else {
      textoNaCelula(doc, "Média", g.xColuna(i), g.xFimColuna(i), yCabBase + 4, 7, true);
    }
  });

  textoNaCelula(doc, "Disciplinas", g.xRotulo, g.xColuna(0), yCabBase + 4, 7.5, true);
  if (g.exibeCh) {
    textoNaCelula(doc, "C.H.", g.xChTotal, g.xFimGrade, ySerie + 1, 6, true);
    textoNaCelula(doc, "Total", g.xChTotal, g.xFimGrade, yCabBase + 4, 6, true);
  }

  // ─── Linhas de disciplina ─────────────────────────────────────────────────
  const alturaLinha = 12;
  let yAtual = yCabBase;

  for (const linha of linhas) {
    const yBase = yAtual - alturaLinha;
    texto(doc, linha.disciplina, g.xRotulo + 2, yBase + 3, 7);
    linha.celulas.forEach((celula, i) => {
      if (g.exibeCh) {
        const meio = g.xMeioColuna(i);
        textoNaCelula(doc, numero(celula.nota), g.xColuna(i), meio, yBase + 3, 7, true);
        textoNaCelula(doc, inteiro(celula.cargaHoraria), meio, g.xFimColuna(i), yBase + 3, 7);
        linhaV(doc, meio, yAtual, yBase);
      } else {
        textoNaCelula(doc, numero(celula.nota), g.xColuna(i), g.xFimColuna(i), yBase + 3, 7, true);
      }
    });
    if (g.exibeCh) {
      textoNaCelula(doc, inteiro(linha.chTotal), g.xChTotal, g.xFimGrade, yBase + 3, 7, true);
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
    texto(doc, rotulo, g.xRotulo + 2, yBase + 3, 7, true);
    colunas.forEach((coluna, i) => {
      textoNaCelula(
        doc,
        valor(porColuna.get(coluna)),
        g.xColuna(i),
        g.xFimColuna(i),
        yBase + 3,
        7,
        true
      );
    });
    if (g.exibeCh && rotulo === "Carga Horária Anual" && chTotalAnual > 0) {
      textoNaCelula(doc, String(chTotalAnual), g.xChTotal, g.xFimGrade, yBase + 3, 7, true);
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

  const larguraUtil = MARGEM_DIR - MARGEM_ESQ;
  const xSerie = MARGEM_ESQ;
  const xAno = MARGEM_ESQ + larguraUtil * 0.15;
  const xEstabelecimento = MARGEM_ESQ + larguraUtil * 0.22;
  const xCidade = MARGEM_ESQ + larguraUtil * 0.75;
  const xUf = MARGEM_ESQ + larguraUtil * 0.92;
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

/**
 * Bloco "Observações", em caixa, com o texto livre cadastrado no histórico.
 * Sem observações o bloco não é desenhado — não deixa moldura vazia na
 * página. Retorna o y da base (igual a `yTopo` quando não há nada a imprimir).
 */
function desenharObservacoes(doc: jsPDF, dados: HistoricoData, yTopo: number): number {
  const texto = dados.observacoes?.trim();
  if (!texto) return yTopo;

  const larguraUtil = MARGEM_DIR - MARGEM_ESQ - 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  const linhas = doc.splitTextToSize(texto, larguraUtil) as string[];

  const alturaTitulo = 14;
  const alturaLinha = 9;
  const alturaCaixa = alturaTitulo + linhas.length * alturaLinha + 6;
  const base = yTopo - alturaCaixa;

  caixa(doc, MARGEM_ESQ, MARGEM_DIR, yTopo, base);
  textoCentroEm(doc, "Observações", MARGEM_ESQ, MARGEM_DIR, yTopo - 10, 7.5, true);
  linhaH(doc, MARGEM_ESQ, MARGEM_DIR, yTopo - alturaTitulo);

  let yLinha = yTopo - alturaTitulo - 8;
  for (const linha of linhas) {
    doc.text(linha, MARGEM_ESQ + 3, y(yLinha));
    yLinha -= alturaLinha;
  }

  return base;
}

function desenharRodape(doc: jsPDF, dados: HistoricoData, opts: HistoricoPdfOptions) {
  const c = dados.credenciamento;
  const data = opts.dataEmissao ?? new Date();
  const dataTexto = data.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
  const cidade = c.cidade && c.uf ? `${c.cidade}-${c.uf}` : (c.cidade ?? "");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${cidade}, ${dataTexto}.`, MARGEM_DIR, y(30), { align: "right" });
}

/**
 * Caixa "REGISTRO" na coluna direita, ao lado da grade: identificação da
 * escola emissora, base legal, campos de registro/livro/folha para
 * preenchimento manual e as duas assinaturas (secretaria e direção).
 * Ocupa toda a altura útil da página — desenhada uma vez por página, não
 * encadeada com o resto do conteúdo.
 */
function desenharRegistro(doc: jsPDF, dados: HistoricoData, opts: HistoricoPdfOptions) {
  const c = dados.credenciamento;
  const topo = 578;
  const base = 24;

  caixa(doc, REGISTRO_X, REGISTRO_DIR, topo, base);

  let yAtual = 545;
  textoCentroEm(doc, "REGISTRO", REGISTRO_X, REGISTRO_DIR, yAtual, 11, true);
  yAtual -= 14;
  textoCentroEm(doc, "ESTADO DE GOIÁS", REGISTRO_X, REGISTRO_DIR, yAtual, 8, true);
  yAtual -= 12;
  textoCentroEm(doc, "SECRETARIA DA EDUCAÇÃO", REGISTRO_X, REGISTRO_DIR, yAtual, 8, true);
  yAtual -= 12;
  textoCentroEm(doc, c.nomeFantasia, REGISTRO_X, REGISTRO_DIR, yAtual, 8, true);

  yAtual -= 26;
  const larguraTexto = REGISTRO_DIR - REGISTRO_X - 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const baseLegal = c.resolucao
    ? `Documento expedido conforme Lei nº 9394/96 e ${c.resolucao}.`
    : "Documento expedido conforme Lei nº 9394/96.";
  for (const linha of doc.splitTextToSize(baseLegal, larguraTexto) as string[]) {
    doc.text(linha, REGISTRO_X + 6, y(yAtual));
    yAtual -= 10;
  }

  yAtual -= 10;
  for (const linha of doc.splitTextToSize(
    "Declaramos a autenticidade e regularidade do presente documento. Registro nº______",
    larguraTexto
  ) as string[]) {
    doc.text(linha, REGISTRO_X + 6, y(yAtual));
    yAtual -= 10;
  }

  yAtual -= 8;
  doc.text("Livro nº _____________Fls nº __________", REGISTRO_X + 6, y(yAtual));

  yAtual -= 26;
  const dataEmissao = opts.dataEmissao ?? new Date();
  const dataTexto = dataEmissao.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  const cidadeTexto = c.cidade ? `${c.cidade}, ${dataTexto}` : dataTexto;
  doc.setFont("helvetica", "bold");
  doc.text(cidadeTexto, (REGISTRO_X + REGISTRO_DIR) / 2, y(yAtual), { align: "center" });

  const centroAssinatura = (REGISTRO_X + REGISTRO_DIR) / 2;
  const larguraLinha = larguraTexto - 20;

  const assinaturas: Array<[string | null, string, number]> = [
    [c.secretarioNome, c.secretarioCargo, 200],
    [c.diretorNome, c.diretorCargo, 96]
  ];

  for (const [nome, cargo, yLinha] of assinaturas) {
    doc.setLineWidth(0.5);
    doc.line(centroAssinatura - larguraLinha / 2, y(yLinha), centroAssinatura + larguraLinha / 2, y(yLinha));
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    // Nome longo quebra em mais de uma linha — sem incrementar y a cada
    // linha, todas eram escritas na mesma posição e ficavam embolando o
    // texto uma em cima da outra.
    let yNome = yLinha - 13;
    for (const linha of doc.splitTextToSize(nome ?? "", larguraLinha) as string[]) {
      doc.text(linha, centroAssinatura, y(yNome), { align: "center" });
      yNome -= 9;
    }
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text(cargo, centroAssinatura, y(yNome - 1), { align: "center" });
  }
}

/**
 * Preview e emissão chamam esta mesma função: o que se vê é o que sai.
 * Uma página por aluno, em paisagem. Os blocos encadeiam pela base do
 * anterior, então uma grade longa empurra o resto para baixo em vez de
 * escrever por cima dele.
 *
 * `docExterno` permite anexar o histórico a um documento que já tem páginas —
 * é como o certificado de conclusão imprime o histórico no verso. Nesse modo
 * cada aluno abre a própria página, inclusive o primeiro, porque a página
 * corrente pertence a quem chamou.
 *
 * O documento precisa estar em `pt`: as coordenadas abaixo vêm do modelo de
 * referência em pontos.
 */
export function renderHistoricos(
  alunos: HistoricoData[],
  opts: HistoricoPdfOptions = {},
  docExterno?: jsPDF
): jsPDF {
  const doc = docExterno ?? new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });

  alunos.forEach((dados, i) => {
    // Sem doc externo a primeira página já existe (o construtor a cria).
    if (docExterno || i > 0) doc.addPage("a4", "landscape");
    desenharCabecalho(doc, dados, opts);
    desenharRegistro(doc, dados, opts);
    const yIdentificacao = desenharIdentificacao(doc, dados, 545);
    const yGrade = desenharGrade(doc, dados, yIdentificacao - 10);
    // A tabela de estabelecimentos fica ancorada na parte baixa da página, como
    // no modelo; só desce mais quando uma grade longa avança sobre ela.
    const yEstabelecimentos = desenharEstabelecimentos(doc, dados, Math.min(Y_ESTABELECIMENTOS, yGrade - 14));
    desenharObservacoes(doc, dados, yEstabelecimentos - 8);
    desenharRodape(doc, dados, opts);
  });

  return doc;
}
