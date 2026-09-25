// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FinanceiroStatusBadge } from "./financeiro-status-badge";

describe("FinanceiroStatusBadge", () => {
  it("mostra Pago (isaac) para pago_isaac", () => {
    render(<FinanceiroStatusBadge status="pago_isaac" />);
    expect(screen.getByText(/pago \(isaac\)/i)).toBeInTheDocument();
  });

  it("mostra Pago (manual) para pago_manual", () => {
    render(<FinanceiroStatusBadge status="pago_manual" />);
    expect(screen.getByText(/pago \(manual\)/i)).toBeInTheDocument();
  });

  it("mostra Em aberto para aberto", () => {
    render(<FinanceiroStatusBadge status="aberto" />);
    expect(screen.getByText(/em aberto/i)).toBeInTheDocument();
  });

  it("mostra Vencido para vencido", () => {
    render(<FinanceiroStatusBadge status="vencido" />);
    expect(screen.getByText(/vencido/i)).toBeInTheDocument();
  });

  it("mostra travessao para null", () => {
    render(<FinanceiroStatusBadge status={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
