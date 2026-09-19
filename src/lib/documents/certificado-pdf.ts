import jsPDF from "jspdf";
import { dataLocalDeIso, formatarDataExtenso, montarCorpo, type Segmento } from "./certificado-texto";
import { renderHistoricos } from "./historico-pdf";
import { imgFitInBox } from "./pdf-utils";
import type { CertificadoData, CertificadoOptions } from "./certificado-tipos";
import type { HistoricoData } from "@/lib/historico/tipos";

export type ImagemCache = Map<string, { data: string; w: number; h: number }>;

/**
 * O documento nasce em pontos, não em milímetros. O histórico escolar do verso
 * é desenhado com as coordenadas do modelo de referência em pontos (x até 573,
 * y até 842) e jsPDF fixa a unidade na criação: num documento em milímetros
 * aquelas coordenadas seriam lidas como 573mm, três vezes fora da página.
 *
 * O certificado ainda não tem layout travado, então é ele que se adapta: a
 * secretária configura margem em mm e o gerador converte.
 */
const PT_POR_MM = 72 / 25.4;
const mm = (valor: number) => valor * PT_POR_MM;

const COR_TEXTO: [number, number, number] = [0, 0, 0];

/** Fonte do certificado: documento oficial impresso, fora do DS da aplicação. */
const FONTE = "times";

function renderMoldura(doc: jsPDF, opts: CertificadoOptions): void {
  if (!opts.leiaute.mostrarMoldura) return;
  const margem = mm(opts.leiaute.margemMm) / 2;
  doc.setDrawColor(...COR_TEXTO);
  doc.setLineWidth(2);
  doc.rect(
    margem,
    margem,
    doc.internal.pageSize.getWidth() - margem * 2,
    doc.internal.pageSize.getHeight() - margem * 2
  );
}

function renderCabecalho(
  doc: jsPDF,
  yInicial: number,
  data: CertificadoData,
  opts: CertificadoOptions,
  imagens: ImagemCache
): number {
  const centro = doc.internal.pageSize.getWidth() / 2;
  let y = yInicial;

  const logo = data.escola.logoPath ? imagens.get(data.escola.logoPath) : undefined;
  if (opts.leiaute.mostrarLogos && logo) {
    const caixa = imgFitInBox(logo, mm(55), mm(20));
    doc.addImage(logo.data, "PNG", centro - caixa.w / 2, y, caixa.w, caixa.h, undefined, "FAST");
    y += caixa.h + 8;
  }

  doc.setTextColor(...COR_TEXTO);
  doc.setFont(FONTE, "bold");
  doc.setFontSize(13);
  doc.text(data.escola.nomeFantasia, centro, y, { align: "center" });
  y += 14;

  doc.setFont(FONTE, "normal");
  doc.setFontSize(8);
  const cidadeUf =
    data.escola.cidade && data.escola.uf
      ? `${data.escola.cidade} - ${data.escola.uf}`
      : data.escola.cidade ?? data.escola.uf;

  // Linha ausente é omitida, não deixa espaço vazio no cabeçalho.
  const linhas = [
    data.escola.cnpj ? `CNPJ: ${data.escola.cnpj}` : null,
    data.escola.resolucao,
    data.escola.endereco,
    [cidadeUf, data.escola.cep ? `CEP: ${data.escola.cep}` : null].filter(Boolean).join(" · ")
  ].filter((l): l is string => Boolean(l && l.trim()));

  for (const linha of linhas) {
    doc.text(linha, centro, y, { align: "center" });
    y += 10;
  }

  return y;
}

function renderTitulo(doc: jsPDF, yInicial: number, opts: CertificadoOptions): number {
  const centro = doc.internal.pageSize.getWidth() / 2;
  doc.setFont(FONTE, "normal");
  doc.setFontSize(34);
  doc.text(opts.tituloCertificado, centro, yInicial + 34, { align: "center" });
  return yInicial + 52;
}

type Palavra = { texto: string; negrito: boolean; largura: number };

/** Mede cada palavra com a fonte do seu segmento — jsPDF não tem rich text. */
function medirPalavras(doc: jsPDF, segmentos: Segmento[], tamanho: number): Palavra[] {
  doc.setFontSize(tamanho);
  const palavras: Palavra[] = [];

  for (const seg of segmentos) {
    doc.setFont(FONTE, seg.negrito ? "bold" : "normal");
    for (const bruta of seg.texto.split(" ")) {
      if (bruta === "") continue;
      palavras.push({ texto: bruta, negrito: seg.negrito, largura: doc.getTextWidth(bruta) });
    }
  }

  return palavras;
}

function quebrarLinhas(palavras: Palavra[], util: number, larguraEspaco: number): Palavra[][] {
  const linhas: Palavra[][] = [];
  let atual: Palavra[] = [];
  let largura = 0;

  for (const palavra of palavras) {
    const espaco = atual.length === 0 ? 0 : larguraEspaco;
    if (atual.length > 0 && largura + espaco + palavra.largura > util) {
      linhas.push(atual);
      atual = [palavra];
      largura = palavra.largura;
    } else {
      atual.push(palavra);
      largura += espaco + palavra.largura;
    }
  }

  if (atual.length > 0) linhas.push(atual);
  return linhas;
}

/**
 * Parágrafo justificado, palavra a palavra. A sobra de cada linha é distribuída
 * nos vãos; a última fica alinhada à esquerda, porque justificá-la abriria o
 * vão gigante clássico quando ela tem poucas palavras.
 */
