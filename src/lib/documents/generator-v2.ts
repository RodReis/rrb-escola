import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

export type GenerateResult = {
  buffer: Buffer;
  missing: string[];
};

export function generateDocxFromBuffer(
  docxBuffer: Buffer,
  variables: Record<string, string>,
): GenerateResult {
  const zip = new PizZip(docxBuffer);
  const missing = new Set<string>();

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: (part: unknown) => {
      const name =
        part && typeof part === "object" && "value" in part && typeof (part as { value: unknown }).value === "string"
          ? (part as { value: string }).value
          : "?";
      missing.add(name);
      return `<<${name}>>`;
    },
  });
  doc.render(variables);

  const buffer = doc.getZip().generate({ type: "nodebuffer" }) as Buffer;
  return { buffer, missing: Array.from(missing) };
}
