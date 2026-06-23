import { describe, it, expect } from "vitest";
import { agruparPorStatus } from "./pipeline-indicadores-helpers";
import { STATUS_LEAD } from "@/lib/validation/pipeline";

describe("agruparPorStatus", () => {
  it("conta por status_lead", () => {
    const out = agruparPorStatus([
      { status_lead: "novo" },
      { status_lead: "novo" },
      { status_lead: "convertido" },
    ]);
    const novo = out.find((s) => s.status === "novo");
    const conv = out.find((s) => s.status === "convertido");
    expect(novo?.total).toBe(2);
    expect(conv?.total).toBe(1);
  });

  it("retorna os 5 status na ordem do enum, zerando ausentes", () => {
    const out = agruparPorStatus([{ status_lead: "reserva" }]);
    expect(out.map((s) => s.status)).toEqual([...STATUS_LEAD]);
    expect(out.find((s) => s.status === "perdido")?.total).toBe(0);
    expect(out.find((s) => s.status === "reserva")?.total).toBe(1);
  });

  it("ignora status nulo/desconhecido sem quebrar", () => {
    const out = agruparPorStatus([
      { status_lead: null },
      { status_lead: undefined },
      { status_lead: "inexistente" },
      { status_lead: "novo" },
    ]);
    expect(out.find((s) => s.status === "novo")?.total).toBe(1);
    // status fora do enum não aparece no resultado (só os 5 canônicos)
    expect(out).toHaveLength(STATUS_LEAD.length);
  });

  it("lista vazia → todos zerados", () => {
    const out = agruparPorStatus([]);
    expect(out.every((s) => s.total === 0)).toBe(true);
    expect(out).toHaveLength(STATUS_LEAD.length);
  });
});
