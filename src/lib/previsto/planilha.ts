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

/** Seção da planilha -> nome de categoria conhecida. Título sem correspondência (ex.: "PIX  15/09") não sugere. */
const SECAO_PARA_CATEGORIA: Record<string, string> = {
  fornecedores: "Fornecedores",
  impostos: "Impostos",
};

/** Sufixo de empresa colado no nome, só existe na seção IMPOSTOS da planilha real (E4). */
const SUFIXO_EMPRESA = /\s+(ESCOLA|COL[ÉE]GIO)\s*$/i;

function extrairEmpresaDoNome(nome: string): { nome: string; empresa: string | null } {
  const m = nome.match(SUFIXO_EMPRESA);
  if (!m) return { nome, empresa: null };
  return { nome: nome.slice(0, m.index).trim(), empresa: m[1].toUpperCase() };
}

function digitosDocumento(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const digitos = v.replace(/\D/g, "");
  return digitos.length === 6 || digitos.length === 11 || digitos.length === 14 ? digitos : null;
}

/**
 * Recebe o valor BRUTO da célula (antes de `celula()` desembrulhar `{formula, result}`
 * para o `result` puro) — senão a fórmula já virou número e a checagem nunca vê o objeto.
 * Linha 46 real: c6="FORNECEDORES ", c7="Total ", c8={formula, result} — total com
 * nome/rótulo preenchidos, não só total "solto".
 */
function ehLinhaDeTotal(vBruto: ExcelJS.CellValue): boolean {
  return typeof vBruto === "object" && vBruto !== null && !(vBruto instanceof Date) && "formula" in vBruto;
}

/**
 * Planilha real da secretária: sem cabeçalho de coluna, seções tituladas
 * ("PIX  15/09", "FORNECEDORES", "IMPOSTOS"), dados nas colunas 6-9, totais em
 * fórmula intercalados. Ver Task 13 do plano para o achado completo.
 *
 * `dataArquivo` (formato "AAAA-MM-DD") é o fallback de vencimento para seções
 * como PIX, que não trazem data própria — o item já foi pago na data em que a
 * planilha foi feita (E1 da Task 13: decisão do Rodrigo, 25/09).
 */
export async function lerPlanilha(buffer: Buffer, dataArquivo?: string): Promise<ResultadoLeitura> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const ws = wb.worksheets[0];
  if (!ws) return { linhas: [], erro: "A planilha não tem nenhuma aba." };

  const linhas: LinhaPlanilha[] = [];
  let secaoAtual: string | null = null;

  ws.eachRow((row, numero) => {
    if (ehLinhaDeTotal(row.getCell(8).value)) return; // total, nunca é dado — checar ANTES de celula() desembrulhar

    const c6 = textoOuNull(celula(row.getCell(6).value));
    const c7 = celula(row.getCell(7).value);
    const c8raw = celula(row.getCell(8).value);
    const c9 = textoOuNull(celula(row.getCell(9).value));

    const valor = parseValor(c8raw);
    const c7vazio = c7 === null || c7 === undefined || c7 === "";

    if (c6 !== null && valor === null && c7vazio && !c9) {
      secaoAtual = c6; // título de seção
      return;
    }

    if (c6 === null || valor === null) return; // linha de continuação/vazia — fora de escopo (Step 4 do design)

    const { nome, empresa } = extrairEmpresaDoNome(c6);
    const categoriaChave = secaoAtual ? normalizarTexto(secaoAtual).replace(/[^a-z]/g, "") : null;
    const categoria = categoriaChave ? SECAO_PARA_CATEGORIA[categoriaChave] ?? null : null;

    const dataParseada = parseData(c7);
    const dataVencimento = dataParseada ?? dataArquivo ?? null;

    linhas.push({
      linha: numero,
      descricao: nome,
      valor,
      dataVencimento,
      empresa,
      categoria,
      classe: null, // a planilha real não marca fixa/variável — preenchimento manual
      documento: digitosDocumento(c7),
    });
  });

  return { linhas, erro: null };
}
