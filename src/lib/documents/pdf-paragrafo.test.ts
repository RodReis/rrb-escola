import { describe, it, expect } from "vitest";
import jsPDF from "jspdf";
import { medirPalavras, quebrarLinhas, medirAlturaCorpo, renderCorpo } from "./pdf-paragrafo";
import type { Segmento } from "./certificado-texto";

function docTeste(): jsPDF {
  return new jsPDF({ unit: "pt", format: "a4" });
}

describe("medirPalavras", () => {
  it("mede cada palavra com a fonte do segmento (negrito e normal)", () => {
    const doc = docTeste();
    const segmentos: Segmento[] = [
      { texto: "Declaramos que ", negrito: false },
      { texto: "João Silva", negrito: true }
    ];
    const palavras = medirPalavras(doc, segmentos, 11);
    expect(palavras.map((p) => p.texto)).toEqual(["Declaramos", "que", "João", "Silva"]);
    expect(palavras.every((p) => p.largura > 0)).toBe(true);
    expect(palavras[0].negrito).toBe(false);
    expect(palavras[2].negrito).toBe(true);
  });
});

describe("quebrarLinhas", () => {
  it("quebra em nova linha quando a palavra não cabe na largura útil", () => {
    const palavras = [
      { texto: "AAAA", negrito: false, largura: 40 },
      { texto: "BBBB", negrito: false, largura: 40 },
      { texto: "CCCC", negrito: false, largura: 40 }
    ];
    const linhas = quebrarLinhas(palavras, 90, 10);
    expect(linhas.length).toBe(2);
    expect(linhas[0].map((p) => p.texto)).toEqual(["AAAA", "BBBB"]);
    expect(linhas[1].map((p) => p.texto)).toEqual(["CCCC"]);
  });

  it("uma palavra maior que a largura útil ainda forma sua própria linha", () => {
    const palavras = [{ texto: "PALAVRA-ENORME", negrito: false, largura: 500 }];
    const linhas = quebrarLinhas(palavras, 90, 10);
    expect(linhas.length).toBe(1);
    expect(linhas[0].map((p) => p.texto)).toEqual(["PALAVRA-ENORME"]);
  });
});

describe("quebra de parágrafo (\\n) — achado da revisão final", () => {
  it("medirPalavras preserva o \\n como marcador dedicado, nunca dentro do texto de uma palavra real", () => {
    const doc = docTeste();
    const segmentos: Segmento[] = [{ texto: "Primeira parte.\n\nSegunda parte.", negrito: false }];
    const palavras = medirPalavras(doc, segmentos, 11);

    // "\n\n" faz split(/\r?\n/) produzir um parágrafo vazio entre os dois —
    // ou seja, dois marcadores de quebra (um só \n já teria produzido 1).
    expect(palavras.some((p) => p.texto.includes("\n") && p.texto !== "\n")).toBe(false);
    expect(palavras.map((p) => p.texto)).toEqual(["Primeira", "parte.", "\n", "\n", "Segunda", "parte."]);
  });

  it("quebrarLinhas força uma nova linha em cada marcador, sem deixá-lo dentro de nenhuma linha desenhável", () => {
    const doc = docTeste();
    const segmentos: Segmento[] = [{ texto: "Primeira parte.\n\nSegunda parte.", negrito: false }];
    const palavras = medirPalavras(doc, segmentos, 11);
    const linhas = quebrarLinhas(palavras, 500, 5);

    expect(linhas.length).toBeGreaterThanOrEqual(2);
    for (const linha of linhas) {
      expect(linha.some((p) => p.texto === "\n")).toBe(false);
    }
    expect(linhas[0].map((p) => p.texto)).toEqual(["Primeira", "parte."]);
    // Linha do meio (entre os dois \n) fica vazia — é o parágrafo em branco.
    expect(linhas[1]).toEqual([]);
    expect(linhas[2].map((p) => p.texto)).toEqual(["Segunda", "parte."]);
  });

  it("renderCorpo desenha o texto com \\n sem lançar exceção e produz mais de uma linha", () => {
    const doc = docTeste();
    const segmentos: Segmento[] = [{ texto: "Primeira parte.\n\nSegunda parte.", negrito: false }];
    const opts = { fonte: "times", fonteCorpoPt: 11, margemPt: 40 };
    const alturaPrevista = medirAlturaCorpo(doc, segmentos, opts);
    const yFinal = renderCorpo(doc, 100, segmentos, opts);
    expect(yFinal - 100).toBeCloseTo(alturaPrevista, 9);
    // 2 parágrafos => pelo menos 2 linhas de altura (fonteCorpoPt * 1.9 cada).
    expect(alturaPrevista).toBeGreaterThanOrEqual(11 * 1.9 * 2);
  });
});

describe("medirAlturaCorpo / renderCorpo", () => {
  it("medirAlturaCorpo prevê a mesma quantidade de linhas que renderCorpo desenha", () => {
    const doc = docTeste();
    const segmentos: Segmento[] = [
      { texto: "Texto de teste com várias palavras para forçar quebra de linha no parágrafo justificado.", negrito: false }
    ];
    const opts = { fonte: "times", fonteCorpoPt: 11, margemPt: 40 };
    const alturaPrevista = medirAlturaCorpo(doc, segmentos, opts);
    const yFinal = renderCorpo(doc, 100, segmentos, opts);
    // toBeCloseTo, não toBe: soma de floats (100 + 20.9 - 100) introduz erro
    // de arredondamento de ponto flutuante inerente ao IEEE 754, não um bug
    // de lógica — a mesma imprecisão existiria com o código original inline.
    expect(yFinal - 100).toBeCloseTo(alturaPrevista, 9);
  });

  it("parágrafo vazio não desenha linha nenhuma (altura zero)", () => {
    const doc = docTeste();
    const opts = { fonte: "times", fonteCorpoPt: 11, margemPt: 40 };
    expect(medirAlturaCorpo(doc, [], opts)).toBe(0);
    expect(renderCorpo(doc, 100, [], opts)).toBe(100);
  });
});
