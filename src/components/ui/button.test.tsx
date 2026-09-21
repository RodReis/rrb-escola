// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./button";

describe("Button loading", () => {
  it("nao fica desabilitado quando loading e false", () => {
    render(<Button loading={false}>Salvar</Button>);
    expect(screen.getByRole("button")).not.toBeDisabled();
  });

  it("desabilita e marca aria-busy quando loading e true", () => {
    render(<Button loading>Salvar</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
  });

  it("mantem o texto visivel durante o loading", () => {
    render(<Button loading>Salvar</Button>);
    expect(screen.getByRole("button")).toHaveTextContent("Salvar");
  });

  it("renderiza o spinner quando loading", () => {
    render(<Button loading>Salvar</Button>);
    expect(screen.getByTestId("spinner")).toBeInTheDocument();
  });

  it("nao renderiza spinner quando nao esta carregando", () => {
    render(<Button>Salvar</Button>);
    expect(screen.queryByTestId("spinner")).not.toBeInTheDocument();
  });

  it("respeita disabled explicito mesmo sem loading", () => {
    render(<Button disabled>Salvar</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
