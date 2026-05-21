import { describe, it, expect } from "vitest";
import { isDiaLetivo } from "./dias-letivos";
import type { Calendario, CalendarioExcecao } from "./types";

const calendario: Calendario = {
  id: "cal-1",
  escolaId: "esc-1",
  anoLetivo: 2026,
  dataInicio: "2026-02-02",
  dataFim: "2026-12-18",
  diasSemanaLetivos: [1, 2, 3, 4, 5], // seg-sex
};

describe("isDiaLetivo", () => {
  it("dia útil dentro do período é letivo", () => {
    // 2026-03-04 é uma quarta-feira
    expect(isDiaLetivo("2026-03-04", calendario, [])).toBe(true);
  });

  it("sábado não é letivo", () => {
    // 2026-03-07 é um sábado
    expect(isDiaLetivo("2026-03-07", calendario, [])).toBe(false);
  });

  it("domingo não é letivo", () => {
    // 2026-03-08 é um domingo
    expect(isDiaLetivo("2026-03-08", calendario, [])).toBe(false);
  });

  it("data antes do início do ano não é letiva", () => {
    expect(isDiaLetivo("2026-01-15", calendario, [])).toBe(false);
  });

  it("data depois do fim do ano não é letiva", () => {
    expect(isDiaLetivo("2026-12-25", calendario, [])).toBe(false);
  });

  it("feriado de um dia não é letivo", () => {
    const excecoes: CalendarioExcecao[] = [
      {
        id: "e1", calendarioId: "cal-1", escolaId: "esc-1",
        dataInicio: "2026-03-04", dataFim: "2026-03-04",
        tipo: "feriado", descricao: "Feriado teste",
      },
    ];
    expect(isDiaLetivo("2026-03-04", calendario, excecoes)).toBe(false);
  });

  it("dia dentro de recesso de vários dias não é letivo", () => {
    const excecoes: CalendarioExcecao[] = [
      {
        id: "e2", calendarioId: "cal-1", escolaId: "esc-1",
        dataInicio: "2026-07-06", dataFim: "2026-07-24",
        tipo: "recesso", descricao: "Recesso de julho",
      },
    ];
    // 2026-07-15 é uma quarta dentro do recesso
    expect(isDiaLetivo("2026-07-15", calendario, excecoes)).toBe(false);
  });
});
