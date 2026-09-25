import { describe, it, expect } from "vitest";
import { CompanyUpdateSchema } from "./rh";

const base = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  name: "Escola Teste Ltda",
  cnpj: "11.222.333/0001-44",
  ativo: "on"
};

describe("CompanyUpdateSchema — campos novos", () => {
  it("aceita todos os campos novos vazios", () => {
    const parsed = CompanyUpdateSchema.safeParse(base);
    expect(parsed.success).toBe(true);
  });

  it("aceita os campos novos preenchidos", () => {
    const parsed = CompanyUpdateSchema.safeParse({
      ...base,
      numero: "473",
      complemento: "Q 24, L 17",
      bairro: "Centro",
      site: "https://epgtrindade.com.br",
      whatsapp: "(62) 99999-0000",
      nomeFantasia: "EPG Trindade",
      codigoInep: "52012345",
      mantenedora: "Escola Infantil Pinguinho de Gente Ltda",
      coordenacaoNome: "Janaina Maria",
      coordenacaoCargo: "Coordenador(a) Geral",
      financeiroNome: "Keila Regina",
      financeiroCargo: "Financeiro"
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.nomeFantasia).toBe("EPG Trindade");
    }
  });

  it("schema conhece o campo nomeFantasia", () => {
    expect(CompanyUpdateSchema.shape).toHaveProperty("nomeFantasia");
  });
});
