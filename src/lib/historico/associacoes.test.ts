import { describe, expect, it } from "vitest";
import { rangesSobrepostos, validarNovaAssociacao } from "./associacoes";

describe("rangesSobrepostos", () => {
  it("detecta sobreposição parcial", () => {
    expect(rangesSobrepostos({ anoInicio: 2020, anoFim: 2024 }, { anoInicio: 2023, anoFim: 2026 })).toBe(true);
  });

  it("detecta range contido em outro", () => {
    expect(rangesSobrepostos({ anoInicio: 2020, anoFim: 2026 }, { anoInicio: 2022, anoFim: 2023 })).toBe(true);
  });

  it("aceita ranges adjacentes sem sobreposição", () => {
    expect(rangesSobrepostos({ anoInicio: 2020, anoFim: 2023 }, { anoInicio: 2024, anoFim: 2026 })).toBe(false);
  });

  it("detecta sobreposição de um único ano na borda", () => {
    expect(rangesSobrepostos({ anoInicio: 2020, anoFim: 2024 }, { anoInicio: 2024, anoFim: 2026 })).toBe(true);
  });
});

describe("validarNovaAssociacao", () => {
  it("aceita quando não há conflito", () => {
    const r = validarNovaAssociacao({ anoInicio: 2025, anoFim: 2026 }, [{ anoInicio: 2020, anoFim: 2024 }]);
    expect(r.ok).toBe(true);
  });

  it("rejeita apontando o range conflitante", () => {
    const existente = { anoInicio: 2020, anoFim: 2024 };
    const r = validarNovaAssociacao({ anoInicio: 2023, anoFim: 2026 }, [existente]);
    expect(r).toEqual({ ok: false, conflito: existente });
  });

  it("aceita quando não há nenhuma associação prévia", () => {
    expect(validarNovaAssociacao({ anoInicio: 2020, anoFim: 2026 }, []).ok).toBe(true);
  });
});
