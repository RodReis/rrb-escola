import PizZip from "pizzip";

/**
 * Extrai placeholders {NOME} de um .docx (em Buffer).
 * Varre word/document.xml + qualquer word/header*.xml ou word/footer*.xml.
 * Regex [A-Z0-9_]+ entre chaves. Deduplicado, ordem de primeira aparição.
 */
export function extractPlaceholders(docxBuffer: Buffer): string[] {
  const zip = new PizZip(docxBuffer);
  const re = /\{([A-Z0-9_]+)\}/g;
  const seen = new Set<string>();
  const out: string[] = [];

  const files = zip.file(/^word\/(document|header\d*|footer\d*)\.xml$/);
  for (const f of files) {
    const xml = f.asText();
    const text = xml.replace(/<[^>]+>/g, "");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const name = m[1];
      if (!seen.has(name)) {
        seen.add(name);
        out.push(name);
      }
    }
  }
  return out;
}
