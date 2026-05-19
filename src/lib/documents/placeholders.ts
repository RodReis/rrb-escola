import PizZip from "pizzip";

/**
 * Extrai placeholders {NOME} de um .docx (em Buffer).
 *
 * Mimica o run-merging do docxtemplater: extrai SÓ o conteúdo de <w:t> em ordem
 * e concatena, ignorando runs/properties/paragraph breaks intermediários. Isso
 * garante que tags fragmentadas pelo Word (ex: `{NOME` em um run + `_ALUNO}`
 * em outro) sejam detectadas.
 *
 * Varre word/document.xml + word/header*.xml + word/footer*.xml.
 * Regex [A-Z0-9_]+ entre chaves. Deduplicado, ordem de primeira aparição.
 */
export function extractPlaceholders(docxBuffer: Buffer): string[] {
  const zip = new PizZip(docxBuffer);
  const re = /\{([A-Z0-9_]+)\}/g;
  const seen = new Set<string>();
  const out: string[] = [];

  // Captura conteúdo de <w:t> e <w:t xml:space="preserve">.
  const wtRe = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;

  const files = zip.file(/^word\/(document|header\d*|footer\d*)\.xml$/);
  for (const f of files) {
    const xml = f.asText();
    const parts: string[] = [];
    let wm: RegExpExecArray | null;
    while ((wm = wtRe.exec(xml)) !== null) {
      parts.push(wm[1]);
    }
    const merged = parts.join("");

    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(merged)) !== null) {
      const name = m[1];
      if (!seen.has(name)) {
        seen.add(name);
        out.push(name);
      }
    }
  }
  return out;
}
