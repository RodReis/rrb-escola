import { describe, it, expect } from "vitest";
import { montarNotificacaoPortaria } from "./notificacao";

const templates = { comFoto: "portaria_acesso_foto", semFoto: "portaria_acesso_texto" };

// 2026-03-10T13:04 em America/Sao_Paulo. Date em UTC: 13:04 -03:00 = 16:04 UTC.
const dataEvento = new Date("2026-03-10T16:04:00Z");

describe("montarNotificacaoPortaria", () => {
  it("com foto usa o template de foto e inclui imagemUrl", () => {
    const r = montarNotificacaoPortaria(
      { nomeAluno: "João Silva", tipo: "entrada", dataEvento, fotoUrl: "https://x.com/f.jpg" },
      templates,
    );
    expect(r.templateName).toBe("portaria_acesso_foto");
    expect(r.imagemUrl).toBe("https://x.com/f.jpg");
  });

  it("sem foto usa o template de texto e não tem imagemUrl", () => {
    const r = montarNotificacaoPortaria(
      { nomeAluno: "João Silva", tipo: "entrada", dataEvento, fotoUrl: null },
      templates,
    );
    expect(r.templateName).toBe("portaria_acesso_texto");
    expect(r.imagemUrl).toBeUndefined();
  });

  it("entrada usa o verbo 'entrou'", () => {
    const r = montarNotificacaoPortaria(
      { nomeAluno: "João Silva", tipo: "entrada", dataEvento, fotoUrl: null },
      templates,
    );
    expect(r.variaveis).toEqual(["João Silva", "entrou", "13:04"]);
  });

  it("saída usa o verbo 'saiu'", () => {
    const r = montarNotificacaoPortaria(
      { nomeAluno: "Maria", tipo: "saida", dataEvento, fotoUrl: null },
      templates,
    );
    expect(r.variaveis).toEqual(["Maria", "saiu", "13:04"]);
  });

  it("horário formatado em America/Sao_Paulo", () => {
    const r = montarNotificacaoPortaria(
      { nomeAluno: "Ana", tipo: "entrada", dataEvento: new Date("2026-03-10T20:30:00Z"), fotoUrl: null },
      templates,
    );
    expect(r.variaveis[2]).toBe("17:30");
  });

  it("textoLog descreve o evento de forma legível", () => {
    const r = montarNotificacaoPortaria(
      { nomeAluno: "João Silva", tipo: "entrada", dataEvento, fotoUrl: null },
      templates,
    );
    expect(r.textoLog).toBe("João Silva entrou na escola às 13:04.");
  });
});
