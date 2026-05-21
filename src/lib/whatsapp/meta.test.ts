import { describe, it, expect } from "vitest";
import { montarComponentsTemplate } from "./meta";

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
    expect(r[0].parameters.map((p: { text: string }) => p.text)).toEqual([
      "um",
      "dois",
      "três",
    ]);
  });
});