function renderCorpo(
  doc: jsPDF,
  yInicial: number,
  segmentos: Segmento[],
  opts: CertificadoOptions
): number {
  const margem = mm(opts.leiaute.margemMm);
  const util = doc.internal.pageSize.getWidth() - margem * 2;
  const tamanho = opts.leiaute.fonteCorpoPt;
  const alturaLinha = tamanho * 1.9;

  doc.setTextColor(...COR_TEXTO);
  const palavras = medirPalavras(doc, segmentos, tamanho);

  doc.setFont(FONTE, "normal");
  const larguraEspaco = doc.getTextWidth(" ");
  const linhas = quebrarLinhas(palavras, util, larguraEspaco);

  let y = yInicial;
  linhas.forEach((linha, i) => {
    const somaPalavras = linha.reduce((soma, p) => soma + p.largura, 0);
    const vaos = linha.length - 1;
    const ultima = i === linhas.length - 1;
    const espaco = ultima || vaos === 0 ? larguraEspaco : (util - somaPalavras) / vaos;

    let x = margem;
    for (const palavra of linha) {
      doc.setFont(FONTE, palavra.negrito ? "bold" : "normal");
      doc.text(palavra.texto, x, y);
      x += palavra.largura + espaco;
    }
    y += alturaLinha;
  });

  return y;
}

function renderDataLocal(
  doc: jsPDF,
  yInicial: number,
  data: CertificadoData,
  opts: CertificadoOptions
): number {
  const margem = mm(opts.leiaute.margemMm);
  const direita = doc.internal.pageSize.getWidth() - margem;
  const cidade = data.escola.cidade?.trim();
  const dataExtenso = formatarDataExtenso(opts.dataEmissao);
  const texto = cidade ? `${cidade}, ${dataExtenso}` : dataExtenso;

  doc.setFont(FONTE, "normal");
  doc.setFontSize(opts.leiaute.fonteCorpoPt);
  doc.text(texto, direita, yInicial + 24, { align: "right" });
  return yInicial + 40;
}

function renderAssinaturas(doc: jsPDF, yInicial: number, opts: CertificadoOptions): void {
  const assinaturas = opts.assinaturas.filter((a) => a.nome.trim() || a.cargo.trim());
  if (assinaturas.length === 0) return;

  const margem = mm(opts.leiaute.margemMm);
  const util = doc.internal.pageSize.getWidth() - margem * 2;
  const larguraColuna = util / assinaturas.length;
  const larguraLinha = Math.min(larguraColuna - mm(8), mm(75));

  assinaturas.forEach((assinatura, i) => {
    const centro = margem + larguraColuna * i + larguraColuna / 2;

    doc.setDrawColor(...COR_TEXTO);
    doc.setLineWidth(0.7);
    doc.line(centro - larguraLinha / 2, yInicial, centro + larguraLinha / 2, yInicial);

    doc.setFont(FONTE, "bold");
    doc.setFontSize(9);
    let y = yInicial + 11;
    // splitTextToSize quebra nome longo em vez de invadir a coluna vizinha.
    for (const linha of doc.splitTextToSize(assinatura.nome.toUpperCase(), larguraLinha) as string[]) {
      doc.text(linha, centro, y, { align: "center" });
      y += 10;
    }

    doc.setFont(FONTE, "normal");
    doc.setFontSize(8.5);
    doc.text(assinatura.cargo, centro, y, { align: "center" });
  });
}

function renderPaginaCertificado(
  doc: jsPDF,
  data: CertificadoData,
  opts: CertificadoOptions,
  imagens: ImagemCache
): void {
  const margem = mm(opts.leiaute.margemMm);
  const alturaPagina = doc.internal.pageSize.getHeight();

  renderMoldura(doc, opts);
  let y = renderCabecalho(doc, margem + 12, data, opts, imagens);
  y = renderTitulo(doc, y, opts);
  y = renderCorpo(doc, y + 16, montarCorpo(data, opts), opts);
  y = renderDataLocal(doc, y, data, opts);

  // Assinaturas ancoradas ao rodapé; um corpo longo as empurra para baixo do
  // texto em vez de deixar o texto escrever por cima delas.
  const alturaBloco = mm(22);
  renderAssinaturas(doc, Math.max(y + 16, alturaPagina - margem - alturaBloco), opts);
}

/**
 * Preview e emissão chamam esta mesma função: o que se vê é o que sai.
 *
 * Uma página de certificado (paisagem) por aluno. Com `mostrarHistorico` e um
 * histórico no mapa, o verso é o histórico escolar já existente, em retrato,
 * desenhado por `renderHistoricos` sem redesenhar nada — é o mesmo documento
 * que sai por `/historico/emissao`.
 *
 * Síncrona, como `renderHistoricos`: as imagens chegam já baixadas no cache,
 * porque quem chama controla o download e o ambiente node dos testes não tem
 * `fetch` de imagem nem `Image`.
 */
export function renderCertificados(
  alunos: CertificadoData[],
  opts: CertificadoOptions,
  historicos: Map<string, HistoricoData> = new Map(),
  imagens: ImagemCache = new Map()
): jsPDF {
  const doc = new jsPDF({ orientation: opts.leiaute.orientacao, unit: "pt", format: "a4" });

  // Lista vazia devolve a página em branco que o construtor já criou: o preview
  // mostra uma folha vazia em vez de estourar.
  alunos.forEach((data, i) => {
    if (i > 0) doc.addPage("a4", opts.leiaute.orientacao);
    renderPaginaCertificado(doc, data, opts, imagens);

    const historico = historicos.get(data.aluno.id);
    if (opts.mostrarHistorico && historico) {
      // `dataLocalDeIso`, não `new Date(iso)`: o construtor lê a string como
      // UTC e o verso sairia com a data de ontem em fuso negativo.
      renderHistoricos([historico], { dataEmissao: dataLocalDeIso(opts.dataEmissao) }, doc);
    }
  });

  return doc;
}
