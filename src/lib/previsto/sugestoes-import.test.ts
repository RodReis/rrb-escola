import { describe, expect, it } from "vitest";
import { sugerirCategoria, sugerirEmpresa } from "@/lib/previsto/sugestoes-import";

const empresas = [
  { id: "e-ping", nome: "Escola Pinguinho de Gente", cnpj: "11714876000116" },
  { id: "e-int", nome: "Colégio Integrado", cnpj: "35027047000123" },
];

describe("sugerirEmpresa", () => {
  it("ESCOLA -> Pinguinho, COLÉGIO -> Integrado (regra do spec, E4)", () => {
    expect(sugerirEmpresa("ESCOLA", empresas)).toBe("e-ping");
    expect(sugerirEmpresa("COLÉGIO", empresas)).toBe("e-int");
  });
  it("casa por CNPJ formatado", () => {
    expect(sugerirEmpresa("35.027.047/0001-23", empresas)).toBe("e-int");
  });
  it("casa por nome exato, ignorando caixa e acento", () => {
    expect(sugerirEmpresa("colegio integrado", empresas)).toBe("e-int");
  });
  it("vazio ou desconhecido não sugere nada", () => {
    expect(sugerirEmpresa(null, empresas)).toBeNull();
    expect(sugerirEmpresa("Padaria", empresas)).toBeNull();
  });
});

describe("sugerirCategoria", () => {
  const cats = [{ id: "c1", nome: "Impostos" }, { id: "c2", nome: "Fornecedores" }];
  it("casa por nome exato, ignorando caixa", () => {
    expect(sugerirCategoria("IMPOSTOS", cats)).toBe("c1");
  });
  it("'Outros' e desconhecidos não sugerem (categoria inútil na origem)", () => {
    expect(sugerirCategoria("Outros", cats)).toBeNull();
    expect(sugerirCategoria(null, cats)).toBeNull();
  });
});
