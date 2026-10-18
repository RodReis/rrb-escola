// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockCarregar = vi.fn();
vi.mock("@/lib/actions/requerimento-matricula", () => ({
  carregarRequerimentosAction: (...args: unknown[]) => mockCarregar(...args)
}));

const mockSave = vi.fn();
vi.mock("@/lib/documents/requerimento-matricula-pdf", () => ({
  renderRequerimentos: vi.fn(() => ({ save: mockSave }))
}));

const mockCarregarImagens = vi.fn().mockResolvedValue(new Map());
vi.mock("@/lib/documents/pdf-utils", () => ({
  carregarImagens: (...args: unknown[]) => mockCarregarImagens(...args)
}));

let mockSearchParams = new URLSearchParams();
const listeners = new Set<() => void>();
vi.mock("next/navigation", async () => {
  const React = await import("react");
  return {
    useRouter: () => ({
      push: (url: string) => {
        const query = url.split("?")[1] ?? "";
        mockSearchParams = new URLSearchParams(query);
        listeners.forEach((l) => l());
      }
    }),
    useSearchParams: () =>
      React.useSyncExternalStore(
        (onStoreChange) => {
          listeners.add(onStoreChange);
          return () => listeners.delete(onStoreChange);
        },
        () => mockSearchParams
      )
  };
});

import { RequerimentoEmissaoForm } from "./requerimento-emissao-form";

const series = [
  { id: "s1", nome: "5º ANO" },
  { id: "s2", nome: "6º ANO" }
];
const turmas = [
  { id: "t1", serieId: "s1", turno: "matutino" },
  { id: "t2", serieId: "s1", turno: "vespertino" },
  { id: "t3", serieId: "s2", turno: "matutino" }
];
const ana = { matriculaId: "m1", alunoId: "a1", nome: "Ana", temResponsavelFinanceiro: true };
const beto = { matriculaId: "m2", alunoId: "a2", nome: "Beto", temResponsavelFinanceiro: false };
const carla = { matriculaId: "m3", alunoId: "a3", nome: "Carla", temResponsavelFinanceiro: true };

function renderForm(elegiveis = [ana, beto, carla]) {
  return render(
    <RequerimentoEmissaoForm
      anoLetivo={2027}
      anosDisponiveis={[2027, 2026]}
      series={series}
      turmas={turmas}
      alunos={[]}
      elegiveis={elegiveis}
    />
  );
}

function paginaDe(nome: string) {
  return {
    escola: { logoPath: "escola-1/logo.png" },
    dados: { aluno: { nome, fotoUrl: `https://signed.example/${nome}.jpg` } }
  };
}

describe("RequerimentoEmissaoForm", () => {
  beforeEach(() => {
    mockCarregar.mockReset();
    mockSave.mockReset();
    mockCarregarImagens.mockClear().mockResolvedValue(new Map());
    mockSearchParams = new URLSearchParams();
    listeners.clear();
  });

  it("sem filtro: tabela pede uma série/turma e Emitir fica desabilitado", () => {
    renderForm([]);
    expect(screen.getByText("Selecione uma série ou turma para listar os alunos.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /emitir selecionados \(0\)/i })).toBeDisabled();
  });

  it("Turma fica desabilitada até escolher a Série", () => {
    renderForm();
    expect(screen.getByRole("button", { name: /^Turma:/ })).toBeDisabled();
  });

  it("com Série escolhida, a Turma lista só as turmas dela, pelo turno em maiúsculas", () => {
    mockSearchParams = new URLSearchParams("serie=s1");
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: /^Turma:/ }));

    expect(screen.getByRole("button", { name: "MATUTINO" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "VESPERTINO" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "MATUTINO" })).toHaveLength(1);
  });

  it("aluno sem responsável financeiro: checkbox bloqueado e aviso de pendência", () => {
    renderForm();
    expect(screen.getByLabelText("Selecionar Beto")).toBeDisabled();
    expect(screen.getByText("Sem responsável financeiro (1)")).toBeTruthy();
  });

  it("Marcar todos seleciona só os prontos e emite com a mesma observação para o lote", async () => {
    mockCarregar.mockResolvedValue({ paginas: [paginaDe("Ana"), paginaDe("Carla")], falhas: [] });
    renderForm();

    fireEvent.click(screen.getByLabelText("Marcar todos"));
    fireEvent.change(screen.getByPlaceholderText(/sai igual em todos/i), { target: { value: "Conferido" } });
    fireEvent.click(screen.getByRole("button", { name: /emitir selecionados \(2\)/i }));

    await waitFor(() => expect(mockSave).toHaveBeenCalledWith("requerimentos-matricula-2027.pdf"));
    expect(mockCarregar).toHaveBeenCalledWith(["m1", "m3"], "Conferido");
  });

  it("baixa a URL pública da logo e a foto de cada aluno antes de gerar o PDF", async () => {
    const { companyLogoUrl } = await import("@/lib/storage/company-logo-url");
    mockCarregar.mockResolvedValue({ paginas: [paginaDe("Ana")], falhas: [] });
    renderForm();

    fireEvent.click(screen.getByLabelText("Selecionar Ana"));
    fireEvent.click(screen.getByRole("button", { name: /emitir selecionados \(1\)/i }));

    await waitFor(() => expect(mockCarregarImagens).toHaveBeenCalled());
    const urls = mockCarregarImagens.mock.calls[0][0] as Array<string | null>;
    expect(urls).toContain(companyLogoUrl("escola-1/logo.png"));
    expect(urls).not.toContain("escola-1/logo.png");
    expect(urls).toContain("https://signed.example/Ana.jpg");
    await waitFor(() => expect(mockSave).toHaveBeenCalledWith("ANA-requerimento-2027.pdf"));
  });

  it("mostra os alunos que falharam na emissão sem perder os gerados", async () => {
    mockCarregar.mockResolvedValue({
      paginas: [paginaDe("Ana")],
      falhas: [{ nome: "Carla", motivo: "Responsável financeiro não cadastrado." }]
    });
    renderForm();

    fireEvent.click(screen.getByLabelText("Marcar todos"));
    fireEvent.click(screen.getByRole("button", { name: /emitir selecionados/i }));

    await waitFor(() => expect(screen.getByText("Não gerados (1)")).toBeTruthy());
    expect(mockSave).toHaveBeenCalled();
  });
});
