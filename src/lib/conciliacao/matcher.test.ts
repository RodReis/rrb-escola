import { describe, expect, it } from "vitest";
import { casarPorE2E, sugerirPorValorData } from "@/lib/conciliacao/matcher";

describe("matcher conciliação", () => {
  it("casa pagamento por end_to_end_id exato", () => {
    expect(casarPorE2E(
      { id: "e1", tipo: "credito", valor: 100, data: "2026-09-11", end_to_end_id: "E2E123" },
      [{ id: "p1", valor_pago: 100, data_pagamento: "2026-09-11", end_to_end_id: "E2E123" }],
    )?.id).toBe("p1");
  });

  it("sugere por valor e janela de data", () => {
    const sugestoes = sugerirPorValorData(
      { id: "e1", tipo: "debito", valor: 49.9, data: "2026-09-11" },
      [
        { id: "a", valor: 49.9, data: "2026-09-02" },
        { id: "b", valor: 49.9, data: "2026-08-20" },
      ],
      10,
    );

    expect(sugestoes.map((s) => s.id)).toEqual(["a"]);
  });
});
