// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Company } from "@/lib/data/rh";

// A cadeia real (actions/rh -> auth/session -> react's cache()) só existe em
// runtime Next.js; no vitest puro ela quebra o import. O form só repassa
// essas actions para <form action={...}>, então mock vazio basta aqui.
// vi.mock é hoisted para o topo do arquivo pelo vitest, antes do import abaixo.
vi.mock("@/lib/actions/rh", () => ({
  uploadCompanyLogoAction: vi.fn(),
  removeCompanyLogoAction: vi.fn()
}));

import { CompanyForm } from "./company-form";

const company: Company = {
  id: "1",
  cnpj: "11.222.333/0001-44",
  name: "Escola Teste",
  ativo: true,
  endereco: "Rua A",
  numero: "100",
  complemento: null,
  bairro: "Centro",
  cidade: "Trindade",
  uf: "GO",
  cep: "75388-686",
  resolucao: "RESOLUCAO X",
  telefones: "(62) 3000-0000",
  email: "a@a.com",
  site: null,
  whatsapp: null,
  nome_fantasia: "EPG Trindade",
  codigo_inep: null,
  mantenedora: null,
  logo_path: null,
  secretario_nome: "Fulana",
  secretario_cargo: "Secretário(a)",
  diretor_nome: "Ciclana",
  diretor_cargo: "Diretor(a)",
  coordenacao_nome: null,
  coordenacao_cargo: "Coordenador(a)",
  financeiro_nome: null,
  financeiro_cargo: "Financeiro",
  created_at: null,
  updated_at: null
};

describe("CompanyForm", () => {
  it("mostra as 3 abas e troca entre elas", () => {
    render(<CompanyForm action={vi.fn()} company={company} />);

    expect(screen.getByRole("tab", { name: "Endereço" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Assinaturas" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Outras informações" })).toBeInTheDocument();

    expect(screen.getByLabelText(/Logradouro/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Assinaturas" }));
    expect(screen.getByLabelText(/Nome da coordenação/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nome do financeiro/i)).toBeInTheDocument();
  });

  it("pre-preenche nome fantasia e razao social no topo", () => {
    render(<CompanyForm action={vi.fn()} company={company} />);
    expect(screen.getByDisplayValue("EPG Trindade")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Escola Teste")).toBeInTheDocument();
  });
});
