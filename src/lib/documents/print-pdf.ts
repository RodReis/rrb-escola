"use client";

import mammoth from "mammoth";

export async function printDocxAsPdf(base64: string, nomeArquivo: string): Promise<void> {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

  const result = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer as ArrayBuffer });
  const html = result.value;

  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${nomeArquivo.replace(/\.docx$/i, "")}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: "Times New Roman", Times, serif;
    font-size: 12pt;
    line-height: 1.5;
    margin: 0;
    padding: 2cm 2.5cm;
    color: #000;
  }
  h1 { font-size: 16pt; margin: 0 0 12pt; }
  h2 { font-size: 14pt; margin: 12pt 0 8pt; }
  h3 { font-size: 12pt; margin: 10pt 0 6pt; }
  p  { margin: 0 0 8pt; text-align: justify; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; }
  td, th { border: 1px solid #000; padding: 4pt 6pt; font-size: 11pt; }
  @media print {
    body { padding: 0; }
    @page { margin: 2cm 2.5cm; }
  }
</style>
</head>
<body>${html}</body>
</html>`);
  doc.close();

  iframe.onload = () => {
    iframe.contentWindow!.focus();
    iframe.contentWindow!.print();
    setTimeout(() => document.body.removeChild(iframe), 2000);
  };
}
