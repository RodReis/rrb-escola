import { describe, it, expect } from "vitest";
import { resolverDeclaracao, validarParametros, PARAMETROS_SUPORTADOS, type DadosDeclaracao } from "./declaracao-resolver";

const dadosBase: DadosDeclaracao = {
  nomeAluno: "MARIA DA SILVA",
  matricula: "2026-001",
  dataNascimento: "2015-03-10",
  naturalidade: "Trindade - GO",
  filiacao: "JOÃO DA SILVA e ANA DA SILVA",
  anoLetivo: 2026,
  serieCorrente: "3º ANO",
  turma: "3º ANO A",
  turno: "Matutino",
  proximaSerie: "4º ANO",
  nomeEmpresa: "EPG Trindade",
  cidadeEmpresa: "Trindade",
  dataEmissaoIso: "2026-09-24"
};

describe("resolverDeclaracao", () => {
  it("resolve todos os parâmetros suportados com dado presente", () => {
    const modelo = {
      titulo: "DECLARAÇÃO",
      texto: "Aluno [NOME_ALUNO], matrícula [MATRICULA], nasc. [DATA_NASCIMENTO], natural de [CIDADE] - [UF], filho de [FILIACAO], cursando [SERIE_CORRENTE] turma [TURMA] turno [TURNO] no ano [ANO_LETIVO], próxima série [PROXIMA_SERIE].",
      fecho: "Emitido em [DATA_POR_EXTENSO_COM_CIDADE] / [DATA_POR_EXTENSO_SEM_CIDADE] / [EMPRESA]"
    };
    const resolvido = resolverDeclaracao(modelo, dadosBase);
    expect(resolvido.texto).toContain("MARIA DA SILVA");
    expect(resolvido.texto).toContain("2026-001");
    expect(resolvido.texto).toContain("10/03/2015");
    expect(resolvido.texto).toContain("Trindade");
    expect(resolvido.texto).toContain("GO");
    expect(resolvido.texto).toContain("JOÃO DA SILVA e ANA DA SILVA");
    expect(resolvido.texto).toContain("3º ANO");
    expect(resolvido.texto).toContain("3º ANO A");
    expect(resolvido.texto).toContain("Matutino");
    expect(resolvido.texto).toContain("2026");
    expect(resolvido.texto).toContain("4º ANO");
    expect(resolvido.fecho).toContain("EPG Trindade");
    expect(resolvido.fecho).toContain("24 de setembro de 2026");
    expect(resolvido.fecho).toContain("Trindade, 24 de setembro de 2026");
  });

  it("naturalidade ausente resolve CIDADE e UF para string vazia, sem quebrar", () => {
    const modelo = { titulo: "T", texto: "Natural de [CIDADE] - [UF].", fecho: "F" };
    const resolvido = resolverDeclaracao(modelo, { ...dadosBase, naturalidade: null });
    expect(resolvido.texto).toBe("Natural de  - .");
  });

  it("filiação ausente resolve FILIACAO para string vazia, sem quebrar", () => {
    const modelo = { titulo: "T", texto: "Filho de [FILIACAO].", fecho: "F" };
    const resolvido = resolverDeclaracao(modelo, { ...dadosBase, filiacao: null });
    expect(resolvido.texto).toBe("Filho de .");
  });

  it("sem próxima série (última da grade) resolve PROXIMA_SERIE para string vazia", () => {
    const modelo = { titulo: "T", texto: "Direito de matricular-se em [PROXIMA_SERIE].", fecho: "F" };
    const resolvido = resolverDeclaracao(modelo, { ...dadosBase, proximaSerie: null });
    expect(resolvido.texto).toBe("Direito de matricular-se em .");
  });

  it("resolve o título também (não só texto/fecho)", () => {
    const modelo = { titulo: "DECLARAÇÃO DE [NOME_ALUNO]", texto: "T", fecho: "F" };
    const resolvido = resolverDeclaracao(modelo, dadosBase);
    expect(resolvido.titulo).toBe("DECLARAÇÃO DE MARIA DA SILVA");
  });
});

describe("validarParametros", () => {
  it("aceita texto só com parâmetros da lista suportada", () => {
    const resultado = validarParametros("Aluno [NOME_ALUNO] da turma [TURMA].");
    expect(resultado).toEqual({ valido: true });
  });

  it("aceita texto sem nenhum parâmetro", () => {
    expect(validarParametros("Texto fixo sem parâmetros.")).toEqual({ valido: true });
  });

  it("rejeita parâmetro desconhecido, apontando o token exato", () => {
    const resultado = validarParametros("Aluno [NOME_ALNO] (erro de digitação).");
    expect(resultado).toEqual({ valido: false, tokenInvalido: "[NOME_ALNO]" });
  });

  it("todos os parâmetros de PARAMETROS_SUPORTADOS passam na validação", () => {
    const texto = PARAMETROS_SUPORTADOS.map((p) => `[${p}]`).join(" ");
    expect(validarParametros(texto)).toEqual({ valido: true });
  });
});
