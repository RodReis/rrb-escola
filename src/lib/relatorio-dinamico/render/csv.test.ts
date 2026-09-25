import { describe, it, expect } from "vitest";
import { gerarCsv } from "./csv";
import { nomeArquivo } from "./baixar";

describe("gerarCsv", () => {
  it("BOM, ; e CRLF com cabeçalho de labels", () => {
    const csv = gerarCsv({
      colunas: [{ key: "a", label: "Nome", grupo: "g", tipo: "texto" }, { key: "b", label: "Obs", grupo: "g", tipo: "texto" }],
      linhas: [["Ana", "tem ; ponto"], ["Bia \"B\"", "linha1\nlinha2"]],
    });
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1)).toBe('Nome;Obs\r\nAna;"tem ; ponto"\r\n"Bia ""B""";"linha1\nlinha2"\r\n');
  });
});

describe("nomeArquivo", () => {
  it("slug + data", () => {
    expect(nomeArquivo("Festa do 3º Ano", "pdf", new Date(2026, 8, 25, 10, 7))).toBe("festa-do-3-ano-20260925-1007.pdf");
  });
});
