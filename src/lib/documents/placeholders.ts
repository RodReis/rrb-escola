import PizZip from "pizzip";

/**
 * Extrai placeholders {NOME} de um .docx (em Buffer).
 * Lê word/document.xml do zip, regex em [A-Z0-9_]+ entre chaves.
 * Retorna nomes deduplicados, ordem de primeira aparição.
 */
export function extractPlaceholders(docxBuffer: Buffer): string[] {
  const zip = new PizZip(docxBuffer);
  const doc = zip.file("word/document.xml");
  if (!doc) return [];
  const xml = doc.asText();
  // Remove tags XML para não pegar { dentro de atributos
  const text = xml.replace(/<[^>]+>/g, "");
  const seen = new Set<string>();
  const out: string[] = [];
  const re = /\{([A-Z0-9_]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const name = m[1];
    if (!seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}
