import { describe, it, expect } from "vitest";
import { sanearConfig, selecionarEmpresas } from "./emitir";
import { configPadrao } from "../tipos";

const empresas = [
  { id: "11111111-1111-1111-1111-111111111111", nomeFantasia: "A", resolucao: null, logoUrl: null },
  { id: "22222222-2222-2222-2222-222222222222", nomeFantasia: "B", resolucao: "RES", logoUrl: "https://x/b.png" },
  { id: "33333333-3333-3333-3333-333333333333", nomeFantasia: "C", resolucao: null, logoUrl: "https://x/c.png" },
];

describe("selecionarEmpresas", () => {
  it("sem escolha: cabeçalho = primeira ativa; logo = primeira com logo", () => {
    const r = selecionarEmpresas(configPadrao("aluno"), empresas);
    expect(r.cabecalho?.nomeFantasia).toBe("A");
    expect(r.logos.map((e) => e.nomeFantasia)).toEqual(["B"]);
  });
  it("escolha explícita define ordem e cabeçalho; empresa sem logo ou inexistente é ignorada nos logos", () => {
    const r = selecionarEmpresas(
      { ...configPadrao("aluno"), logosEmpresas: [empresas[2].id, empresas[0].id, "44444444-4444-4444-4444-444444444444"] },
      empresas
    );
    expect(r.cabecalho?.nomeFantasia).toBe("C");
    expect(r.logos.map((e) => e.nomeFantasia)).toEqual(["C"]);
  });
  it("exibirLogos=false → sem logos; nenhuma empresa → tudo vazio", () => {
    expect(selecionarEmpresas({ ...configPadrao("aluno"), exibirLogos: false }, empresas).logos).toEqual([]);
    expect(selecionarEmpresas(configPadrao("aluno"), [])).toEqual({ cabecalho: null, logos: [] });
  });
});

describe("sanearConfig", () => {
  it("remove colunas (e ordenações) que não existem mais no catálogo do usuário", () => {
    const cfg = { ...configPadrao("funcionario"), colunas: ["func.nome", "ctr.salario"], ordenacao: [{ key: "ctr.salario", dir: "desc" as const }] };
    const r = sanearConfig(cfg, [{ key: "func.nome", label: "Nome", grupo: "g", tipo: "texto" }]);
    expect(r.config.colunas).toEqual(["func.nome"]);
    expect(r.config.ordenacao).toEqual([]);
    expect(r.removidas).toEqual(["ctr.salario"]);
  });
});
