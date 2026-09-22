import "server-only";
import ExcelJS from "exceljs";
import { ABA_MUDANCAS, ABA_PARCELAS, parseAnaliticoIsaac, type AnaliticoIsaac } from "./parse-analitico";
import { parseResumoIsaac, type ResumoIsaac } from "./parse-resumo";

/**
 * Camada de I/O dos arquivos de repasse: transforma bytes em estrutura e
 * entrega aos parsers puros. Tudo que é decisão mora nos parsers, que rodam
 * sem arquivo e sem banco.
 */

/**
 * exceljs indexa `row.values` a partir de 1 (a posição 0 vem vazia). O
 * `slice(1)` normaliza para array 0-based, que é o que os parsers esperam.
 */
function linhasDaAba(workbook: ExcelJS.Workbook, nome: string): unknown[][] {
  const worksheet = workbook.getWorksheet(nome);
  if (!worksheet) return [];
  const linhas: unknown[][] = [];
  worksheet.eachRow((row) => {
    linhas.push((row.values as unknown[]).slice(1));
  });
  return linhas;
}

export async function lerAnalitico(bytes: Buffer): Promise<AnaliticoIsaac> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  return parseAnaliticoIsaac(linhasDaAba(workbook, ABA_PARCELAS), linhasDaAba(workbook, ABA_MUDANCAS));
}

export async function lerResumo(bytes: Buffer): Promise<ResumoIsaac> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: bytes });
  try {
    const { text } = await parser.getText();
    return parseResumoIsaac(text);
  } finally {
    await parser.destroy();
  }
}
