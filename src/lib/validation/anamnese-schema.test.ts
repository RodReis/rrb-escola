import { describe, it, expect } from "vitest";
import { salvarAnamneseSchema } from "./pipeline";

const base = {
  card_id: "11111111-1111-1111-1111-111111111111",
  consentimento_em: "2026-06-01T10:00:00+00:00",
  termo_versao: "v1",
};

describe("salvarAnamneseSchema — campos PDF completo", () => {
  it("aceita payload com campos novos válidos", () => {
    const r = salvarAnamneseSchema.safeParse({
      ...base,
      como_soube_escola: "Indicação de amiga",
      turno: "matutino",
      data_visita: "2026-05-20",
      crianca_compareceu: true,
      gestacao: "completa",
      atitudes_sociais: "obediente,cooperador",
      intolerancia_frustracao: false,
    });
    expect(r.success).toBe(true);
  });

  it("aceita campos novos ausentes (todos opcionais)", () => {
    const r = salvarAnamneseSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it("rejeita data_visita malformada", () => {
    const r = salvarAnamneseSchema.safeParse({ ...base, data_visita: "20/05/2026" });
    expect(r.success).toBe(false);
  });

  it("rejeita texto acima do limite", () => {
    const r = salvarAnamneseSchema.safeParse({ ...base, como_soube_escola: "x".repeat(501) });
    expect(r.success).toBe(false);
  });

  it("rejeita boolean inválido em campo booleano", () => {
    const r = salvarAnamneseSchema.safeParse({ ...base, crianca_compareceu: "sim" });
    expect(r.success).toBe(false);
  });

  it("exige consentimento_em (não pode faltar)", () => {
    const { card_id } = base;
    const r = salvarAnamneseSchema.safeParse({ card_id });
    expect(r.success).toBe(false);
  });
});
