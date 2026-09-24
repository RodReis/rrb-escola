// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Tabs } from "./tabs";

describe("Tabs", () => {
  it("mostra o conteudo da aba inicial e troca ao clicar", () => {
    render(
      <Tabs
        defaultValue="endereco"
        items={[
          { value: "endereco", label: "Endereço", content: <div>Conteúdo endereço</div> },
          { value: "assinaturas", label: "Assinaturas", content: <div>Conteúdo assinaturas</div> }
        ]}
      />
    );

    expect(screen.getByText("Conteúdo endereço")).toBeVisible();
    expect(screen.getByText("Conteúdo assinaturas")).not.toBeVisible();

    fireEvent.click(screen.getByRole("tab", { name: "Assinaturas" }));

    expect(screen.getByText("Conteúdo assinaturas")).toBeVisible();
    expect(screen.getByText("Conteúdo endereço")).not.toBeVisible();
  });

  it("mantem os paineis inativos montados no DOM (hidden, nao desmontados)", () => {
    render(
      <Tabs
        defaultValue="endereco"
        items={[
          { value: "endereco", label: "Endereço", content: <div>Conteúdo endereço</div> },
          { value: "assinaturas", label: "Assinaturas", content: <div>Conteúdo assinaturas</div> }
        ]}
      />
    );

    // Regressão do achado CRITICAL: painéis não-ativos precisam continuar no
    // DOM (só escondidos), senão os inputs deles desaparecem do FormData.
    const paineis = screen.getAllByRole("tabpanel", { hidden: true });
    expect(paineis).toHaveLength(2);
  });
});
