import { describe, expect, it } from "vitest";
import {
  casarPrevistos,
  documentoDePrevisto,
  type DebitoParaBaixa,
  type PrevistoAberto,
} from "@/lib/conciliacao/baixa-previsto";

const debito = (over: Partial<DebitoParaBaixa> = {}): DebitoParaBaixa => ({
  id: "d1",
  companyId: null,
  data: "2026-09-20",
  valor: 12356.63,
  documento: null,
  ...over,
});

const previsto = (over: Partial<PrevistoAberto> = {}): PrevistoAberto => ({
  id: "p1",
  valor: 12356.63,
  dataVencimento: "2026-09-20",
  documento: null,
  companyId: null,
  ...over,
});

describe("casarPrevistos", () => {
  it("candidato único casa", () => {
    const r = casarPrevistos([debito()], [previsto()]);
    expect(r.unicas).toEqual([{ debitoId: "d1", lancamentoId: "p1" }]);
    expect(r.ambiguas).toEqual([]);
  });

  it("valor diferente NÃO casa, mesmo por centavos (E3: sem tolerância)", () => {
    const r = casarPrevistos([debito({ valor: 341.92 })], [previsto({ valor: 340 })]);
    expect(r.unicas).toEqual([]);
    expect(r.ambiguas).toEqual([]);
  });

  it("compara em centavos inteiros: 0.1 + 0.2 casa com 0.3", () => {
    const r = casarPrevistos([debito({ valor: 0.1 + 0.2 })], [previsto({ valor: 0.3 })]);
    expect(r.unicas).toHaveLength(1);
  });

  it("respeita a janela de ±5 dias", () => {
    const dentro = casarPrevistos([debito({ data: "2026-09-25" })], [previsto()]);
    const fora = casarPrevistos([debito({ data: "2026-09-26" })], [previsto()]);
    expect(dentro.unicas).toHaveLength(1);
    expect(fora.unicas).toEqual([]);
  });

  it("documento divergente bloqueia; documento ausente de um lado não filtra", () => {
    const diverge = casarPrevistos([debito({ documento: "01816875000129" })], [previsto({ documento: "99999999000199" })]);
    const semDoc = casarPrevistos([debito({ documento: "01816875000129" })], [previsto({ documento: null })]);
    expect(diverge.unicas).toEqual([]);
    expect(semDoc.unicas).toHaveLength(1);
  });

  it("empresa divergente bloqueia; empresa ausente de um lado não filtra", () => {
    const diverge = casarPrevistos([debito({ companyId: "A" })], [previsto({ companyId: "B" })]);
    const semEmpresa = casarPrevistos([debito({ companyId: "A" })], [previsto({ companyId: null })]);
    expect(diverge.unicas).toEqual([]);
    expect(semEmpresa.unicas).toHaveLength(1);
  });

  it("dois títulos candidatos viram ambíguo, nunca escolhe no chute", () => {
    const r = casarPrevistos([debito()], [previsto({ id: "p1" }), previsto({ id: "p2" })]);
    expect(r.unicas).toEqual([]);
    expect(r.ambiguas).toEqual([{ debitoId: "d1", candidatos: ["p1", "p2"] }]);
  });

  it("um título disputado por dois débitos não casa sozinho com nenhum", () => {
    const r = casarPrevistos([debito({ id: "d1" }), debito({ id: "d2" })], [previsto()]);
    expect(r.unicas).toEqual([]);
    expect(r.ambiguas.map((a) => a.debitoId).sort()).toEqual(["d1", "d2"]);
  });
});

describe("documentoDePrevisto", () => {
  it("CPF completo vira a chave de 6 dígitos que o banco mascara", () => {
    expect(documentoDePrevisto("246.701.123-45")).toBe("701123");
  });

  it("CNPJ formatado vira 14 dígitos", () => {
    expect(documentoDePrevisto("01.816.875/0001-29")).toBe("01816875000129");
  });

  it("nome de fornecedor (contraparte livre) não é documento", () => {
    expect(documentoDePrevisto("MARK COLLOR 123")).toBeNull();
    expect(documentoDePrevisto(null)).toBeNull();
  });

  it("número que não tem tamanho de documento é ignorado", () => {
    expect(documentoDePrevisto("12345")).toBeNull();
  });
});
