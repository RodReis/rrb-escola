import { describe, it, expect } from "vitest";
import { montarComponentsTemplate, montarPayloadImagem } from "./meta";

describe("montarComponentsTemplate", () => {
  it("monta só o body quando não há imagem", () => {
    const r = montarComponentsTemplate(["Maria", "João"], undefined);
    expect(r).toEqual([
      {
        type: "body",
        parameters: [
          { type: "text", text: "Maria" },
          { type: "text", text: "João" },
        ],
      },
    ]);
  });

  it("adiciona header de imagem antes do body quando há imagemUrl", () => {
    const r = montarComponentsTemplate(["Aviso geral"], "https://x.com/foto.jpg");
    expect(r).toEqual([
      {
        type: "header",
        parameters: [{ type: "image", image: { link: "https://x.com/foto.jpg" } }],
      },
      {
        type: "body",
        parameters: [{ type: "text", text: "Aviso geral" }],
      },
    ]);
  });

  it("body com uma única variável", () => {
    const r = montarComponentsTemplate(["texto único"], undefined);
    expect(r).toEqual([
      { type: "body", parameters: [{ type: "text", text: "texto único" }] },
    ]);
  });

  it("variáveis vazias geram body com parameters vazio", () => {
    const r = montarComponentsTemplate([], undefined);
    expect(r).toEqual([{ type: "body", parameters: [] }]);
  });

  it("preserva a ordem das variáveis", () => {
    const r = montarComponentsTemplate(["um", "dois", "três"], undefined);
    const body = r[0] as { type: "body"; parameters: { type: "text"; text: string }[] };
    expect(body.parameters.map((p) => p.text)).toEqual([
      "um",
      "dois",
      "três",
    ]);
  });
});

describe("montarPayloadImagem", () => {
  it("monta payload de imagem com legenda", () => {
    expect(montarPayloadImagem("5562999998888", "https://x/y.jpg", "oi")).toEqual({
      to: "5562999998888",
      type: "image",
      image: { link: "https://x/y.jpg", caption: "oi" },
    });
  });

  it("omite caption quando não há legenda", () => {
    expect(montarPayloadImagem("5562999998888", "https://x/y.jpg")).toEqual({
      to: "5562999998888",
      type: "image",
      image: { link: "https://x/y.jpg" },
    });
  });
});
