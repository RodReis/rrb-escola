import jsPDF from "jspdf";
import { imgFitInBox } from "./pdf-utils";
import { companyLogoUrl } from "@/lib/storage/company-logo-url";
import type { DadosRequerimento, PessoaResponsavel } from "@/lib/data/requerimento-matricula";

export type ImagemCache = Map<string, { data: string; w: number; h: number }>;

export type RequerimentoPdfDados = {
  dados: DadosRequerimento;
  anoLetivo: number;
  observacoes: string | null;
  escola: {
    nome: string;
    cnpj: string | null;
    endereco: string | null;
    cidade: string | null;
    uf: string | null;
    cep: string | null;
    telefones: string | null;
    email: string | null;
    logoPath: string | null;
  };
  secretario: { nome: string | null; cargo: string };
};

const PT_POR_MM = 72 / 25.4;
const mm = (valor: number) => valor * PT_POR_MM;
const MARGEM_MM = 18;
const FONTE = "times";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
];

function formatDataBR(iso: string | null): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function formatDataExtenso(d: Date): string {
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

function renderCabecalho(doc: jsPDF, yInicial: number, escola: RequerimentoPdfDados["escola"], imagens: ImagemCache): number {
  const centro = doc.internal.pageSize.getWidth() / 2;
  let y = yInicial;

  const url = companyLogoUrl(escola.logoPath);
  const logo = url ? imagens.get(url) : undefined;
  if (logo) {
    const caixa = imgFitInBox(logo, mm(40), mm(28));
    const formato = logo.data.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
    doc.addImage(logo.data, formato, centro - caixa.w / 2, y, caixa.w, caixa.h, undefined, "FAST");
    y += caixa.h + 8;
  }

  doc.setTextColor(0, 0, 0);
  doc.setFont(FONTE, "bold");
  doc.setFontSize(12);
  doc.text(escola.nome, centro, y, { align: "center" });
  y += 13;

  doc.setFont(FONTE, "normal");
  doc.setFontSize(8);
  const cidadeUf = escola.cidade && escola.uf ? `${escola.cidade} - ${escola.uf}` : escola.cidade ?? escola.uf;
  const linhas = [
    escola.cnpj ? `CNPJ: ${escola.cnpj}` : null,
    escola.endereco,
    [cidadeUf, escola.cep ? `CEP: ${escola.cep}` : null].filter(Boolean).join(" · "),
    [escola.telefones, escola.email].filter(Boolean).join(" · ")
  ].filter((l): l is string => Boolean(l && l.trim()));

  for (const linha of linhas) {
    doc.text(linha, centro, y, { align: "center" });
    y += 10;
  }

  return y + 10;
}

function renderTitulo(doc: jsPDF, yInicial: number, ano: string): number {
  const centro = doc.internal.pageSize.getWidth() / 2;
  doc.setFont(FONTE, "bold");
  doc.setFontSize(14);
  doc.text(`Requerimento de Matrícula - ${ano}`, centro, yInicial, { align: "center" });
  return yInicial + 20;
}

type Campo = { label: string; valor: string | null };

const CAMPOS_POR_LINHA = 3;
const ALTURA_LINHA_VALOR = 9.5;

function colLarguraTexto(doc: jsPDF, margemPt: number): number {
  const util = doc.internal.pageSize.getWidth() - margemPt * 2;
  return util / CAMPOS_POR_LINHA - 6;
}

/** Altura de uma "linha" de até `CAMPOS_POR_LINHA` campos lado a lado — o
 * maior número de linhas de valor entre os campos da linha decide a altura. */
function alturaLinhaDeCampos(doc: jsPDF, campos: Campo[], larguraTexto: number): number {
  let maxLinhas = 1;
  for (const campo of campos) {
    const valor = campo.valor?.trim() ? campo.valor : "—";
    const linhas = (doc.splitTextToSize(valor, larguraTexto) as string[]).length;
    maxLinhas = Math.max(maxLinhas, linhas);
  }
  return 9 + maxLinhas * ALTURA_LINHA_VALOR + 5;
}

/**
 * Altura total que `renderCampos` vai ocupar para esses campos, sem
 * desenhar nada — usada por `garantirEspaco` para decidir ANTES se precisa
 * quebrar página (bug C2 da revisão: antes a decisão usava um número fixo
 * "chutado" que não refletia blocos de pai/mãe com valor longo).
 */
function alturaEstimadaCampos(doc: jsPDF, margemPt: number, campos: Campo[]): number {
  const larguraTexto = colLarguraTexto(doc, margemPt);
  let altura = 4;
  for (let i = 0; i < campos.length; i += CAMPOS_POR_LINHA) {
    altura += alturaLinhaDeCampos(doc, campos.slice(i, i + CAMPOS_POR_LINHA), larguraTexto);
  }
  return altura;
}

/**
 * 3 colunas (não 2): com os ~11 campos de pai/mãe do PDF, 2 colunas
 * ultrapassavam a altura da página antes de chegar nas assinaturas (bug C2
 * da revisão). `splitTextToSize` por coluna evita que um valor longo (ex.
 * endereço) invada a coluna vizinha (bug I2) — a altura de cada linha de
 * campo cresce com o número de linhas que o valor realmente ocupa.
 */
function renderCampos(doc: jsPDF, yInicial: number, margemPt: number, campos: Campo[]): number {
  const util = doc.internal.pageSize.getWidth() - margemPt * 2;
  const colLargura = util / CAMPOS_POR_LINHA;
  const larguraTexto = colLargura - 6;
  let y = yInicial;
  let col = 0;
  let alturaLinhaAtual = 0;

  for (const campo of campos) {
    const valor = campo.valor?.trim() ? campo.valor : "—";
    const x = margemPt + col * colLargura;

    doc.setFont(FONTE, "bold");
    doc.setFontSize(6.5);
    doc.text(campo.label, x, y);

    doc.setFont(FONTE, "normal");
    doc.setFontSize(8);
    const linhasValor = doc.splitTextToSize(valor, larguraTexto) as string[];
    linhasValor.forEach((linha, i) => doc.text(linha, x, y + 9 + i * ALTURA_LINHA_VALOR));

    const alturaCampo = 9 + linhasValor.length * ALTURA_LINHA_VALOR;
    alturaLinhaAtual = Math.max(alturaLinhaAtual, alturaCampo);

    col += 1;
    if (col === CAMPOS_POR_LINHA) {
      y += alturaLinhaAtual + 5;
      col = 0;
      alturaLinhaAtual = 0;
    }
  }
  if (col !== 0) y += alturaLinhaAtual + 5;
  return y + 4;
}

function renderSecao(doc: jsPDF, yInicial: number, margemPt: number, titulo: string): number {
  doc.setFont(FONTE, "bold");
  doc.setFontSize(10);
  doc.setFillColor(235, 235, 235);
  const util = doc.internal.pageSize.getWidth() - margemPt * 2;
  doc.rect(margemPt, yInicial - 10, util, 14, "F");
  doc.text(titulo, margemPt + 4, yInicial);
  return yInicial + 18;
}

function camposPessoa(p: PessoaResponsavel): Campo[] {
  return [
    { label: "Nome", valor: p.nome },
    { label: "RG", valor: p.rg },
    { label: "CPF/CNPJ", valor: p.cpfOuCnpj },
    { label: "Telefones", valor: p.telefones },
    { label: "E-mail", valor: p.email },
    { label: "Data Nascimento", valor: formatDataBR(p.dataNascimento) || null },
    { label: "Estado Civil", valor: p.estadoCivil },
    { label: "Escolaridade", valor: p.escolaridade },
    { label: "Local de Trabalho", valor: p.localTrabalho },
    { label: "Profissão", valor: p.profissao },
    { label: "Telefone do Trabalho", valor: p.telefoneTrabalho }
  ];
}

/** Secretário + responsável financeiro — nome caixa-alta + cargo, sem imagem
 * de assinatura escaneada (fora de escopo, ver design doc). `null` em
 * qualquer um dos dois só omite aquela coluna, nunca lança. */
function renderAssinaturas(
  doc: jsPDF,
  yInicial: number,
  margemPt: number,
  secretario: { nome: string | null; cargo: string },
  responsavel: { nome: string; parentesco: string | null } | null
): void {
  const assinaturas = [
    secretario.nome?.trim() ? { nome: secretario.nome, cargo: secretario.cargo } : null,
    responsavel ? { nome: responsavel.nome, cargo: "Responsável" } : null
  ].filter((a): a is { nome: string; cargo: string } => a !== null);
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
    for (const linha of doc.splitTextToSize(a.nome.toUpperCase(), larguraLinha) as string[]) {
      doc.text(linha, centro, y, { align: "center" });
      y += 10;
    }

    doc.setFont(FONTE, "normal");
    doc.setFontSize(8.5);
    doc.text(a.cargo, centro, y, { align: "center" });
  });
}

