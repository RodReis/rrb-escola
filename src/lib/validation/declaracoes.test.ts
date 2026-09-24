import { describe, it, expect } from "vitest";
import { DeclaracaoModeloSchema } from "./declaracoes";

describe("DeclaracaoModeloSchema", () => {
  it("aceita modelo com parâmetros suportados", () => {
    const parsed = DeclaracaoModeloSchema.safeParse({
      nome: "Declaração de Frequência",
      titulo: "DECLARAÇÃO",
      texto: "Aluno [NOME_ALUNO] frequenta [SERIE_CORRENTE].",
      fecho: "[DATA_POR_EXTENSO_SEM_CIDADE]"
    });
    expect(parsed.success).toBe(true);
  });

  it("rejeita modelo com parâmetro desconhecido no texto", () => {
    const parsed = DeclaracaoModeloSchema.safeParse({
      nome: "Modelo com erro",
      titulo: "DECLARAÇÃO",
      texto: "Aluno [NOME_ALNO] frequenta.",
      fecho: "F"
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toContain("[NOME_ALNO]");
    }
  });

  it("rejeita parâmetro desconhecido no título ou no fecho também", () => {
    const noTitulo = DeclaracaoModeloSchema.safeParse({
      nome: "N", titulo: "DECLARAÇÃO [ERRADO]", texto: "T", fecho: "F"
    });
    expect(noTitulo.success).toBe(false);

    const noFecho = DeclaracaoModeloSchema.safeParse({
      nome: "N", titulo: "T", texto: "T", fecho: "[ERRADO]"
    });
    expect(noFecho.success).toBe(false);
  });

  it("exige nome, titulo, texto e fecho não vazios", () => {
    const parsed = DeclaracaoModeloSchema.safeParse({ nome: "", titulo: "", texto: "", fecho: "" });
    expect(parsed.success).toBe(false);
  });
});
