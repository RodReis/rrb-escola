import { describe, it, expect } from "vitest";
import { tempoRelativoBR } from "./dates";

const now = new Date("2026-06-23T12:00:00Z");

describe("tempoRelativoBR", () => {
  it("retorna 'agora' para diferença < 1 min", () => {
    expect(tempoRelativoBR("2026-06-23T11:59:30Z", now)).toBe("agora");
  });

  it("minutos", () => {
    expect(tempoRelativoBR("2026-06-23T11:45:00Z", now)).toBe("há 15 min");
  });

  it("horas", () => {
    expect(tempoRelativoBR("2026-06-23T09:00:00Z", now)).toBe("há 3 h");
  });

  it("dias (até 7)", () => {
    expect(tempoRelativoBR("2026-06-21T12:00:00Z", now)).toBe("há 2 d");
  });

  it("acima de 7 dias cai em data absoluta", () => {
    expect(tempoRelativoBR("2026-06-01T12:00:00Z", now)).toBe("01/06/2026");
  });

  it("futuro vira 'agora'", () => {
    expect(tempoRelativoBR("2026-06-23T13:00:00Z", now)).toBe("agora");
  });

  it("vazio/nulo → string vazia", () => {
    expect(tempoRelativoBR(null, now)).toBe("");
    expect(tempoRelativoBR("", now)).toBe("");
  });
});
