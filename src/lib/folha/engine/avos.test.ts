import { describe, expect, it } from "vitest";
import { avos, mediaBase12, baseCalculo13Ferias } from "./avos";

describe("avos", () => {
  it("ano completo = 12", () => {
    expect(avos("2020-03-10", null, 2026)).toBe(12);
  });
  it("admissao 20/jun (10 dias em junho, <15) = 6 avos (jul-dez)", () => {
    expect(avos("2026-06-20", null, 2026)).toBe(6);
  });
  it("admissao 10/jun (>=15 dias em junho) = 7 avos", () => {
    expect(avos("2026-06-10", null, 2026)).toBe(7);
  });
  it("desligamento 14/out (<15 dias em out) = 9 avos", () => {
    expect(avos("2020-01-01", "2026-10-14", 2026)).toBe(9);
  });
});

describe("mediaBase12", () => {
  it("media de 12 valores", () => {
    expect(mediaBase12(Array(12).fill(3000))).toBe(3000);
  });
  it("menos de 12 meses usa o que existir", () => {
    expect(mediaBase12([3000, 3300, 3600])).toBe(3300);
  });
  it("vazio retorna null (chamador decide fallback)", () => {
    expect(mediaBase12([])).toBeNull();
  });
});

describe("baseCalculo13Ferias", () => {
  const cfg = { clt_professor: "media_12", clt: "vigente" } as Record<string, string>;
  it("professor usa media", () => {
    expect(baseCalculo13Ferias("clt_professor", cfg, 5000, [4000, 4400])).toBe(4200);
  });
  it("clt usa vigente", () => {
    expect(baseCalculo13Ferias("clt", cfg, 5000, [4000])).toBe(5000);
  });
  it("media sem historico cai para vigente", () => {
    expect(baseCalculo13Ferias("clt_professor", cfg, 5000, [])).toBe(5000);
  });
});
