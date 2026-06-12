import { describe, expect, it } from "vitest";
import { nthDiaUtil, isDiaUtil } from "./date-utils";

describe("date-utils", () => {
  it("5º dia útil de junho/2026 é 05/06 (sexta), sem feriados", () => {
    expect(nthDiaUtil("2026-06", 5, [])).toBe("2026-06-05");
  });
  it("pula fim de semana: 1º dia útil de agosto/2026 é 03/08 (segunda)", () => {
    expect(nthDiaUtil("2026-08", 1, [])).toBe("2026-08-03");
  });
  it("feriado local desloca o dia útil", () => {
    expect(nthDiaUtil("2026-06", 5, ["2026-06-04"])).toBe("2026-06-08");
  });
  it("isDiaUtil rejeita sábado", () => {
    expect(isDiaUtil("2026-06-06", [])).toBe(false);
  });
});
