import path from "path";
import fs from "fs";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { jsPDF } from "jspdf";
import type { DocumentVariables } from "./variables";
import { TEMPLATE_META, type TipoTemplate } from "./templates";

export function generateDocx(
  tipoTemplate: TipoTemplate,
  variables: DocumentVariables
): Buffer {
  const meta = TEMPLATE_META[tipoTemplate];
  const templatePath = path.join(process.cwd(), "public", "templates", meta.arquivo);
  const content = fs.readFileSync(templatePath);

  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });

  doc.render(variables as unknown as Record<string, string>);

  return doc.getZip().generate({ type: "nodebuffer" }) as Buffer;
}

export function extractTextFromDocx(docxBuffer: Buffer): string {
  const zip = new PizZip(docxBuffer);
  const documentXml = zip.files["word/document.xml"]?.asText() ?? "";
  return documentXml
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, "\n")
    .trim();
}

export function generatePdf(text: string, titulo: string): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(titulo, pageWidth / 2, 20, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const lines = doc.splitTextToSize(text, maxWidth);
  let y = 32;
  const lineHeight = 5;
  const pageHeight = doc.internal.pageSize.getHeight();

  for (const line of lines) {
    if (y + lineHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += lineHeight;
  }

  return Buffer.from(doc.output("arraybuffer"));
}

export async function generateDocumentoPdf(
  tipoTemplate: TipoTemplate,
  variables: DocumentVariables
): Promise<{ pdfBuffer: Buffer; nomeArquivo: string }> {
  const meta = TEMPLATE_META[tipoTemplate];
  const docxBuffer = generateDocx(tipoTemplate, variables);
  const text = extractTextFromDocx(docxBuffer);
  const nomeAluno = variables.NOME_ALUNO || "Aluno";
  const anoLetivo = variables.ANO_LETIVO || String(new Date().getFullYear());
  const nomeArquivo = `${meta.label} - ${nomeAluno} - ${anoLetivo}.pdf`;
  const pdfBuffer = generatePdf(text, meta.label);
  return { pdfBuffer, nomeArquivo };
}
