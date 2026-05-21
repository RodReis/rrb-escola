import { describe, it, expect } from "vitest";
import { calcularPascoa } from "./feriados";

describe("calcularPascoa", () => {
  it("Páscoa 2024 = 31 de março", () => {
    expect(calcularPascoa(2024)).toBe("2024-03-31");
  });
  it("Páscoa 2025 = 20 de abril", () => {
    expect(calcularPascoa(2025)).toBe("2025-04-20");
  });
  it("Páscoa 2026 = 5 de abril", () => {
    expect(calcularPascoa(2026)).toBe("2026-04-05");
  });
  it("Páscoa 2027 = 28 de março", () => {
    expect(calcularPascoa(2027)).toBe("2027-03-28");
  });
});
