import { describe, it, expect } from "vitest";
import { isDiaLetivo, contarDiasLetivos } from "./dias-letivos";
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

  it("data malformada não é letiva", () => {
    expect(isDiaLetivo("", calendario, [])).toBe(false);
    expect(isDiaLetivo("2026-3-4", calendario, [])).toBe(false);
    expect(isDiaLetivo("data-invalida", calendario, [])).toBe(false);
  });
});

describe("contarDiasLetivos", () => {
  it("conta apenas dias úteis num período de uma semana", () => {
    const cal: Calendario = {
      id: "c", escolaId: "e", anoLetivo: 2026,
      dataInicio: "2026-03-02", // segunda
      dataFim: "2026-03-08",    // domingo
      diasSemanaLetivos: [1, 2, 3, 4, 5],
    };
    // seg a sex = 5 dias letivos
    expect(contarDiasLetivos(cal, [])).toBe(5);
  });

  it("desconta feriado dentro do período", () => {
    const cal: Calendario = {
      id: "c", escolaId: "e", anoLetivo: 2026,
      dataInicio: "2026-03-02",
      dataFim: "2026-03-08",
      diasSemanaLetivos: [1, 2, 3, 4, 5],
    };
    const excecoes: CalendarioExcecao[] = [
      {
        id: "f", calendarioId: "c", escolaId: "e",
        dataInicio: "2026-03-04", dataFim: "2026-03-04",
        tipo: "feriado", descricao: "Feriado",
      },
    ];
    // 5 dias úteis - 1 feriado = 4
    expect(contarDiasLetivos(cal, excecoes)).toBe(4);
  });
});
