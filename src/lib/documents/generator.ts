import path from "path";
import fs from "fs";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import mammoth from "mammoth";
import type { DocumentVariables } from "./variables";
import { TEMPLATE_META, type TipoTemplate } from "./templates";

export function generateDocx(
  tipoTemplate: TipoTemplate,
  variables: DocumentVariables
): Buffer {
  const meta = TEMPLATE_META[tipoTemplate];
  const templatePath = path.join(process.cwd(), "public", "templates", meta.arquivo);
  const resolved = path.resolve(templatePath);
  const allowed = path.resolve(path.join(process.cwd(), "public", "templates"));
  if (!resolved.startsWith(allowed + path.sep)) {
    throw new Error("Invalid template path");
  }
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

async function docxBufferToHtml(docxBuffer: Buffer): Promise<string> {
  const result = await mammoth.convertToHtml(
    { buffer: docxBuffer },
    {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "b => strong",
        "i => em",
      ],
    }
  );
  return result.value;
}

async function htmlToPdf(html: string): Promise<Buffer> {
  // Dynamic import to avoid loading puppeteer at module init time
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();

    const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #000;
    padding: 2cm 2.5cm;
  }
  h1 { font-size: 14pt; font-weight: bold; text-align: center; margin: 12pt 0 8pt; }
  h2 { font-size: 12pt; font-weight: bold; margin: 10pt 0 6pt; }
  h3 { font-size: 11pt; font-weight: bold; margin: 8pt 0 4pt; }
  p  { margin-bottom: 6pt; text-align: justify; }
  strong { font-weight: bold; }
  em { font-style: italic; }
  table { width: 100%; border-collapse: collapse; margin: 8pt 0; }
  td, th { border: 1px solid #ccc; padding: 4pt 6pt; font-size: 10pt; }
  @media print {
    body { padding: 0; }
  }
</style>
</head>
<body>${html}</body>
</html>`;

    await page.setContent(fullHtml, { waitUntil: "load" });

    const pdfBytes = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "2cm", bottom: "2cm", left: "2.5cm", right: "2.5cm" },
    });

    return Buffer.from(pdfBytes);
  } finally {
    await browser.close();
  }
}

export async function generateDocumentoPdf(
  tipoTemplate: TipoTemplate,
  variables: DocumentVariables
): Promise<{ pdfBuffer: Buffer; nomeArquivo: string }> {
  const meta = TEMPLATE_META[tipoTemplate];
  const docxBuffer = generateDocx(tipoTemplate, variables);
  const html = await docxBufferToHtml(docxBuffer);
  const pdfBuffer = await htmlToPdf(html);

  const nomeAluno = (variables.NOME_ALUNO || "Aluno")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  const anoLetivo = variables.ANO_LETIVO || String(new Date().getFullYear());
  const nomeArquivo = `${meta.label} - ${nomeAluno} - ${anoLetivo}.pdf`
    .replace(/[/\\:*?"<>|]/g, "-");

  return { pdfBuffer, nomeArquivo };
}
