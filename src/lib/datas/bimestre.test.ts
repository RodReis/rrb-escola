import { describe, it, expect } from "vitest";
import { bimestreFromData } from "./bimestre";

describe("bimestreFromData", () => {
  it("janeiro → 1", () => expect(bimestreFromData("2026-01-15")).toBe(1));
  it("março → 1", () => expect(bimestreFromData("2026-03-31")).toBe(1));
  it("abril → 2", () => expect(bimestreFromData("2026-04-01")).toBe(2));
  it("junho → 2", () => expect(bimestreFromData("2026-06-30")).toBe(2));
  it("julho → 3", () => expect(bimestreFromData("2026-07-01")).toBe(3));
  it("setembro → 3", () => expect(bimestreFromData("2026-09-30")).toBe(3));
  it("outubro → 4", () => expect(bimestreFromData("2026-10-01")).toBe(4));
  it("dezembro → 4", () => expect(bimestreFromData("2026-12-31")).toBe(4));
  it("data inválida → mês corrente fallback", () => {
    const v = bimestreFromData("xxx");
    expect([1, 2, 3, 4]).toContain(v);
  });
});
