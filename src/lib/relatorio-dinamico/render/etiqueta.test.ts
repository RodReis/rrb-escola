import { describe, it, expect } from "vitest";
import { MODELOS_ETIQUETA, posicaoEtiqueta, descricaoModelo } from "./modelos-etiqueta";
import { linhasEtiqueta, linhasQueCabem, renderEtiquetas, truncarParaLargura } from "./etiqueta";
import type { DadosRelatorio } from "../tipos";

describe("modelos de etiqueta", () => {
  it.each(Object.values(MODELOS_ETIQUETA))("$codigo cabe na página", (m) => {
    const ultima = posicaoEtiqueta(m, m.colunas * m.linhas - 1);
    expect(ultima.pagina).toBe(0);
    expect(ultima.x + m.largura).toBeLessThanOrEqual(m.paginaW + 0.01);
    expect(ultima.y + m.altura).toBeLessThanOrEqual(m.paginaH + 0.01);
  });
  it("6180: índice → linha/coluna e quebra de página", () => {
    const m = MODELOS_ETIQUETA["6180"];
    expect(posicaoEtiqueta(m, 0)).toEqual({ pagina: 0, x: m.margemEsq, y: m.margemTopo });
    expect(posicaoEtiqueta(m, 4)).toEqual({ pagina: 0, x: m.margemEsq + m.passoH, y: m.margemTopo + m.passoV });
    expect(posicaoEtiqueta(m, 30)).toEqual({ pagina: 1, x: m.margemEsq, y: m.margemTopo });
  });
  it("descrição igual ao Escolar Manager", () => {
    expect(descricaoModelo(MODELOS_ETIQUETA["6180"])).toBe(
      "Folha Tamanho Carta 215,9 x 279,4 mm. 3 colunas e 10 linhas totalizando 30 etiquetas por folha."
    );
  });
});

const dados: DadosRelatorio = {
  colunas: [
    { key: "a", label: "Nome Aluno", grupo: "g", tipo: "texto" },
    { key: "b", label: "Série", grupo: "g", tipo: "texto" },
  ],
  linhas: Array.from({ length: 31 }, (_, i) => [`ALUNO ${i} COM UM NOME MUITO GRANDE QUE NAO CABE NA ETIQUETA`, "3º ANO"]),
};

describe("etiqueta", () => {
  it("rótulos Sim/Não", () => {
    expect(linhasEtiqueta(dados, ["ANA", "3º ANO"], true)).toEqual(["Nome Aluno: ANA", "Série: 3º ANO"]);
    expect(linhasEtiqueta(dados, ["ANA", "3º ANO"], false)).toEqual(["ANA", "3º ANO"]);
  });
  it("trunca pela largura medida, sem quebrar", () => {
    const medir = (s: string) => s.length; // 1 unidade por caractere
    expect(truncarParaLargura(medir, "ABCDEFGHIJ", 4)).toBe("ABCD");
    expect(truncarParaLargura(medir, "ABC", 4)).toBe("ABC");
  });
  it("com reticências, sinaliza corte sem estourar a largura", () => {
    const medir = (s: string) => s.length; // 1 unidade por caractere
    expect(truncarParaLargura(medir, "ABCDEFGHIJ", 4, { reticencias: true })).toBe("ABC…");
    expect(medir(truncarParaLargura(medir, "ABCDEFGHIJ", 4, { reticencias: true }))).toBeLessThanOrEqual(4);
    // não estoura texto que já cabe: sem reticências mesmo pedindo o modo
    expect(truncarParaLargura(medir, "ABC", 4, { reticencias: true })).toBe("ABC");
    // largura insuficiente até para "…" sozinho: cai para o corte simples (sem reticências)
    expect(truncarParaLargura(medir, "ABCDEFGHIJ", 0, { reticencias: true })).toBe("");
  });
  it("linhasQueCabem: 6180 em fonte 7,5pt cabe 7 linhas (regressão do print do usuário: 15 colunas escolhidas, só 7 saíram)", () => {
    expect(linhasQueCabem(MODELOS_ETIQUETA["6180"], 7.5)).toBe(7);
  });
  it("linhasQueCabem cresce com etiqueta maior e encolhe com fonte maior", () => {
    expect(linhasQueCabem(MODELOS_ETIQUETA["A4362"], 7.5)).toBeGreaterThan(linhasQueCabem(MODELOS_ETIQUETA["6180"], 7.5));
    expect(linhasQueCabem(MODELOS_ETIQUETA["6180"], 12)).toBeLessThan(linhasQueCabem(MODELOS_ETIQUETA["6180"], 6));
  });
  it("31 registros em 6180 geram 2 páginas; texto nunca passa da etiqueta", () => {
    const doc = renderEtiquetas(dados, { modelo: "6180", fonte: 7.5, rotulos: true });
    expect(doc.getNumberOfPages()).toBe(2);
    doc.setFont("courier", "normal");
    doc.setFontSize(7.5);
    const texto = truncarParaLargura((s) => doc.getTextWidth(s), linhasEtiqueta(dados, dados.linhas[0], true)[0], 66.7 - 3);
    expect(doc.getTextWidth(texto)).toBeLessThanOrEqual(66.7 - 3);
  });
});