const ALTURA_SECAO = 18;
const ALTURA_RODAPE = 70;

/**
 * Quebra para uma nova página quando o próximo bloco (altura estimada
 * `alturaEstimativa`) não cabe mais acima do rodapé — sem isso, com aluno +
 * pai + mãe completos o conteúdo passava da altura da página e a data e as
 * assinaturas do secretário/responsável saíam fora da área visível (bug C2
 * da revisão: o documento oficial saía sem assinatura nenhuma).
 */
function garantirEspaco(doc: jsPDF, y: number, alturaPagina: number, margem: number, alturaEstimativa: number): number {
  if (y + alturaEstimativa <= alturaPagina - margem - ALTURA_RODAPE) return y;
  doc.addPage("a4", "portrait");
  return margem + 10;
}

function renderPagina(doc: jsPDF, pagina: RequerimentoPdfDados, imagens: ImagemCache): void {
  const margem = mm(MARGEM_MM);
  const alturaPagina = doc.internal.pageSize.getHeight();
  const { dados } = pagina;

  let y = renderCabecalho(doc, margem + 10, pagina.escola, imagens);
  y = renderTitulo(doc, y + 6, String(pagina.anoLetivo));

  y = renderSecao(doc, y + 10, margem, "Dados do Aluno");
  y = renderCampos(doc, y, margem, [
    { label: "Matrícula", valor: dados.aluno.matricula },
    { label: "Nome", valor: dados.aluno.nome },
    { label: "Sexo", valor: dados.aluno.sexo },
    { label: "Data Nascimento", valor: formatDataBR(dados.aluno.dataNascimento) || null },
    { label: "Naturalidade", valor: dados.aluno.naturalidade },
    { label: "Telefones", valor: dados.aluno.telefones },
    { label: "Endereço", valor: dados.aluno.endereco },
    { label: "CPF", valor: dados.aluno.cpf },
    { label: "RG", valor: dados.aluno.rg },
    { label: "Etnia", valor: dados.aluno.etnia },
    { label: "Religião", valor: dados.aluno.religiao }
  ]);

  if (dados.pai) {
    const campos = camposPessoa(dados.pai);
    y = garantirEspaco(doc, y, alturaPagina, margem, ALTURA_SECAO + alturaEstimadaCampos(doc, margem, campos));
    y = renderSecao(doc, y + 4, margem, "Pai");
    y = renderCampos(doc, y, margem, campos);
  }

  if (dados.mae) {
    const campos = camposPessoa(dados.mae);
    y = garantirEspaco(doc, y, alturaPagina, margem, ALTURA_SECAO + alturaEstimadaCampos(doc, margem, campos));
    y = renderSecao(doc, y + 4, margem, "Mãe");
    y = renderCampos(doc, y, margem, campos);
  }

  const camposMatricula = [
    { label: "Série", valor: dados.matricula.serie },
    { label: "Turma/Turno", valor: [dados.matricula.turma, dados.matricula.turno].filter(Boolean).join("/") || null },
    { label: "Tipo Ensino", valor: dados.matricula.tipoEnsino },
    { label: "Data Matrícula", valor: formatDataBR(dados.matricula.dataMatricula) || null }
  ];
  y = garantirEspaco(doc, y, alturaPagina, margem, ALTURA_SECAO + alturaEstimadaCampos(doc, margem, camposMatricula));
  y = renderSecao(doc, y + 4, margem, "Dados da Matrícula");
  y = renderCampos(doc, y, margem, camposMatricula);

  if (dados.responsavelFinanceiro) {
    const camposFinanceiro = [
      { label: "Responsável Financeiro", valor: dados.responsavelFinanceiro.nome },
      { label: "CPF/CNPJ", valor: dados.responsavelFinanceiro.cpfOuCnpj },
      { label: "Parentesco", valor: dados.responsavelFinanceiro.parentesco }
    ];
    y = garantirEspaco(doc, y, alturaPagina, margem, ALTURA_SECAO + alturaEstimadaCampos(doc, margem, camposFinanceiro));
    y = renderSecao(doc, y + 4, margem, "Responsável Financeiro Principal");
    y = renderCampos(doc, y, margem, camposFinanceiro);
  }

  if (pagina.observacoes?.trim()) {
    doc.setFont(FONTE, "normal");
    doc.setFontSize(9);
    const util = doc.internal.pageSize.getWidth() - margem * 2;
    const linhas = doc.splitTextToSize(pagina.observacoes, util) as string[];
    for (const linha of linhas) {
      y = garantirEspaco(doc, y, alturaPagina, margem, 12);
      doc.text(linha, margem, y);
      y += 12;
    }
    y += 6;
  }

  // Data e assinaturas sempre visíveis: se o que já foi desenhado não deixa
  // espaço pro bloco do rodapé, começa uma página nova só com o rodapé —
  // nunca desenha fora da área visível.
  y = garantirEspaco(doc, y, alturaPagina, margem, ALTURA_RODAPE);

  doc.setFont(FONTE, "normal");
  doc.setFontSize(9);
  doc.text(formatDataExtenso(new Date()) + ".", doc.internal.pageSize.getWidth() - margem, y + 20, { align: "right" });

  renderAssinaturas(doc, y + 50, margem, pagina.secretario, dados.responsavelFinanceiro);
}

/** Uma página (retrato) por item — um aluno por página, igual renderDeclaracoes. */
export function renderRequerimentos(paginas: RequerimentoPdfDados[], imagens: ImagemCache): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  paginas.forEach((pagina, i) => {
    if (i > 0) doc.addPage("a4", "portrait");
    renderPagina(doc, pagina, imagens);
  });

  return doc;
}
