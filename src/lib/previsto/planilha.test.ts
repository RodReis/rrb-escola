import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { hashImport, lerPlanilha, normalizarTexto, parseData, parseValor } from "@/lib/previsto/planilha";

async function planilha(linhas: unknown[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("contas");
  for (const l of linhas) ws.addRow(l);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("parseValor", () => {
  it("aceita número, '1.234,56' e 'R$ 341,92'", () => {
    expect(parseValor(340)).toBe(340);
    expect(parseValor("1.234,56")).toBe(1234.56);
    expect(parseValor("R$ 341,92")).toBe(341.92);
  });
  it("lixo vira null", () => {
    expect(parseValor("abc")).toBeNull();
    expect(parseValor("")).toBeNull();
  });
});

describe("parseData", () => {
  it("aceita Date, dd/mm/aaaa e aaaa-mm-dd", () => {
    expect(parseData(new Date(Date.UTC(2026, 9, 2)))).toBe("2026-10-02");
    expect(parseData("02/10/2026")).toBe("2026-10-02");
    expect(parseData("2026-10-02")).toBe("2026-10-02");
  });
  it("data impossível vira null", () => {
    expect(parseData("31/02/2026")).toBeNull();
    expect(parseData("ontem")).toBeNull();
  });
});

describe("normalizarTexto", () => {
  it("tira acento, caixa e espaço duplicado", () => {
    expect(normalizarTexto("  Colégio   INTEGRADO ")).toBe("colegio integrado");
  });
});

describe("hashImport", () => {
  it("é estável e ignora caixa/acento/espaço da descrição", () => {
    const a = hashImport({ competencia: "2026-09", descricao: "Água  Sabesp", valor: 341.92, dataVencimento: "2026-09-10" });
    const b = hashImport({ competencia: "2026-09", descricao: "agua sabesp", valor: 341.92, dataVencimento: "2026-09-10" });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
  it("muda com o valor", () => {
    const a = hashImport({ competencia: "2026-09", descricao: "x", valor: 1, dataVencimento: "2026-09-10" });
    const b = hashImport({ competencia: "2026-09", descricao: "x", valor: 1.01, dataVencimento: "2026-09-10" });
    expect(a).not.toBe(b);
  });
});

describe("lerPlanilha", () => {
  it("lê cabeçalhos com apelido e devolve linhas normalizadas", async () => {
    const buf = await planilha([
      ["DESCRIÇÃO", "VALOR", "VENCE EM", "EMPRESA", "TIPO-DESPESA", "FIXO/VAIRAVEL", "CPF/CNPJ"],
      ["FGTS", 1234.5, "18/09/2026", "ESCOLA", "Impostos", "FIXO", ""],
      ["MARK COLLOR", "R$ 800,00", new Date(Date.UTC(2026, 9, 2)), "", "Outros", "VAIRAVEL", "246.701.123-45"],
    ]);
    const r = await lerPlanilha(buf);
    expect(r.erro).toBeNull();
    expect(r.linhas).toEqual([
      { linha: 2, descricao: "FGTS", valor: 1234.5, dataVencimento: "2026-09-18", empresa: "ESCOLA", categoria: "Impostos", classe: "fixa", documento: null },
      { linha: 3, descricao: "MARK COLLOR", valor: 800, dataVencimento: "2026-10-02", empresa: null, categoria: "Outros", classe: "variavel", documento: "246.701.123-45" },
    ]);
  });

  it("falta coluna obrigatória: erro claro listando o que faltou", async () => {
    const buf = await planilha([["DESCRIÇÃO", "VALOR"], ["x", 1]]);
    const r = await lerPlanilha(buf);
    expect(r.linhas).toEqual([]);
    expect(r.erro).toContain("VENCE_EM");
  });

  it("linha com valor ou data ilegíveis vem marcada, não some", async () => {
    const buf = await planilha([["DESCRIÇÃO", "VALOR", "VENCE EM"], ["Luz", "abc", "10/10/2026"]]);
    const r = await lerPlanilha(buf);
    expect(r.linhas[0]).toMatchObject({ linha: 2, descricao: "Luz", valor: null, dataVencimento: "2026-10-10" });
  });

  it("ignora linhas totalmente vazias", async () => {
    const buf = await planilha([["DESCRIÇÃO", "VALOR", "VENCE EM"], [null, null, null], ["Luz", 10, "10/10/2026"]]);
    const r = await lerPlanilha(buf);
    expect(r.linhas.map((l) => l.linha)).toEqual([3]);
  });
});
