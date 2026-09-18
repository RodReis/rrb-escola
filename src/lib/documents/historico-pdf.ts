import { jsPDF } from "jspdf";
import { montarGrade } from "@/lib/historico/grade";
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
const TRACO = "-";

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

function campo(doc: jsPDF, rotulo: string, valor: string | null, x: number, yRotulo: number) {
  texto(doc, rotulo, x, yRotulo, 6);
  texto(doc, valor ?? "", x, yRotulo - 8, 7, true);
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
  textoCentro(doc, `RESULTADOS REALIZADOS NO ${NIVEL_LABEL[dados.nivel].toUpperCase()}`, 606, 8, true);
}

function desenharIdentificacao(doc: jsPDF, dados: HistoricoData) {
  const a = dados.aluno;
  campo(doc, "Aluno(a):", a.nome, MARGEM_ESQ, 670);
  campo(doc, "CPF:", a.cpf, 418.4, 670);
  campo(doc, "Matrícula:", a.matricula, 497.7, 670);
  campo(doc, "Filiação:", a.filiacao, MARGEM_ESQ, 650);
  campo(doc, "Data de Nascimento:", a.dataNascimento, MARGEM_ESQ, 630);
  campo(doc, "Naturalidade:", a.naturalidade, 101.3, 630);
  campo(doc, "Nacionalidade:", a.nacionalidade, 259.9, 630);
  campo(doc, "RG:", a.rg, 339.1, 630);
  campo(doc, "Orgão Expedidor:", a.orgaoExpedidor, 418.4, 630);
  campo(doc, "Data Expedição:", a.dataExpedicao, 497.7, 630);
}

function desenharGrade(doc: jsPDF, dados: HistoricoData) {
  const colunas = SERIES_POR_NIVEL[dados.nivel];
  const exibeCh = NIVEL_EXIBE_CH[dados.nivel];
  const passo = 46.7;
  const xPrimeira = 142.8;
  const xColuna = (i: number) => xPrimeira + i * passo;

  colunas.forEach((coluna, i) => {
    texto(doc, coluna, xColuna(i), 595, 7, true);
    if (exibeCh) {
      texto(doc, "Média", xColuna(i), 580.5, 7, true);
      texto(doc, "C.H.", xColuna(i) + 25.9, 580.5, 7, true);
    } else {
      texto(doc, "Média", xColuna(i), 580.5, 7, true);
    }
  });
  texto(doc, "Disciplinas", 59.2, 580.5, 7, true);
  if (exibeCh) {
    texto(doc, "C.H.", 556.3, 584, 7, true);
    texto(doc, "Total", 555.3, 577, 7, true);
  }

  const linhas = montarGrade(dados.anos, colunas);
  const alturaLinha = 11;
  let yLinha = 566;

  for (const linha of linhas) {
    texto(doc, linha.disciplina, MARGEM_ESQ, yLinha, 7);
    linha.celulas.forEach((celula, i) => {
      texto(doc, numero(celula.nota), xColuna(i), yLinha, 7, true);
      if (exibeCh) {
        texto(doc, inteiro(celula.cargaHoraria), xColuna(i) + 25.9, yLinha, 7, true);
      }
    });
    if (exibeCh) texto(doc, inteiro(linha.chTotal), 556.3, yLinha, 7, true);
    yLinha -= alturaLinha;
  }

  const porColuna = new Map(dados.anos.map((a) => [a.serieNome, a]));
  const rodape: Array<[string, number, (a: HistoricoAno | undefined) => string]> = [
    ["Resultado Final", 401, (a) => (a ? RESULTADO_LABEL[a.resultado] : TRACO)],
    ["Carga Horária Anual", 390, (a) => inteiro(a?.cargaHoraria ?? null)],
    ["Dias Letivos", 379, (a) => inteiro(a?.diasLetivos ?? null)]
  ];

  for (const [rotulo, yRodape, valor] of rodape) {
    texto(doc, rotulo, MARGEM_ESQ, yRodape, 7, true);
    colunas.forEach((coluna, i) => {
      texto(doc, valor(porColuna.get(coluna)), xColuna(i), yRodape, 7, true);
    });
  }

  const chTotalAnual = dados.anos.reduce((acc, a) => acc + (a.cargaHoraria ?? 0), 0);
  if (chTotalAnual > 0) texto(doc, String(chTotalAnual), 556.3, 390, 7, true);
}

function desenharEstabelecimentos(doc: jsPDF, dados: HistoricoData) {
  texto(doc, "Série", 66.8, 364, 8, true);
  texto(doc, "Ano", 140.5, 364, 8, true);
  texto(doc, "Estabelecimento", 258.4, 364, 8, true);
  texto(doc, "Cidade", 465.6, 364, 8, true);
  texto(doc, "UF", 555.8, 364, 8, true);

  const colunas = SERIES_POR_NIVEL[dados.nivel];
  const porSerie = new Map(dados.anos.map((a) => [a.serieNome, a]));
  let yLinha = 352;

  for (const coluna of colunas) {
    const ano = porSerie.get(coluna);
    texto(doc, coluna, MARGEM_ESQ, yLinha, 8);
    texto(doc, ano ? String(ano.ano) : TRACO, 139.7, yLinha, 8);
    texto(doc, ano?.instituicao ?? TRACO, 166.3, yLinha, 8);
    texto(doc, ano?.cidade ?? TRACO, 410.5, yLinha, 8);
    texto(doc, ano?.uf ?? TRACO, 549.3, yLinha, 8);
    yLinha -= 12;
  }
}

function desenharRodape(doc: jsPDF, dados: HistoricoData, opts: HistoricoPdfOptions) {
  const c = dados.credenciamento;
  const data = opts.dataEmissao ?? new Date();
  const dataTexto = data.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
  const cidade = c.cidade && c.uf ? `${c.cidade}-${c.uf}` : (c.cidade ?? "");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`${cidade}, ${dataTexto}.`, 573, y(89), { align: "right" });

  const assinaturas: Array<[string | null, string, number]> = [
    [c.secretarioNome, c.secretarioCargo, 160],
    [c.diretorNome, c.diretorCargo, 434]
  ];

  for (const [nome, cargo, centro] of assinaturas) {
    doc.setLineWidth(0.5);
    doc.line(centro - 125, y(48), centro + 125, y(48));
    doc.setFontSize(10);
    doc.text(nome ?? "", centro, y(39), { align: "center" });
    doc.text(cargo, centro, y(29), { align: "center" });
  }
}

/**
 * Preview e emissão chamam esta mesma função: o que se vê é o que sai.
 * Uma página por aluno.
 */
export function renderHistoricos(
  alunos: HistoricoData[],
  opts: HistoricoPdfOptions = {}
): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });

  alunos.forEach((dados, i) => {
    if (i > 0) doc.addPage();
    desenharCabecalho(doc, dados, opts);
    desenharIdentificacao(doc, dados);
    desenharGrade(doc, dados);
    desenharEstabelecimentos(doc, dados);
    desenharRodape(doc, dados, opts);
  });

  return doc;
}
