import { describe, expect, it } from "vitest";
import { mapCredenciamento } from "./historico";

describe("mapCredenciamento", () => {
  it("usa nome_fantasia quando preenchido", () => {
    const row = { name: "Escola Pinguinho de Gente Ltda", nome_fantasia: "EPG Trindade" };
    const resultado = mapCredenciamento(row);
    expect(resultado.nomeFantasia).toBe("EPG Trindade");
    expect(resultado.razaoSocial).toBe("Escola Pinguinho de Gente Ltda");
  });

  it("cai para name quando nome_fantasia esta vazio", () => {
    const row = { name: "Escola Pinguinho de Gente Ltda", nome_fantasia: null };
    const resultado = mapCredenciamento(row);
    expect(resultado.nomeFantasia).toBe("Escola Pinguinho de Gente Ltda");
  });
});
