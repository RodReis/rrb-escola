import { describe, it, expect } from "vitest";
import { TemplateConfigSchema, configPadrao, validarEmissao } from "./tipos";

describe("TemplateConfigSchema", () => {
  it("config padrão é válida", () => {
    expect(TemplateConfigSchema.safeParse(configPadrao("aluno")).success).toBe(true);
    expect(TemplateConfigSchema.safeParse(configPadrao("funcionario")).success).toBe(true);
  });
  it("grade/tabular exigem título", () => {
    const c = { ...configPadrao("aluno"), formato: "grade" as const, titulo: "  " };
    expect(TemplateConfigSchema.safeParse(c).success).toBe(false);
  });
  it("limites de cópias, fonte e logos", () => {
    const b = configPadrao("aluno");
    expect(TemplateConfigSchema.safeParse({ ...b, copias: 11 }).success).toBe(false);
    expect(TemplateConfigSchema.safeParse({ ...b, fonte: 7.3 }).success).toBe(false);
    expect(TemplateConfigSchema.safeParse({ ...b, logosEmpresas: ["a", "b", "c", "d", "e"].map(() => crypto.randomUUID()) }).success).toBe(false);
  });
  it("ordenação só por coluna selecionada; colunas sem repetição", () => {
    const b = configPadrao("aluno");
    expect(TemplateConfigSchema.safeParse({ ...b, ordenacao: [{ key: "x.y", dir: "asc" }] }).success).toBe(false);
    expect(TemplateConfigSchema.safeParse({ ...b, colunas: ["aluno.nome", "aluno.nome"] }).success).toBe(false);
  });
});

describe("validarEmissao", () => {
  it("bloqueia sem registro, sem coluna e acima do limite", () => {
    const c = configPadrao("aluno");
    expect(validarEmissao(c, 0)).toMatch(/registro/);
    expect(validarEmissao({ ...c, colunas: [], ordenacao: [] }, 1)).toMatch(/coluna/);
    expect(validarEmissao(c, 2001)).toMatch(/2000/);
    expect(validarEmissao(c, 5)).toBeNull();
  });
});
