import ExcelJS from "exceljs";

export type ParsedRow = {
  sheet: string;
  nome: string;
  salario_sem_dsr: number;
  aplica_dobra: boolean;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function cellNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v.replace(",", ".")) || 0;
  if (typeof v === "object" && v !== null && "result" in v) {
    return cellNumber((v as { result: unknown }).result);
  }
  return 0;
}

function cellText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "object" && v !== null && "result" in v) {
    return cellText((v as { result: unknown }).result);
  }
  if (typeof v === "object" && v !== null && "richText" in v) {
    const rt = (v as { richText: Array<{ text: string }> }).richText;
    return rt.map((r) => r.text).join("");
  }
  return String(v);
}

export async function parsePayrollXlsx(buffer: ArrayBuffer | Buffer): Promise<ParsedRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as ArrayBuffer);
  const out: ParsedRow[] = [];

  for (const ws of wb.worksheets) {
    if (/desconto/i.test(ws.name)) continue;

    let headerRow = -1;
    let nomeCol = -1;
    let semDsrCol = -1;
    let dobraCol = -1;

    const scanLimit = Math.min(20, ws.rowCount);
    for (let r = 1; r <= scanLimit; r++) {
      const row = ws.getRow(r);
      let foundSemDsr = false;
      let foundNome = false;
      let foundDobra = false;

      row.eachCell({ includeEmpty: true }, (cell, n) => {
        const raw = cellText(cell.value).toUpperCase().trim();
        if (raw.includes("SALÁRIO S/ DSR") || raw.includes("SALARIO S/ DSR")) {
          semDsrCol = n;
          foundSemDsr = true;
        } else if (raw === "FUNCIONÁRIOS" || raw === "FUNCIONARIOS") {
          nomeCol = n;
          foundNome = true;
        } else if (raw.includes("SALÁRIO DOBRA") || raw.includes("SALARIO DOBRA")) {
          dobraCol = n;
          foundDobra = true;
        }
      });

      if (foundSemDsr && foundNome) {
        headerRow = r;
        // dobra optional but useful
        void foundDobra;
        break;
      }
    }

    if (headerRow < 0 || nomeCol < 0 || semDsrCol < 0) continue;

    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const nome = cellText(row.getCell(nomeCol).value).trim();
      if (!nome) continue;
      // Skip if nome is numeric or section header
      if (/^\d+$/.test(nome)) continue;

      const semDsrVal = cellNumber(row.getCell(semDsrCol).value);
      if (semDsrVal <= 0) continue;

      const dobraVal = dobraCol > 0 ? cellNumber(row.getCell(dobraCol).value) : 0;
      const aplica_dobra = dobraVal > 0;

      out.push({
        sheet: ws.name,
        nome,
        salario_sem_dsr: round2(semDsrVal),
        aplica_dobra
      });
    }
  }

  return out;
}

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
