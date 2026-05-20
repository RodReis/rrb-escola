import ExcelJS from "exceljs";

export type StudentImportData = {
  matricula_codigo: string;
  nome: string;
  cpf: string | null;
  rg: string | null;
  data_nascimento: string | null;
  sexo: string | null;
  celular: string | null;
  email: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  responsavel_nome: string | null;
  responsavel_cpf: string | null;
  responsavel_telefone: string | null;
  responsavel_celular: string | null;
  responsavel_parentesco: string | null;
  responsavel_email: string | null;
  serie: string | null;
  turma: string | null;
  plano: string | null;
  ano_letivo: number | null;
  data_matricula: string | null;
  idade_na_matricula: number | null;
};

export type ParsedStudentImportRow = {
  line: number;
  data: StudentImportData;
};

const emptyRow: StudentImportData = {
  matricula_codigo: "",
  nome: "",
  cpf: null,
  rg: null,
  data_nascimento: null,
  sexo: null,
  celular: null,
  email: null,
  logradouro: null,
  numero: null,
  bairro: null,
  cidade: null,
  uf: null,
  cep: null,
  responsavel_nome: null,
  responsavel_cpf: null,
  responsavel_telefone: null,
  responsavel_celular: null,
  responsavel_parentesco: null,
  responsavel_email: null,
  serie: null,
  turma: null,
  plano: null,
  ano_letivo: null,
  data_matricula: null,
  idade_na_matricula: null
};

const aliases: Record<keyof StudentImportData, string[]> = {
  matricula_codigo: ["matricula", "matricula codigo", "codigo matricula", "codigo", "ra"],
  nome: ["nome", "aluno", "nome aluno", "nome do aluno"],
  cpf: ["cpf"],
  rg: ["rg"],
  data_nascimento: ["data nascimento", "dt nascimento", "nascimento", "data de nascimento"],
  sexo: ["sexo", "genero"],
  celular: ["celular", "telefone aluno", "celular aluno"],
  email: ["email", "e-mail", "email aluno"],
  logradouro: ["endereco", "logradouro", "rua"],
  numero: ["numero", "n", "no"],
  bairro: ["bairro"],
  cidade: ["cidade"],
  uf: ["uf", "estado"],
  cep: ["cep"],
  responsavel_nome: ["responsavel", "responsavel nome", "nome responsavel", "mae", "pai"],
  responsavel_cpf: ["cpf responsavel", "responsavel cpf"],
  responsavel_telefone: ["telefone responsavel", "responsavel telefone"],
  responsavel_celular: ["celular responsavel", "responsavel celular"],
  responsavel_parentesco: ["parentesco", "responsavel parentesco"],
  responsavel_email: ["email responsavel", "e-mail responsavel", "responsavel email"],
  serie: ["serie", "série", "ano", "ano serie"],
  turma: ["turma", "classe"],
  plano: ["plano", "plano financeiro"],
  ano_letivo: ["ano letivo", "letivo"],
  data_matricula: ["data matricula", "data de matricula", "matriculado em"],
  idade_na_matricula: ["idade", "idade na matricula"]
};

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function text(value: unknown) {
  const result = String(value ?? "").trim();
  return result || null;
}

function numberValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function dateValue(value: unknown) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);

  const raw = String(value).trim();
  const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;

  return null;
}

function aliasMap(headers: string[]) {
  const normalizedHeaders = new Map(headers.map((header) => [normalize(header), header]));
  const result = new Map<keyof StudentImportData, string>();

  for (const [field, fieldAliases] of Object.entries(aliases) as Array<[keyof StudentImportData, string[]]>) {
    for (const alias of fieldAliases) {
      const match = normalizedHeaders.get(normalize(alias));
      if (match) {
        result.set(field, match);
        break;
      }
    }
  }

  return result;
}

