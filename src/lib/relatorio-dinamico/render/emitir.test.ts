import { describe, it, expect } from "vitest";
import { avisoColunasNaoCabem, sanearConfig, selecionarEmpresas } from "./emitir";
import { configPadrao, type DadosRelatorio } from "../tipos";

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

function dadosCom(nColunas: number): DadosRelatorio {
  return {
    colunas: Array.from({ length: nColunas }, (_, i) => ({ key: `k${i}`, label: `Coluna ${i}`, grupo: "g", tipo: "texto" as const })),
    linhas: [],
  };
}

describe("avisoColunasNaoCabem", () => {
  it("null quando as colunas cabem na etiqueta (regressão: 7 colunas cabem em 6180/7,5pt)", () => {
    const cfg = { ...configPadrao("aluno"), formato: "etiqueta" as const, modeloEtiqueta: "6180" as const, fonte: 7.5 };
    expect(avisoColunasNaoCabem(dadosCom(7), cfg)).toBeNull();
  });
  it("avisa e nomeia as colunas cortadas quando não cabem (regressão do print: 15 colunas, só 7 saíram)", () => {
    const cfg = { ...configPadrao("aluno"), formato: "etiqueta" as const, modeloEtiqueta: "6180" as const, fonte: 7.5 };
    const aviso = avisoColunasNaoCabem(dadosCom(15), cfg);
    expect(aviso).toContain("Cabem 7 de 15 colunas");
    expect(aviso).toContain("8 últimas");
    expect(aviso).toContain("Coluna 7, Coluna 8");
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
