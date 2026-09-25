import jsPDF from "jspdf";
import { dataLocalDeIso, formatarDataExtenso, montarCorpo } from "./certificado-texto";
import { renderHistoricos } from "./historico-pdf";
import { imgFitInBox } from "./pdf-utils";
import { medirAlturaCorpo, renderCorpo } from "./pdf-paragrafo";
import type { CertificadoData, CertificadoOptions } from "./certificado-tipos";
import type { HistoricoData } from "@/lib/historico/tipos";
import { companyLogoUrl } from "@/lib/storage/company-logo-url";

export type ImagemCache = Map<string, { data: string; w: number; h: number }>;

/**
 * O documento nasce em pontos, não em milímetros. O histórico escolar do verso
 * é desenhado com as coordenadas do modelo de referência em pontos (página
 * 842×595, paisagem) e jsPDF fixa a unidade na criação: num documento em
 * milímetros aquelas coordenadas seriam lidas em mm, bem fora da página.
 *
 * O certificado ainda não tem layout travado, então é ele que se adapta: a
 * secretária configura margem em mm e o gerador converte.
 */
const PT_POR_MM = 72 / 25.4;
const mm = (valor: number) => valor * PT_POR_MM;

const COR_TEXTO: [number, number, number] = [0, 0, 0];

/** Fonte do certificado: documento oficial impresso, fora do DS da aplicação. */
const FONTE = "times";

/**
 * Brasões institucionais do cabeçalho — fixos, não vêm de `escola.logoPath`
 * (isso é a logo da mantenedora, ao centro). São os mesmos em qualquer escola
 * do sistema, por isso ficam como assets do app, e não campos de banco.
 * Chaves usadas como chave do `ImagemCache`, iguais ao caminho público.
 */
export const BRASAO_ESQUERDA_PATH = "/historico/republica-preto-branco.jpg";
export const BRASAO_DIREITA_PATH = "/historico/republica.png";

/**
 * Logo padrão da mantenedora — usada quando `escola.logoPath` está vazio no
 * cadastro da company (caso comum: nem toda empresa tem `logo_path`
 * preenchido, mas a escola tem uma única marca visual usada em todo
 * documento oficial, o mesmo arquivo que `/historico/emissao` já usa).
 */
export const LOGO_PADRAO_PATH = "/historico/logo-epg.png";

/** Moldura de página inteira, como no modelo de referência: traço externo
 * grosso e um filete interno mais fino a poucos pontos de distância. */
function renderMoldura(doc: jsPDF, opts: CertificadoOptions): void {
  if (!opts.leiaute.mostrarMoldura) return;
  const margem = mm(opts.leiaute.margemMm) / 2;
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();

  doc.setDrawColor(...COR_TEXTO);
  doc.setLineWidth(2.2);
  doc.rect(margem, margem, largura - margem * 2, altura - margem * 2);

  const filete = margem + 5;
  doc.setLineWidth(0.7);
  doc.rect(filete, filete, largura - filete * 2, altura - filete * 2);
}

/** Desenha uma imagem centrada em `centroX`, com o topo em `yInicial`; devolve
 * o y logo abaixo dela (ou `yInicial` se não houver imagem, para não abrir
 * buraco no cabeçalho). */
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
  doc.addImage(
    imagem.data,
    formato,
    centroX - caixa.w / 2,
    yInicial,
    caixa.w,
    caixa.h,
    undefined,
    "FAST"
  );
  return yInicial + caixa.h;
}

/**
 * Cabeçalho em 3 colunas, como no modelo de referência: o selo da República à
 * esquerda, a logo da mantenedora e os dados da escola ao centro, e o brasão
 * do Brasil (com "Estado de Goiás") à direita. As três colunas partem do
 * mesmo topo; a coluna central é a mais alta e por isso quem manda no `y` de
 * retorno — sem ela apagada, cabeçalho e título colidiam.
 */
