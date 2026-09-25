import { describe, it, expect } from "vitest";
import { derivarStatusFinanceiroMes } from "./status-mes-corrente";

const HOJE = "2026-09-24";

describe("derivarStatusFinanceiroMes", () => {
  it("retorna null sem nenhuma cobranca no mes", () => {
    expect(derivarStatusFinanceiroMes([], HOJE)).toBeNull();
  });

  it("isaac paga -> pago_isaac", () => {
    const result = derivarStatusFinanceiroMes(
      [{ origem: "isaac", status: "paga", data_vencimento: "2026-09-10" }],
      HOJE
    );
    expect(result).toBe("pago_isaac");
  });

  it("manual paga -> pago_manual", () => {
    const result = derivarStatusFinanceiroMes(
      [{ origem: "manual", status: "paga", data_vencimento: "2026-09-10" }],
      HOJE
    );
    expect(result).toBe("pago_manual");
  });

  it("aberta com vencimento futuro -> aberto", () => {
    const result = derivarStatusFinanceiroMes(
      [{ origem: "manual", status: "aberta", data_vencimento: "2026-09-30" }],
      HOJE
    );
    expect(result).toBe("aberto");
  });

  it("aberta com vencimento passado -> vencido", () => {
    const result = derivarStatusFinanceiroMes(
      [{ origem: "manual", status: "aberta", data_vencimento: "2026-09-01" }],
      HOJE
    );
    expect(result).toBe("vencido");
  });

  it("parcial com vencimento passado -> vencido", () => {
    const result = derivarStatusFinanceiroMes(
      [{ origem: "isaac", status: "parcial", data_vencimento: "2026-09-01" }],
      HOJE
    );
    expect(result).toBe("vencido");
  });

  it("cobranca cancelada -> null (nao conta como relevante no mes)", () => {
    const result = derivarStatusFinanceiroMes(
      [{ origem: "manual", status: "cancelada", data_vencimento: "2026-09-10" }],
      HOJE
    );
    expect(result).toBeNull();
  });

  it("duas cobrancas no mes: vencida tem prioridade sobre aberta", () => {
    const result = derivarStatusFinanceiroMes(
      [
        { origem: "manual", status: "aberta", data_vencimento: "2026-09-30" },
        { origem: "manual", status: "aberta", data_vencimento: "2026-09-01" },
      ],
      HOJE
    );
    expect(result).toBe("vencido");
  });

  it("duas cobrancas no mes: paga isaac tem prioridade sobre aberta (paga é o status mais definitivo)", () => {
    const result = derivarStatusFinanceiroMes(
      [
        { origem: "manual", status: "aberta", data_vencimento: "2026-09-30" },
        { origem: "isaac", status: "paga", data_vencimento: "2026-09-05" },
      ],
      HOJE
    );
    expect(result).toBe("pago_isaac");
  });

  it("mistura cancelada + aberta: ignora a cancelada, considera so a aberta", () => {
    const result = derivarStatusFinanceiroMes(
      [
        { origem: "manual", status: "cancelada", data_vencimento: "2026-09-05" },
        { origem: "manual", status: "aberta", data_vencimento: "2026-09-30" },
      ],
      HOJE
    );
    expect(result).toBe("aberto");
  });
});
