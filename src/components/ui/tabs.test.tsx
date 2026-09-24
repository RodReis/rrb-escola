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

    expect(screen.getByText("Conteúdo endereço")).toBeInTheDocument();
    expect(screen.queryByText("Conteúdo assinaturas")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Assinaturas" }));

    expect(screen.getByText("Conteúdo assinaturas")).toBeInTheDocument();
    expect(screen.queryByText("Conteúdo endereço")).not.toBeInTheDocument();
  });
});
