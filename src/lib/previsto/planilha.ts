import { createHash } from "node:crypto";
import ExcelJS from "exceljs";

export type LinhaPlanilha = {
  /** Número da linha na planilha (cabeçalho = 1), para a secretária achar o erro. */
  linha: number;
  descricao: string;
  valor: number | null;
  dataVencimento: string | null;
  empresa: string | null;
  categoria: string | null;
  classe: "fixa" | "variavel" | null;
  documento: string | null;
};

export type ResultadoLeitura = { linhas: LinhaPlanilha[]; erro: string | null };

export function normalizarTexto(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Cabeçalho normalizado -> campo. Ajustar aqui quando a planilha real divergir.
const ALIASES: Record<string, keyof Omit<LinhaPlanilha, "linha">> = {
  descricao: "descricao", despesa: "descricao", nome: "descricao", historico: "descricao",
  valor: "valor",
  vence_em: "dataVencimento", vencimento: "dataVencimento", data_vencimento: "dataVencimento",
  empresa: "empresa", cnpj_empresa: "empresa",
  categoria: "categoria", tipo_despesa: "categoria",
  classe: "classe", fixo_variavel: "classe", fixo_vairavel: "classe", tipo: "classe",
  documento: "documento", cpf_cnpj: "documento", cpf_cnpj_fornecedor: "documento",
};

const OBRIGATORIOS: Array<[keyof Omit<LinhaPlanilha, "linha">, string]> = [
  ["descricao", "DESCRICAO"],
  ["valor", "VALOR"],
  ["dataVencimento", "VENCE_EM"],
];

function chaveDeCabecalho(v: unknown): string {
  return normalizarTexto(String(v ?? "")).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function parseValor(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : null;
  if (typeof v !== "string") return null;
  const limpo = v.replace(/[^\d,.-]/g, "");
  if (!limpo) return null;
  // "1.234,56" (pt-BR) -> 1234.56; "1234.56" sem vírgula já está certo.
  const n = Number(limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isoValida(ano: number, mes: number, dia: number): string | null {
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function parseData(v: unknown): string | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  if (typeof v !== "string") return null;
  const br = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return isoValida(Number(br[3]), Number(br[2]), Number(br[1]));
  const iso = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return isoValida(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  return null;
}

/** "VAIRAVEL" (typo real da planilha de setembro) entra como variável. */
function parseClasse(v: unknown): "fixa" | "variavel" | null {
  const t = normalizarTexto(String(v ?? ""));
  if (t.startsWith("fix")) return "fixa";
  if (t.startsWith("var") || t.startsWith("vai")) return "variavel";
  return null;
}

function textoOuNull(v: unknown): string | null {
  const t = String(v ?? "").trim();
  return t === "" ? null : t;
}

/** Chave de idempotência do reenvio. A descrição entra normalizada. */
export function hashImport(p: { competencia: string; descricao: string; valor: number; dataVencimento: string }): string {
  const base = [p.competencia, normalizarTexto(p.descricao), Math.round(p.valor * 100), p.dataVencimento].join("|");
  return createHash("sha256").update(base).digest("hex");
}

function celula(v: ExcelJS.CellValue): unknown {
  if (v && typeof v === "object" && !(v instanceof Date)) {
    if ("result" in v) return (v as { result: unknown }).result;
    if ("richText" in v) return (v as { richText: Array<{ text: string }> }).richText.map((r) => r.text).join("");
    if ("text" in v) return (v as { text: unknown }).text;
  }
  return v;
}

export async function lerPlanilha(buffer: Buffer): Promise<ResultadoLeitura> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const ws = wb.worksheets[0];
  if (!ws) return { linhas: [], erro: "A planilha não tem nenhuma aba." };

  const colunas = new Map<keyof Omit<LinhaPlanilha, "linha">, number>();
  ws.getRow(1).eachCell((cell, col) => {
    const campo = ALIASES[chaveDeCabecalho(celula(cell.value))];
    if (campo && !colunas.has(campo)) colunas.set(campo, col);
  });

  const faltando = OBRIGATORIOS.filter(([campo]) => !colunas.has(campo)).map(([, nome]) => nome);
  if (faltando.length > 0) {
    return { linhas: [], erro: `Colunas obrigatórias ausentes: ${faltando.join(", ")}. Confira a linha 1 da planilha.` };
  }

  const pega = (row: ExcelJS.Row, campo: keyof Omit<LinhaPlanilha, "linha">) => {
    const col = colunas.get(campo);
    return col ? celula(row.getCell(col).value) : null;
  };

  const linhas: LinhaPlanilha[] = [];
  ws.eachRow((row, numero) => {
    if (numero === 1) return;
    const descricao = textoOuNull(pega(row, "descricao"));
    const valorBruto = pega(row, "valor");
    const dataBruta = pega(row, "dataVencimento");
    if (!descricao && (valorBruto === null || valorBruto === "") && (dataBruta === null || dataBruta === "")) return;

    linhas.push({
      linha: numero,
      descricao: descricao ?? "",
      valor: parseValor(valorBruto),
      dataVencimento: parseData(dataBruta),
      empresa: textoOuNull(pega(row, "empresa")),
      categoria: textoOuNull(pega(row, "categoria")),
      classe: parseClasse(pega(row, "classe")),
      documento: textoOuNull(pega(row, "documento")),
    });
  });

  return { linhas, erro: null };
}
