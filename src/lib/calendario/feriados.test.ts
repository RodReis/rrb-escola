import { describe, it, expect } from "vitest";
import { calcularPascoa } from "./feriados";
import { feriadosNacionais } from "./feriados";

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

describe("feriadosNacionais", () => {
  it("retorna 11 feriados (8 fixos + 3 móveis)", () => {
    expect(feriadosNacionais(2026)).toHaveLength(11);
  });

  it("inclui os feriados fixos com data correta", () => {
    const fer = feriadosNacionais(2026);
    const datas = Object.fromEntries(fer.map((f) => [f.descricao, f.data]));
    expect(datas["Confraternização Universal"]).toBe("2026-01-01");
    expect(datas["Tiradentes"]).toBe("2026-04-21");
    expect(datas["Dia do Trabalho"]).toBe("2026-05-01");
    expect(datas["Independência do Brasil"]).toBe("2026-09-07");
    expect(datas["Nossa Senhora Aparecida"]).toBe("2026-10-12");
    expect(datas["Finados"]).toBe("2026-11-02");
    expect(datas["Proclamação da República"]).toBe("2026-11-15");
    expect(datas["Natal"]).toBe("2026-12-25");
  });

  it("calcula feriados móveis a partir da Páscoa 2026 (05/04)", () => {
    const fer = feriadosNacionais(2026);
    const datas = Object.fromEntries(fer.map((f) => [f.descricao, f.data]));
    // Páscoa 2026 = 2026-04-05
    expect(datas["Sexta-feira Santa"]).toBe("2026-04-03");      // Páscoa - 2
    expect(datas["Carnaval"]).toBe("2026-02-17");               // Páscoa - 47
    expect(datas["Corpus Christi"]).toBe("2026-06-04");         // Páscoa + 60
  });
});
