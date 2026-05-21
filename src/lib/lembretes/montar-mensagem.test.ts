import { describe, it, expect } from "vitest";
import { montarMensagem } from "./montar-mensagem";

const dados = {
  responsavel: "Maria Silva",
  aluno: "João Silva",
  descricao: "Mensalidade 03/2026",
  valor: "R$ 450,00",
  vencimento: "10/03/2026",
  diasAtraso: 5,
};

describe("montarMensagem", () => {
  it("substitui todos os placeholders", () => {
    const template =
      "Olá {responsavel}, mensalidade de {aluno} ({descricao}) {valor} venceu {vencimento}, {dias_atraso} dias.";
    expect(montarMensagem(template, dados)).toBe(
      "Olá Maria Silva, mensalidade de João Silva (Mensalidade 03/2026) R$ 450,00 venceu 10/03/2026, 5 dias.",
    );
  });

  it("substitui o mesmo placeholder repetido", () => {
    const template = "{aluno} e novamente {aluno}";
    expect(montarMensagem(template, dados)).toBe("João Silva e novamente João Silva");
  });

  it("template sem placeholders é retornado igual", () => {
    const template = "Aviso de cobrança.";
    expect(montarMensagem(template, dados)).toBe("Aviso de cobrança.");
  });

  it("placeholder desconhecido é mantido literal", () => {
    const template = "Olá {responsavel}, {placeholder_inexistente}.";
    expect(montarMensagem(template, dados)).toBe(
      "Olá Maria Silva, {placeholder_inexistente}.",
    );
  });

  it("dias_atraso é convertido de número para texto", () => {
    const template = "{dias_atraso} dia(s)";
    expect(montarMensagem(template, dados)).toBe("5 dia(s)");
  });
});
