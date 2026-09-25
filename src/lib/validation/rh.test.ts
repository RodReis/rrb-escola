import { describe, it, expect } from "vitest";
import { CompanyUpdateSchema, EmployeeSchema } from "./rh";

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

const employeeBase = {
  company_id: "11111111-1111-1111-1111-111111111111",
  name: "Maria Souza",
  cpf: "123.456.789-00"
};

describe("EmployeeSchema.perfil_id", () => {
  it("vazio vira undefined", () => {
    const r = EmployeeSchema.safeParse({ ...employeeBase, perfil_id: "" });
    expect(r.success && r.data.perfil_id).toBeUndefined();
  });
  it("aceita uuid", () => {
    const r = EmployeeSchema.safeParse({ ...employeeBase, perfil_id: "22222222-2222-2222-2222-222222222222" });
    expect(r.success).toBe(true);
  });
  it("recusa texto que não é uuid", () => {
    expect(EmployeeSchema.safeParse({ ...employeeBase, perfil_id: "abc" }).success).toBe(false);
  });
});