function renderCabecalho(
  doc: jsPDF,
  yInicial: number,
  data: CertificadoData,
  opts: CertificadoOptions,
  imagens: ImagemCache
): number {
  const largura = doc.internal.pageSize.getWidth();
  const centro = largura / 2;
  const margem = mm(opts.leiaute.margemMm);
  const larguraColunaLateral = mm(46);
  const centroEsquerda = margem + larguraColunaLateral / 2;
  const centroDireita = largura - margem - larguraColunaLateral / 2;

  doc.setTextColor(...COR_TEXTO);

  if (opts.leiaute.mostrarLogos) {
    renderImagemCentralizada(
      doc,
      centroEsquerda,
      yInicial,
      imagens.get(BRASAO_ESQUERDA_PATH),
      mm(32),
      mm(32)
    );

    let yDireita = renderImagemCentralizada(
      doc,
      centroDireita,
      yInicial,
      imagens.get(BRASAO_DIREITA_PATH),
      mm(32),
      mm(32)
    );
    yDireita += 10;
    doc.setFont(FONTE, "bold");
    doc.setFontSize(8);
    // Quebrado explicitamente em duas linhas — na largura da coluna lateral,
    // uma linha só estoura a margem da página com margens estreitas.
    doc.text("República Federativa", centroDireita, yDireita, { align: "center" });
    yDireita += 9;
    doc.text("do Brasil", centroDireita, yDireita, { align: "center" });
    yDireita += 10;
    doc.setFont(FONTE, "normal");
    doc.setFontSize(7.5);
    doc.text("Estado de Goiás", centroDireita, yDireita, { align: "center" });
  }

  // Coluna central: logo da mantenedora e os dados da escola. Sem
  // `logoPath` cadastrado na company, cai no arquivo padrão — nem toda
  // company tem o campo preenchido, mas a escola tem uma marca só.
  // A chave do cache é a URL pública resolvida (o que `carregarImagens`
  // efetivamente baixou), não o path cru salvo em `escola.logoPath`.
  let y = yInicial;
  const logo = imagens.get(companyLogoUrl(data.escola.logoPath) ?? LOGO_PADRAO_PATH) ?? imagens.get(LOGO_PADRAO_PATH);
  if (opts.leiaute.mostrarLogos && logo) {
    y = renderImagemCentralizada(doc, centro, y, logo, mm(85), mm(32)) + 8;
  }

  doc.setFont(FONTE, "bold");
  doc.setFontSize(14);
  doc.text(data.escola.nomeFantasia, centro, y, { align: "center" });
  y += 15;

  if (data.escola.razaoSocial && data.escola.razaoSocial !== data.escola.nomeFantasia) {
    doc.setFont(FONTE, "bold");
    doc.setFontSize(10);
    doc.text(data.escola.razaoSocial, centro, y, { align: "center" });
    y += 11;
  }

  doc.setFont(FONTE, "normal");
  doc.setFontSize(8);
  const cidadeUf =
    data.escola.cidade && data.escola.uf
      ? `${data.escola.cidade} - ${data.escola.uf}`
      : data.escola.cidade ?? data.escola.uf;

  // Linha ausente é omitida, não deixa espaço vazio no cabeçalho.
  // A resolução de credenciamento é dado do histórico escolar (verso), não
  // do certificado — repeti-la aqui duplicava a mesma informação duas vezes
  // no mesmo documento.
  const linhas = [
    data.escola.cnpj ? `CNPJ: ${data.escola.cnpj}` : null,
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

/**
 * A linha marcada `ehAluno` não tem nome fixo na config — a mesma config de
 * assinaturas serve para o lote inteiro, mas cada página do lote é de um
 * aluno diferente. Aqui ela recebe o nome do aluno desta página.
 */
function renderAssinaturas(
  doc: jsPDF,
  yInicial: number,
  opts: CertificadoOptions,
  nomeAluno: string
): void {
  const assinaturas = opts.assinaturas
    .map((a) => (a.ehAluno ? { ...a, nome: nomeAluno } : a))
    .filter((a) => a.nome.trim() || a.cargo.trim());
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
  const yTopo = renderCabecalho(doc, margem + 12, data, opts, imagens);

  // O bloco título+corpo+data fica centralizado entre o fim do cabeçalho e o
  // início das assinaturas — sem isso ele nascia colado no topo, com um vão
  // vazio grande antes das assinaturas em qualquer certificado curto.
  const segmentos = montarCorpo(data, opts);
  const opcoesParagrafo = { fonte: FONTE, fonteCorpoPt: opts.leiaute.fonteCorpoPt, margemPt: margem };
  const ALTURA_TITULO = 52;
  const GAP_TITULO_CORPO = 16;
  const ALTURA_DATA = 40;
  const alturaBlocoTexto =
    ALTURA_TITULO + GAP_TITULO_CORPO + medirAlturaCorpo(doc, segmentos, opcoesParagrafo) + ALTURA_DATA;

  const alturaBlocoAssinaturas = mm(22);
  const yBaseAssinaturas = alturaPagina - margem - alturaBlocoAssinaturas;
  const espacoDisponivel = yBaseAssinaturas - yTopo;
  const yInicioBloco = yTopo + Math.max(0, (espacoDisponivel - alturaBlocoTexto) / 2);

  let y = renderTitulo(doc, yInicioBloco, opts);
  y = renderCorpo(doc, y + GAP_TITULO_CORPO, segmentos, opcoesParagrafo);
  y = renderDataLocal(doc, y, data, opts);

  // Assinaturas ancoradas ao rodapé; um corpo longo (que estoura o espaço
  // calculado) as empurra para baixo em vez de escrever por cima delas.
  renderAssinaturas(doc, Math.max(y + 16, yBaseAssinaturas), opts, data.aluno.nome);
}

/**
 * Preview e emissão chamam esta mesma função: o que se vê é o que sai.
 *
 * Uma página de certificado (paisagem) por aluno. Com `mostrarHistorico` e um
 * histórico no mapa, o verso é o histórico escolar já existente, também em
 * paisagem, desenhado por `renderHistoricos` sem redesenhar nada — é o mesmo
 * documento que sai por `/historico/emissao`.
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
