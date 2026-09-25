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

describe("lerPlanilha (formato real: seções, sem cabeçalho)", () => {
  async function planilhaSecoes(linhas: Array<Record<number, unknown>>): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Plan1");
    ws.addRow([]); // linha 1 vazia
    ws.addRow([]); // linha 2 vazia
    for (const linha of linhas) {
      const row = ws.addRow([]);
      for (const [col, val] of Object.entries(linha)) row.getCell(Number(col)).value = val as ExcelJS.CellValue;
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  it("linha de seção não vira dado; linhas seguintes herdam a categoria dela", async () => {
    const buf = await planilhaSecoes([
      { 6: "FORNECEDORES" },
      { 6: "ICARUS", 7: new Date(Date.UTC(2026, 8, 10)), 8: 295.41 },
    ]);
    const r = await lerPlanilha(buf);
    expect(r.erro).toBeNull();
    expect(r.linhas).toEqual([
      { linha: 4, descricao: "ICARUS", valor: 295.41, dataVencimento: "2026-09-10", empresa: null, categoria: "Fornecedores", classe: null, documento: null },
    ]);
  });

  it("linha de total (fórmula em c8) nunca vira dado", async () => {
    const buf = await planilhaSecoes([
      { 6: "FORNECEDORES" },
      { 6: "ICARUS", 7: new Date(Date.UTC(2026, 8, 10)), 8: 295.41 },
      { 8: { formula: "SUM(H4:H4)", result: 295.41 } },
    ]);
    const r = await lerPlanilha(buf);
    expect(r.linhas).toHaveLength(1);
  });

  it("ESCOLA/COLÉGIO coladas no nome (seção IMPOSTOS) viram empresa e saem do nome", async () => {
    const buf = await planilhaSecoes([
      { 6: "IMPOSTOS" },
      { 6: "FGTS ESCOLA", 7: new Date(Date.UTC(2026, 8, 18)), 8: 8450.9 },
      { 6: "ISS COLÉGIO", 7: new Date(Date.UTC(2026, 8, 21)), 8: 840.3 },
    ]);
    const r = await lerPlanilha(buf);
    expect(r.linhas[0]).toMatchObject({ descricao: "FGTS", empresa: "ESCOLA", categoria: "Impostos" });
    expect(r.linhas[1]).toMatchObject({ descricao: "ISS", empresa: "COLÉGIO", categoria: "Impostos" });
  });

  it("fora de IMPOSTOS, empresa é sempre null (sem pista no formato real)", async () => {
    const buf = await planilhaSecoes([
      { 6: "PIX  15/09" },
      { 6: "Celso Aparecido Borges Ltda", 7: "pix CNPJ 49.584.483/0001-08", 8: 800, 9: "1/2 PASTAS" },
    ]);
    const r = await lerPlanilha(buf);
    expect(r.linhas[0].empresa).toBeNull();
  });

  it("documento é reconhecido dentro de texto livre em c7 (CNPJ/CPF misturado com rótulo)", async () => {
    const buf = await planilhaSecoes([
      { 6: "PIX  15/09" },
      { 6: "Celso Aparecido Borges Ltda", 7: "pix CNPJ 49.584.483/0001-08", 8: 800 },
    ]);
    const r = await lerPlanilha(buf);
    expect(r.linhas[0].documento).toBe("49584483000108");
  });

  it("c7 sem data reconhecível (contato/telefone) usa a data do arquivo, não null", async () => {
    const buf = await planilhaSecoes([
      { 6: "PIX  15/09" },
      { 6: "João Oliveira da Costa", 7: "62 98647-8123", 8: 441 },
    ]);
    const r = await lerPlanilha(buf, "2026-09-15");
    expect(r.linhas[0].dataVencimento).toBe("2026-09-15");
  });

  it("linha sem nome (c6 vazio) ou sem valor (c8 vazio) não vira dado (linha de continuação rara)", async () => {
    const buf = await planilhaSecoes([
      { 6: "PIX  15/09" },
      { 7: "2026-09-20T00:00:00.000Z", 8: 1296.8 }, // c6 ausente — linha 21 do arquivo real
    ]);
    const r = await lerPlanilha(buf);
    expect(r.linhas).toHaveLength(0);
  });

  it("nenhuma seção reconhecida (arquivo vazio de verdade) devolve lista vazia, não erro", async () => {
    const buf = await planilhaSecoes([]);
    const r = await lerPlanilha(buf);
    expect(r.erro).toBeNull();
    expect(r.linhas).toEqual([]);
  });
});
