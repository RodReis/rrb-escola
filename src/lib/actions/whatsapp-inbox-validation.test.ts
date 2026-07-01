import { describe, it, expect } from "vitest";
import { validarPathImagem } from "./whatsapp-inbox-validation";

describe("validarPathImagem", () => {
  it("aceita path válido gerado pelo upload (outbound/<uuid>.<ext>)", () => {
    expect(
      validarPathImagem("outbound/550e8400-e29b-41d4-a716-446655440000.jpg"),
    ).toBe(true);
  });

  it("aceita extensões alfanuméricas curtas diferentes (png, jpeg, webp)", () => {
    expect(
      validarPathImagem("outbound/550e8400-e29b-41d4-a716-446655440000.png"),
    ).toBe(true);
    expect(
      validarPathImagem("outbound/550e8400-e29b-41d4-a716-446655440000.jpeg"),
    ).toBe(true);
    expect(
      validarPathImagem("outbound/550e8400-e29b-41d4-a716-446655440000.webp"),
    ).toBe(true);
  });

  it("rejeita path traversal", () => {
    expect(validarPathImagem("outbound/../secret.jpg")).toBe(false);
  });

  it("rejeita path de mídia inbound (não é gerado pelo client)", () => {
    expect(validarPathImagem("CONVERSA/mediaId.jpg")).toBe(false);
  });

  it("rejeita nome que não é uuid", () => {
    expect(validarPathImagem("outbound/x.jpg")).toBe(false);
  });

  it("rejeita string vazia", () => {
    expect(validarPathImagem("")).toBe(false);
  });

  it("rejeita path com segmento extra", () => {
    expect(
      validarPathImagem(
        "outbound/extra/550e8400-e29b-41d4-a716-446655440000.jpg",
      ),
    ).toBe(false);
  });

  it("rejeita extensão longa ou estranha", () => {
    expect(
      validarPathImagem(
        "outbound/550e8400-e29b-41d4-a716-446655440000.jpgexploit",
      ),
    ).toBe(false);
  });

  it("rejeita prefixo diferente de outbound/", () => {
    expect(
      validarPathImagem("inbound/550e8400-e29b-41d4-a716-446655440000.jpg"),
    ).toBe(false);
  });

  it("rejeita sem extensão", () => {
    expect(
      validarPathImagem("outbound/550e8400-e29b-41d4-a716-446655440000"),
    ).toBe(false);
  });
});