function buildRow(raw: Record<string, unknown>) {
  const mapped = aliasMap(Object.keys(raw));
  const row = { ...emptyRow };

  for (const field of Object.keys(emptyRow) as Array<keyof StudentImportData>) {
    const column = mapped.get(field);
    if (!column) continue;
    const value = raw[column];

    if (field === "ano_letivo" || field === "idade_na_matricula") {
      row[field] = numberValue(value) as never;
    } else if (field === "data_nascimento" || field === "data_matricula") {
      row[field] = dateValue(value) as never;
    } else {
      row[field] = text(value) as never;
    }
  }

  row.matricula_codigo = row.matricula_codigo || "";
  row.nome = row.nome || "";
  return row;
}

function parseCsv(textContent: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < textContent.length; index += 1) {
    const char = textContent[index];
    const next = textContent[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  row.push(current);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function rowsToObjects(rows: string[][]) {
  const headers = rows[0] ?? [];
  return rows.slice(1).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]))
  );
}

export async function parseSpreadsheetStudents(buffer: Buffer, fileName: string): Promise<ParsedStudentImportRow[]> {
  const isCsv = fileName.toLowerCase().endsWith(".csv");
  const rows = isCsv ? rowsToObjects(parseCsv(buffer.toString("utf8"))) : await parseExcelRows(buffer);

  return rows
    .map((raw, index) => ({ line: index + 2, data: buildRow(raw) }))
    .filter((row) => row.data.matricula_codigo || row.data.nome);
}

async function parseExcelRows(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headerRow = worksheet.getRow(1);
  const headers = headerRow.values as unknown[];
  const headerValues = headers.slice(1).map((value) => String(value ?? ""));
  const rows: Array<Record<string, unknown>> = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = row.values as unknown[];
    const item: Record<string, unknown> = {};
    headerValues.forEach((header, index) => {
      item[header] = values[index + 1] ?? "";
    });
    if (Object.values(item).some((value) => String(value ?? "").trim())) rows.push(item);
  });

  return rows;
}

function valueAfter(textContent: string, labels: string[]) {
  for (const label of labels) {
    const regex = new RegExp(`${label}\\s*[:\\-]?\\s*([^\\n\\r]+)`, "i");
    const match = textContent.match(regex);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function buildPdfRow(block: string, index: number): ParsedStudentImportRow {
  const data = { ...emptyRow };
  data.matricula_codigo = valueAfter(block, ["matricula", "matrícula"]) ?? "";
  data.nome = valueAfter(block, ["nome"]) ?? "";
  data.cpf = valueAfter(block, ["cpf"]);
  data.rg = valueAfter(block, ["rg"]);
  data.data_nascimento = dateValue(valueAfter(block, ["dt nascimento", "data nascimento", "nascimento"]));
  data.sexo = valueAfter(block, ["sexo"]);
  data.celular = valueAfter(block, ["celular"]);
  data.email = valueAfter(block, ["e mail", "email"]);
  data.logradouro = valueAfter(block, ["endereco", "endereço"]);
  data.cidade = valueAfter(block, ["cidade"]);
  data.uf = valueAfter(block, ["uf"]);
  data.cep = valueAfter(block, ["cep"]);
  data.responsavel_nome = valueAfter(block, ["mae", "mãe", "responsavel", "responsável"]);
  data.responsavel_celular = valueAfter(block, ["telefone responsavel", "celular responsavel"]);
  data.serie = valueAfter(block, ["serie", "série"]);
  data.turma = valueAfter(block, ["turma"]);
  data.ano_letivo = numberValue(valueAfter(block, ["ano letivo"])) ?? new Date().getFullYear();

  return { line: index + 1, data };
}

export async function parsePdfStudents(buffer: Buffer): Promise<ParsedStudentImportRow[]> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const textContent = result.text.replace(/\r/g, "\n");
    const blocks = textContent
      .split(/(?=matr[íi]cula\s*[:\n])/i)
      .map((block) => block.trim())
      .filter((block) => /matr[íi]cula/i.test(block) || /ficha do aluno/i.test(block));

    const parsed = blocks.map(buildPdfRow).filter((row) => row.data.matricula_codigo || row.data.nome);
    return parsed.length ? parsed : [buildPdfRow(textContent, 0)].filter((row) => row.data.matricula_codigo || row.data.nome);
  } finally {
    await parser.destroy();
  }
}
