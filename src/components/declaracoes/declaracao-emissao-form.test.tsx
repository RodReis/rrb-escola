// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockPrevisualizar = vi.fn();
vi.mock("@/lib/actions/declaracao-emissao", () => ({
  carregarDeclaracoesAction: vi.fn(),
  previsualizarDeclaracaoAction: (...args: unknown[]) => mockPrevisualizar(...args)
}));

// Mesmo padrão de mock de next/navigation usado em row-action-button.test.tsx,
// mas com um searchParams "vivo": o componente atualiza o filtro via
// `router.push(\`...?query\`)`. Como isso muda estado fora do React, o mock
// de useSearchParams usa useSyncExternalStore para forçar o rerender do
// componente quando o push acontece — senão o <select> nunca refletiria a
// escolha e o useEffect de pré-visualização não disparia.
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

import { DeclaracaoEmissaoForm } from "./declaracao-emissao-form";

const modeloBase = { id: "mod1", codigo: 1, nome: "Declaração de Frequência", titulo: "T", texto: "X [NOME_ALUNO]", fecho: "F", ativo: true, created_at: null, updated_at: null };

describe("DeclaracaoEmissaoForm", () => {
  beforeEach(() => {
    mockPrevisualizar.mockReset();
    mockSearchParams = new URLSearchParams();
    listeners.clear();
  });

  it("mostra o botão Emitir PDF desabilitado sem nenhum aluno elegível", () => {
    render(
      <DeclaracaoEmissaoForm
        anoLetivo={2026}
        series={[]}
        turmas={[]}
        alunosElegiveis={[]}
        modelos={[modeloBase]}
      />
    );
    expect(screen.getByRole("button", { name: /emitir pdf/i })).toBeDisabled();
  });

  it("habilita Emitir PDF quando há alunos elegíveis e um modelo selecionado", async () => {
    mockPrevisualizar.mockResolvedValue({ titulo: "T", texto: "X", fecho: "F" });
    render(
      <DeclaracaoEmissaoForm
        anoLetivo={2026}
        series={[]}
        turmas={[]}
        alunosElegiveis={[{ matriculaId: "m1", alunoId: "a1", nome: "Ana" }]}
        modelos={[modeloBase]}
      />
    );
    // O nome do teste exige "um modelo selecionado" — sem escolher o modelo
    // no <select>, podeEmitir nunca fica true (ver regra de negócio: emitir
    // exige um modelo escolhido, não só alunos elegíveis).
    fireEvent.change(screen.getByLabelText(/modelo de declaração/i), { target: { value: "mod1" } });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /emitir pdf/i })).toBeEnabled();
    });
  });

  it("ao escolher um modelo, busca a pré-visualização para o primeiro aluno do filtro e preenche os campos editáveis", async () => {
    mockPrevisualizar.mockResolvedValue({ titulo: "DECLARAÇÃO", texto: "X ANA DA SILVA", fecho: "Trindade, hoje" });

    render(
      <DeclaracaoEmissaoForm
        anoLetivo={2026}
        series={[]}
        turmas={[]}
        alunosElegiveis={[{ matriculaId: "m1", alunoId: "a1", nome: "Ana" }]}
        modelos={[modeloBase]}
      />
    );

    fireEvent.change(screen.getByLabelText(/modelo de declaração/i), { target: { value: "mod1" } });

    await waitFor(() => {
      expect(mockPrevisualizar).toHaveBeenCalledWith("m1", "mod1");
    });
    await waitFor(() => {
      expect(screen.getByDisplayValue("X ANA DA SILVA")).toBeInTheDocument();
    });
  });

  it("edição na pré-visualização não persiste — reabrir o form limpo mostra o texto original do modelo, não o editado", async () => {
    mockPrevisualizar.mockResolvedValue({ titulo: "DECLARAÇÃO", texto: "X ANA DA SILVA", fecho: "Trindade, hoje" });

    const { unmount } = render(
      <DeclaracaoEmissaoForm
        anoLetivo={2026}
        series={[]}
        turmas={[]}
        alunosElegiveis={[{ matriculaId: "m1", alunoId: "a1", nome: "Ana" }]}
        modelos={[modeloBase]}
      />
    );
    fireEvent.change(screen.getByLabelText(/modelo de declaração/i), { target: { value: "mod1" } });
    await waitFor(() => expect(screen.getByDisplayValue("X ANA DA SILVA")).toBeInTheDocument());

    const textoPreview = screen.getByLabelText(/texto \(pré-visualização\)/i);
    fireEvent.change(textoPreview, { target: { value: "TEXTO EDITADO SÓ PARA ESTA EMISSÃO" } });
    expect(screen.getByDisplayValue("TEXTO EDITADO SÓ PARA ESTA EMISSÃO")).toBeInTheDocument();

    // A edição é só estado local do componente — desmontar e remontar (o
    // que aconteceria numa nova visita à página) não deve reaproveitar o
    // texto editado, porque nada foi persistido no modelo.
    unmount();
    mockPrevisualizar.mockResolvedValue({ titulo: "DECLARAÇÃO", texto: "X ANA DA SILVA", fecho: "Trindade, hoje" });
    render(
      <DeclaracaoEmissaoForm
        anoLetivo={2026}
        series={[]}
        turmas={[]}
        alunosElegiveis={[{ matriculaId: "m1", alunoId: "a1", nome: "Ana" }]}
        modelos={[modeloBase]}
      />
    );
    fireEvent.change(screen.getByLabelText(/modelo de declaração/i), { target: { value: "mod1" } });
    await waitFor(() => expect(screen.getByDisplayValue("X ANA DA SILVA")).toBeInTheDocument());
    expect(screen.queryByDisplayValue("TEXTO EDITADO SÓ PARA ESTA EMISSÃO")).not.toBeInTheDocument();
  });
});
