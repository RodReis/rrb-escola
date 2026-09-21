import { describe, expect, it } from "vitest";
import { extrairErroSicoob } from "@/lib/sicoob/http";

describe("extrairErroSicoob", () => {
  it("prioriza mensagens[].mensagem", () => {
    expect(extrairErroSicoob({ mensagens: [{ mensagem: "Campo inválido" }] }, 400)).toBe("Campo inválido");
  });

  it("usa fallback HTTP", () => {
    expect(extrairErroSicoob({}, 503)).toBe("Sicoob HTTP 503");
  });
});
