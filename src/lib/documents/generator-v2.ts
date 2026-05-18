import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

export function generateDocxFromBuffer(
  docxBuffer: Buffer,
  variables: Record<string, string>,
): Buffer {
  const zip = new PizZip(docxBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });
  doc.render(variables);
  return doc.getZip().generate({ type: "nodebuffer" }) as Buffer;
}
