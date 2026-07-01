import { describe, it, expect } from "vitest";
import {
  validarAssinaturaWebhook,
  parsearEventoWebhook,
  casarConversa,
  janelaAberta,
} from "./inbox-parser";
import { createHmac } from "node:crypto";

describe("validarAssinaturaWebhook", () => {
  const secret = "s3cr3t";
  const body = '{"a":1}';
  const assinaturaValida =
    "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

  it("aceita assinatura correta", () => {
    expect(validarAssinaturaWebhook(body, assinaturaValida, secret)).toBe(true);
  });
  it("rejeita assinatura errada", () => {
    expect(validarAssinaturaWebhook(body, "sha256=deadbeef", secret)).toBe(false);
  });
  it("rejeita assinatura ausente", () => {
    expect(validarAssinaturaWebhook(body, null, secret)).toBe(false);
  });
});

describe("parsearEventoWebhook", () => {
  it("extrai mensagem de texto", () => {
    const payload = {
      entry: [{ changes: [{ value: {
        contacts: [{ profile: { name: "Maria" }, wa_id: "5562999998888" }],
        messages: [{ from: "5562999998888", id: "wamid.1", type: "text", text: { body: "Oi" } }],
      } }] }],
    };
    expect(parsearEventoWebhook(payload)).toEqual([
      { telefone: "5562999998888", nome: "Maria", tipo: "texto", texto: "Oi", mediaId: null, providerMessageId: "wamid.1" },
    ]);
  });

  it("extrai mensagem de imagem", () => {
    const payload = {
      entry: [{ changes: [{ value: {
        contacts: [{ profile: { name: "João" }, wa_id: "5562988887777" }],
        messages: [{ from: "5562988887777", id: "wamid.2", type: "image", image: { id: "media-1", caption: "foto" } }],
      } }] }],
    };
    expect(parsearEventoWebhook(payload)).toEqual([
      { telefone: "5562988887777", nome: "João", tipo: "imagem", texto: "foto", mediaId: "media-1", providerMessageId: "wamid.2" },
    ]);
  });

  it("ignora eventos de status (delivered/read)", () => {
    const payload = { entry: [{ changes: [{ value: { statuses: [{ status: "delivered" }] } }] }] };
    expect(parsearEventoWebhook(payload)).toEqual([]);
  });

  it("retorna vazio para payload sem messages", () => {
    expect(parsearEventoWebhook({})).toEqual([]);
  });
});

describe("casarConversa", () => {
  const leads = [{ id: "lead-1", telefone: "5562999998888" }];
  const resps = [{ id: "resp-1", aluno_id: "aluno-1", telefone: "5562988887777" }];

  it("casa com lead", () => {
    expect(casarConversa("5562999998888", leads, resps)).toEqual({
      lead_id: "lead-1", aluno_id: null, responsavel_id: null,
    });
  });
  it("casa com responsável", () => {
    expect(casarConversa("5562988887777", leads, resps)).toEqual({
      lead_id: null, aluno_id: "aluno-1", responsavel_id: "resp-1",
    });
  });
  it("sem vínculo quando não casa", () => {
    expect(casarConversa("5511111111111", leads, resps)).toEqual({
      lead_id: null, aluno_id: null, responsavel_id: null,
    });
  });
});

describe("janelaAberta", () => {
  const agora = new Date("2026-06-30T12:00:00Z");
  it("aberta quando expira no futuro", () => {
    expect(janelaAberta("2026-06-30T20:00:00Z", agora)).toBe(true);
  });
  it("fechada quando expira no passado", () => {
    expect(janelaAberta("2026-06-30T10:00:00Z", agora)).toBe(false);
  });
  it("fechada quando null", () => {
    expect(janelaAberta(null, agora)).toBe(false);
  });
});
