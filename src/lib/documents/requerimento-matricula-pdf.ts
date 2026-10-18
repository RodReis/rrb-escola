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

/*
 * Formulário em tabela, uma página A4 por aluno. Toda altura de linha é fixa
 * (o valor encolhe a fonte ou quebra em até 2 linhas, nunca empurra a linha
 * de baixo) — por isso o documento cabe em 1 página por construção, com
 * qualquer dado.
 */
const PT_POR_MM = 72 / 25.4;
const mm = (valor: number) => valor * PT_POR_MM;
const FONTE = "helvetica";
const MARGEM = mm(12);
const MARGEM_TOPO = mm(10);

const ALTURA_LINHA = 25;
const ALTURA_BANDA = 15;
const ALTURA_ENDERECO_NOVO = 40;
const ALTURA_OBSERVACOES = 34;
const PADDING = 3;

const COR_BANDA = 222;
const TAMANHOS_VALOR = [8.5, 8, 7.5, 7, 6.5, 6];

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

function capitalizar(texto: string): string {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase() : texto;
}

const PREPOSICOES = new Set(["de", "da", "do", "das", "dos"]);

/** "TRINDADE" → "Trindade", "SANTA CRUZ DE GOIÁS" → "Santa Cruz de Goiás". */
function nomeProprio(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((p) => (PREPOSICOES.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

function formatoImagem(data: string): "JPEG" | "PNG" | "WEBP" {
  if (data.startsWith("data:image/jpeg") || data.startsWith("data:image/jpg")) return "JPEG";
  if (data.startsWith("data:image/webp")) return "WEBP";
  return "PNG";
}

type Campo = { label: string; valor: string | null | undefined };

/** Rótulo pequeno no topo da célula e valor logo abaixo; o valor encolhe
 * (8.5 → 6pt) e depois quebra para caber na célula, sem vazar. */
function desenharCelula(doc: jsPDF, x: number, y: number, w: number, h: number, campo: Campo): void {
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(x, y, w, h);

  doc.setTextColor(0, 0, 0);
  doc.setFont(FONTE, "bold");
  doc.setFontSize(6.5);
  doc.text(campo.label, x + PADDING, y + 7.5);

  const valor = campo.valor?.trim();
  if (!valor) return;

  doc.setFont(FONTE, "normal");
  const largura = w - PADDING * 2;
  const topo = y + 9;
  const disponivel = h - 10;

  for (const tamanho of TAMANHOS_VALOR) {
    doc.setFontSize(tamanho);
    const linhas = doc.splitTextToSize(valor, largura) as string[];
    const alturaLinha = tamanho + 0.8;
    if (linhas.length * alturaLinha <= disponivel) {
      linhas.forEach((linha, i) => doc.text(linha, x + PADDING, topo + tamanho + i * alturaLinha - 1));
      return;
    }
  }

  // Último recurso (valor absurdamente longo): corta em 6pt com reticências.
  const tamanho = TAMANHOS_VALOR[TAMANHOS_VALOR.length - 1];
  doc.setFontSize(tamanho);
  const alturaLinha = tamanho + 0.8;
  const maximo = Math.max(1, Math.floor(disponivel / alturaLinha));
  const linhas = (doc.splitTextToSize(valor, largura) as string[]).slice(0, maximo);
  const ultima = linhas.length - 1;
  linhas[ultima] = `${linhas[ultima].replace(/\s+\S{0,3}$/, "").trimEnd()}…`;
  linhas.forEach((linha, i) => doc.text(linha, x + PADDING, topo + tamanho + i * alturaLinha - 1));
}

/** Uma linha da tabela: células lado a lado, larguras em fração da largura útil. */
function desenharLinha(
  doc: jsPDF,
  x: number,
  y: number,
  larguraTotal: number,
  altura: number,
  fracoes: number[],
  campos: Campo[]
): number {
  let cursor = x;
  campos.forEach((campo, i) => {
    const w = larguraTotal * fracoes[i];
    desenharCelula(doc, cursor, y, w, altura, campo);
    cursor += w;
  });
  return y + altura;
}

function desenharBanda(doc: jsPDF, x: number, y: number, w: number, titulo: string): number {
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.setFillColor(COR_BANDA, COR_BANDA, COR_BANDA);
  doc.rect(x, y, w, ALTURA_BANDA, "FD");
  doc.setTextColor(0, 0, 0);
  doc.setFont(FONTE, "bold");
  doc.setFontSize(9);
  doc.text(titulo, x + w / 2, y + 10.5, { align: "center" });
  return y + ALTURA_BANDA;
}

function renderCabecalho(doc: jsPDF, escola: RequerimentoPdfDados["escola"], imagens: ImagemCache): number {
  const larguraPagina = doc.internal.pageSize.getWidth();
  const direita = larguraPagina - MARGEM;
  let alturaLogo = 0;

  // Logo à esquerda.
  const url = companyLogoUrl(escola.logoPath);
  const logo = url ? imagens.get(url) : undefined;
  if (logo) {
    const caixa = imgFitInBox(logo, mm(55), mm(22));
    try {
      doc.addImage(logo.data, formatoImagem(logo.data), MARGEM, MARGEM_TOPO, caixa.w, caixa.h, undefined, "FAST");
      alturaLogo = caixa.h;
    } catch {
      alturaLogo = 0; // logo ilegível não derruba a emissão
    }
  }

  // Dados da escola alinhados à direita.
  const cidadeUf = escola.cidade && escola.uf ? `${escola.cidade} - ${escola.uf}` : escola.cidade ?? escola.uf;
  const enderecoCompleto = [escola.endereco, cidadeUf, escola.cep ? `CEP: ${escola.cep}` : null]
    .filter(Boolean)
    .join(", ");
  const larguraTexto = larguraPagina - MARGEM * 2 - (logo ? mm(58) : 0);

  let y = MARGEM_TOPO + 9;
  doc.setTextColor(0, 0, 0);
  doc.setFont(FONTE, "bold");
  doc.setFontSize(11);
  for (const linha of doc.splitTextToSize(escola.nome.toUpperCase(), larguraTexto) as string[]) {
    doc.text(linha, direita, y, { align: "right" });
    y += 12.5;
  }

  doc.setFont(FONTE, "normal");
  doc.setFontSize(7.5);
  const detalhes = [
    escola.cnpj ? `${escola.cnpj}` : null,
    enderecoCompleto || null,
    escola.email,
    escola.telefones
  ].filter((l): l is string => Boolean(l && l.trim()));
  for (const detalhe of detalhes) {
    for (const linha of doc.splitTextToSize(detalhe, larguraTexto) as string[]) {
      doc.text(linha, direita, y, { align: "right" });
      y += 10;
    }
  }

  return Math.max(MARGEM_TOPO + alturaLogo, y) + 6;
}

function desenharFoto(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  fotoUrl: string | null,
  imagens: ImagemCache
): void {
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(x, y, w, h);

  const foto = fotoUrl ? imagens.get(fotoUrl) : undefined;
  if (foto) {
    const caixa = imgFitInBox(foto, w - 6, h - 6);
    try {
      doc.addImage(foto.data, formatoImagem(foto.data), x + (w - caixa.w) / 2, y + (h - caixa.h) / 2, caixa.w, caixa.h, undefined, "FAST");
      return;
    } catch {
      // foto ilegível: cai no espaço "Foto" em branco abaixo
    }
  }

  doc.setTextColor(0, 0, 0);
  doc.setFont(FONTE, "normal");
  doc.setFontSize(9);
  doc.text("Foto", x + w / 2, y + h / 2 + 3, { align: "center" });
}

const COLUNAS_PESSOA = [0.4, 0.19, 0.41];
const COLUNAS_40_60 = [0.4, 0.6];

/** Bloco Pai/Mãe: sempre desenhado (em branco quando não há cadastro) para
 * o formulário manter a mesma geometria e poder ser completado à caneta. */
function desenharPessoa(doc: jsPDF, x: number, y: number, w: number, papel: string, p: PessoaResponsavel | null): number {
  y = desenharLinha(doc, x, y, w, ALTURA_LINHA, [1], [{ label: papel, valor: p?.nome }]);
  y = desenharLinha(doc, x, y, w, ALTURA_LINHA, COLUNAS_PESSOA, [
    { label: "RG", valor: p?.rg },
    { label: "CPF/CNPJ", valor: p?.cpfOuCnpj },
    { label: "Telefones", valor: p?.telefones }
  ]);
  y = desenharLinha(doc, x, y, w, ALTURA_LINHA, [0.59, 0.41], [
    { label: "E-mail", valor: p?.email },
    { label: "Dt. Nascimento", valor: formatDataBR(p?.dataNascimento ?? null) }
  ]);
  y = desenharLinha(doc, x, y, w, ALTURA_LINHA, COLUNAS_PESSOA, [
    { label: "Estado Civil", valor: p?.estadoCivil },
    { label: "Escolaridade", valor: p?.escolaridade },
    { label: "Local de Trabalho", valor: p?.localTrabalho }
  ]);
  return desenharLinha(doc, x, y, w, ALTURA_LINHA, [0.59, 0.41], [
    { label: "Profissão", valor: p?.profissao },
    { label: "Telefone do Trabalho", valor: p?.telefoneTrabalho }
  ]);
}

function desenharAluno(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  aluno: DadosRequerimento["aluno"],
  imagens: ImagemCache
): number {
  const larguraFoto = w * 0.17;
  const larguraGrade = w - larguraFoto;
  const xGrade = x + larguraFoto;
  const linhasDaGrade = 6;

  desenharFoto(doc, x, y, larguraFoto, ALTURA_LINHA * linhasDaGrade, aluno.fotoUrl, imagens);

  // "Cidade" e "CEP" não existem separados no dado (o endereço vem montado);
  // ficam como campos de preenchimento, como no formulário de referência.
  let yg = y;
  yg = desenharLinha(doc, xGrade, yg, larguraGrade, ALTURA_LINHA, COLUNAS_40_60, [
    { label: "Matrícula", valor: aluno.matricula },
    { label: "Nome", valor: aluno.nome }
  ]);
  yg = desenharLinha(doc, xGrade, yg, larguraGrade, ALTURA_LINHA, COLUNAS_40_60, [
    { label: "Sexo", valor: aluno.sexo },
    { label: "Dt. Nascimento", valor: formatDataBR(aluno.dataNascimento) }
  ]);
  yg = desenharLinha(doc, xGrade, yg, larguraGrade, ALTURA_LINHA, COLUNAS_40_60, [
    { label: "Naturalidade", valor: aluno.naturalidade },
    { label: "Telefones", valor: aluno.telefones }
  ]);
  yg = desenharLinha(doc, xGrade, yg, larguraGrade, ALTURA_LINHA, [1], [{ label: "Endereço", valor: aluno.endereco }]);
  yg = desenharLinha(doc, xGrade, yg, larguraGrade, ALTURA_LINHA, COLUNAS_40_60, [
    { label: "Cidade", valor: null },
    { label: "CEP", valor: null }
  ]);
  yg = desenharLinha(doc, xGrade, yg, larguraGrade, ALTURA_LINHA, COLUNAS_40_60, [
    { label: "CPF", valor: aluno.cpf },
    { label: "RG", valor: aluno.rg }
  ]);

  y = desenharLinha(doc, x, yg, w, ALTURA_LINHA, [1], [{ label: "Etnia", valor: aluno.etnia }]);
  return desenharLinha(doc, x, y, w, ALTURA_LINHA, [1], [{ label: "Religião", valor: aluno.religiao }]);
}

function desenharAssinaturas(
  doc: jsPDF,
  y: number,
  secretario: { nome: string | null; cargo: string },
  responsavel: { nome: string } | null
): void {
  const assinaturas = [
    secretario.nome?.trim() ? { nome: secretario.nome, cargo: secretario.cargo } : null,
    responsavel ? { nome: responsavel.nome, cargo: "Responsável" } : null
  ].filter((a): a is { nome: string; cargo: string } => a !== null);
  if (assinaturas.length === 0) return;

  const util = doc.internal.pageSize.getWidth() - MARGEM * 2;
  const larguraColuna = util / assinaturas.length;
  const larguraLinha = Math.min(larguraColuna - mm(8), mm(75));

  assinaturas.forEach((a, i) => {
    const centro = MARGEM + larguraColuna * i + larguraColuna / 2;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.6);
    doc.line(centro - larguraLinha / 2, y, centro + larguraLinha / 2, y);

    doc.setTextColor(0, 0, 0);
    doc.setFont(FONTE, "bold");
    doc.setFontSize(8.5);
    let yTexto = y + 10;
    // No máximo 2 linhas de nome: o rodapé não pode crescer e sair da página.
    for (const linha of (doc.splitTextToSize(a.nome.toUpperCase(), larguraLinha) as string[]).slice(0, 2)) {
      doc.text(linha, centro, yTexto, { align: "center" });
      yTexto += 9.5;
    }
    doc.setFont(FONTE, "normal");
    doc.setFontSize(8);
    doc.text(a.cargo, centro, yTexto, { align: "center" });
  });
}

function renderPagina(doc: jsPDF, pagina: RequerimentoPdfDados, imagens: ImagemCache): void {
  const larguraPagina = doc.internal.pageSize.getWidth();
  const alturaPagina = doc.internal.pageSize.getHeight();
  const w = larguraPagina - MARGEM * 2;
  const x = MARGEM;
  const { dados } = pagina;

  let y = renderCabecalho(doc, pagina.escola, imagens);

  doc.setTextColor(0, 0, 0);
  doc.setFont(FONTE, "bold");
  doc.setFontSize(13);
  doc.text(`Requerimento de Matrícula - ${pagina.anoLetivo}`, larguraPagina / 2, y + 12, { align: "center" });
  y += 20;

  y = desenharBanda(doc, x, y, w, "Dados do Aluno");
  y = desenharAluno(doc, x, y, w, dados.aluno, imagens);
  y = desenharPessoa(doc, x, y, w, "Pai", dados.pai);
  y = desenharPessoa(doc, x, y, w, "Mãe", dados.mae);

  // Campos de preenchimento à mão, como no formulário de referência.
  y = desenharLinha(doc, x, y, w, ALTURA_LINHA, [1], [{ label: "Irmãos na Escola", valor: null }]);
  y = desenharLinha(doc, x, y, w, ALTURA_ENDERECO_NOVO, [1], [{ label: "Novo Endereço", valor: null }]);

  y = desenharBanda(doc, x, y, w, "Dados da Matrícula");
  const turma = dados.matricula.turma.trim();
  const turno = capitalizar(dados.matricula.turno.trim());
  const turmaTurno = turma.toLowerCase() === turno.toLowerCase() ? turno : [turma, turno].filter(Boolean).join("/");
  y = desenharLinha(doc, x, y, w, ALTURA_LINHA, [0.25, 0.25, 0.25, 0.25], [
    { label: "Série", valor: dados.matricula.serie },
    { label: "Turma/Turno", valor: turmaTurno },
    { label: "Tipo Ensino", valor: dados.matricula.tipoEnsino },
    { label: "Data Matrícula", valor: formatDataBR(dados.matricula.dataMatricula) }
  ]);

  y = desenharBanda(doc, x, y, w, "Responsável Financeiro Principal");
  y = desenharLinha(doc, x, y, w, ALTURA_LINHA, [0.55, 0.2, 0.25], [
    { label: "Responsável Financeiro", valor: dados.responsavelFinanceiro?.nome },
    { label: "CPF/CNPJ", valor: dados.responsavelFinanceiro?.cpfOuCnpj },
    { label: "Parentesco", valor: dados.responsavelFinanceiro?.parentesco }
  ]);

  if (pagina.observacoes?.trim()) {
    y = desenharLinha(doc, x, y, w, ALTURA_OBSERVACOES, [1], [{ label: "Observações", valor: pagina.observacoes }]);
  }

  // Rodapé: data + assinaturas logo abaixo da tabela, nunca além da margem.
  const limite = alturaPagina - MARGEM_TOPO - 32;
  const yData = Math.min(y + 16, limite - 36);
  doc.setTextColor(0, 0, 0);
  doc.setFont(FONTE, "normal");
  doc.setFontSize(9);
  const cidade = pagina.escola.cidade?.trim() ? nomeProprio(pagina.escola.cidade) : null;
  doc.text(`${[cidade, formatDataExtenso(new Date())].filter(Boolean).join(", ")}.`, larguraPagina - MARGEM, yData, { align: "right" });
  desenharAssinaturas(doc, Math.min(yData + 34, limite), pagina.secretario, dados.responsavelFinanceiro);
}

/** Uma página A4 (retrato) por aluno. */
export function renderRequerimentos(paginas: RequerimentoPdfDados[], imagens: ImagemCache): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  paginas.forEach((pagina, i) => {
    if (i > 0) doc.addPage("a4", "portrait");
    renderPagina(doc, pagina, imagens);
  });

  return doc;
}
