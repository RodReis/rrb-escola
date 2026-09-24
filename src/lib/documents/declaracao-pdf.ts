import jsPDF from "jspdf";
import { medirAlturaCorpo, renderCorpo } from "./pdf-paragrafo";
import { imgFitInBox } from "./pdf-utils";
import type { Segmento } from "./certificado-texto";
import type { HistoricoCredenciamento } from "@/lib/historico/tipos";

export type ImagemCache = Map<string, { data: string; w: number; h: number }>;

export type DeclaracaoPdfDados = {
  credenciamento: HistoricoCredenciamento;
  titulo: string;
  corpo: string;
  fecho: string;
};

const PT_POR_MM = 72 / 25.4;
const mm = (valor: number) => valor * PT_POR_MM;
const MARGEM_MM = 20;
const FONTE = "times";

/** Logo padrão quando a company não tem logo_path — mesmo arquivo usado por
 * histórico e certificado, para as 3 impressões oficiais serem consistentes. */
const LOGO_PADRAO_PATH = "/historico/logo-epg.png";

function renderImagemCentralizada(
  doc: jsPDF,
  centroX: number,
  yInicial: number,
  imagem: { data: string; w: number; h: number } | undefined,
  maxW: number,
  maxH: number
): number {
  if (!imagem) return yInicial;
  const caixa = imgFitInBox(imagem, maxW, maxH);
  const formato = imagem.data.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
  doc.addImage(imagem.data, formato, centroX - caixa.w / 2, yInicial, caixa.w, caixa.h, undefined, "FAST");
  return yInicial + caixa.h;
}

/** Cabeçalho de 1 coluna (logo + dados da empresa) — diferente do
 * certificado (3 colunas com brasões), porque a declaração não é um
 * documento com brasão nacional. */
function renderCabecalho(doc: jsPDF, yInicial: number, c: HistoricoCredenciamento, imagens: ImagemCache): number {
  const centro = doc.internal.pageSize.getWidth() / 2;
  let y = yInicial;

  const logo = imagens.get(c.logoPath ?? LOGO_PADRAO_PATH) ?? imagens.get(LOGO_PADRAO_PATH);
  if (logo) {
    y = renderImagemCentralizada(doc, centro, y, logo, mm(70), mm(28)) + 8;
  }

  doc.setTextColor(0, 0, 0);
  doc.setFont(FONTE, "bold");
  doc.setFontSize(13);
  if (c.nomeFantasia) {
    doc.text(c.nomeFantasia, centro, y, { align: "center" });
    y += 14;
  }

  doc.setFont(FONTE, "normal");
  doc.setFontSize(8);
  const cidadeUf = c.cidade && c.uf ? `${c.cidade} - ${c.uf}` : c.cidade ?? c.uf;
  const linhas = [
    c.cnpj ? `CNPJ: ${c.cnpj}` : null,
    c.endereco,
    [cidadeUf, c.cep ? `CEP: ${c.cep}` : null].filter(Boolean).join(" · ")
  ].filter((l): l is string => Boolean(l && l.trim()));

  for (const linha of linhas) {
    doc.text(linha, centro, y, { align: "center" });
    y += 10;
  }

  return y + 16;
}

function renderTitulo(doc: jsPDF, yInicial: number, titulo: string): number {
  const centro = doc.internal.pageSize.getWidth() / 2;
  doc.setFont(FONTE, "bold");
  doc.setFontSize(16);
  doc.text(titulo, centro, yInicial, { align: "center" });
  return yInicial + 24;
}

function renderFecho(doc: jsPDF, yInicial: number, fecho: string, margemPt: number): number {
  doc.setFont(FONTE, "normal");
  doc.setFontSize(11);
  const util = doc.internal.pageSize.getWidth() - margemPt * 2;
  const linhas = doc.splitTextToSize(fecho, util) as string[];
  let y = yInicial;
  for (const linha of linhas) {
    doc.text(linha, margemPt, y);
    y += 15;
  }
  return y;
}

/** Secretário + Diretor, mesmo padrão de 2 colunas usado no histórico
 * escolar — mesmas duas assinaturas fixas, sem config por escola. */
function renderAssinaturas(doc: jsPDF, yInicial: number, c: HistoricoCredenciamento, margemPt: number): void {
  const assinaturas = [
    { nome: c.secretarioNome, cargo: c.secretarioCargo },
    { nome: c.diretorNome, cargo: c.diretorCargo }
  ].filter((a) => a.nome?.trim());
  if (assinaturas.length === 0) return;

  const util = doc.internal.pageSize.getWidth() - margemPt * 2;
  const larguraColuna = util / assinaturas.length;
  const larguraLinha = Math.min(larguraColuna - mm(8), mm(75));

  assinaturas.forEach((a, i) => {
    const centro = margemPt + larguraColuna * i + larguraColuna / 2;

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.7);
    doc.line(centro - larguraLinha / 2, yInicial, centro + larguraLinha / 2, yInicial);

    doc.setFont(FONTE, "bold");
    doc.setFontSize(9);
    let y = yInicial + 11;
    for (const linha of doc.splitTextToSize((a.nome ?? "").toUpperCase(), larguraLinha) as string[]) {
      doc.text(linha, centro, y, { align: "center" });
      y += 10;
    }

    doc.setFont(FONTE, "normal");
    doc.setFontSize(8.5);
    doc.text(a.cargo, centro, y, { align: "center" });
  });
}

function renderPagina(doc: jsPDF, dados: DeclaracaoPdfDados, imagens: ImagemCache): void {
  const margem = mm(MARGEM_MM);
  const alturaPagina = doc.internal.pageSize.getHeight();

  const yTopo = renderCabecalho(doc, margem + 12, dados.credenciamento, imagens);
  let y = renderTitulo(doc, yTopo + 20, dados.titulo);

  const segmentos: Segmento[] = [{ texto: dados.corpo, negrito: false }];
  const opcoesParagrafo = { fonte: FONTE, fonteCorpoPt: 11, margemPt: margem };
  y = renderCorpo(doc, y + 20, segmentos, opcoesParagrafo);
  y = renderFecho(doc, y + 24, dados.fecho, margem);

  const alturaBlocoAssinaturas = mm(22);
  const yAssinaturas = alturaPagina - margem - alturaBlocoAssinaturas;
  renderAssinaturas(doc, Math.max(y + 30, yAssinaturas), dados.credenciamento, margem);
}

/**
 * Uma página (retrato) por item da lista — cada item é um aluno, na emissão
 * em lote por série/turma. Lista vazia devolve a página em branco que o
 * construtor já cria, mesmo padrão de `renderCertificados`.
 */
export function renderDeclaracoes(paginas: DeclaracaoPdfDados[], imagens: ImagemCache): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  paginas.forEach((dados, i) => {
    if (i > 0) doc.addPage("a4", "portrait");
    renderPagina(doc, dados, imagens);
  });

  return doc;
}
