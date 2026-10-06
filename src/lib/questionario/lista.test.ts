import { describe, expect, it } from "vitest";
import { lerLista, lerTexto, moverItem, normalizarBusca } from "./lista";

describe("moverItem", () => {
  it("move para cima e para baixo sem mutar", () => {
    const original = ["a", "b", "c"];
    expect(moverItem(original, 2, 1)).toEqual(["a", "c", "b"]);
    expect(moverItem(original, 0, 1)).toEqual(["b", "a", "c"]);
    expect(original).toEqual(["a", "b", "c"]);
  });
  it("ignora índices fora da lista", () => {
    expect(moverItem(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(moverItem(["a", "b"], 1, 2)).toEqual(["a", "b"]);
  });
});

describe("leitura de FormData", () => {
  it("lerLista apara e descarta vazios, preservando a ordem", () => {
    const fd = new FormData();
    fd.append("opcoes", " Sim ");
    fd.append("opcoes", "");
    fd.append("opcoes", "Não");
    expect(lerLista(fd, "opcoes")).toEqual(["Sim", "Não"]);
  });
  it("lerTexto devolve string aparada ('' se ausente)", () => {
    const fd = new FormData();
    fd.set("a", "  x ");
    expect(lerTexto(fd, "a")).toBe("x");
    expect(lerTexto(fd, "b")).toBe("");
  });
});

describe("normalizarBusca", () => {
  it("ignora acento, caixa e espaços das pontas", () => {
    expect(normalizarBusca("  AÇÃO ")).toBe("acao");
  });
});
