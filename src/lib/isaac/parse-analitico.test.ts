import { describe, expect, it } from "vitest";
import {
  AnaliticoInvalidoError,
  classificarProduto,
  mudancasPorTipo,
  parseAnaliticoIsaac,
  parseCompetencia,
  parseDataMudanca,
  separarTiposMudanca,
  validarAnalitico,
} from "./parse-analitico";

/**
 * Fixtures sintéticas: nomes inventados (o repositório tirou planilhas de aluno
 * do versionamento), mas com a estrutura e os casos-limite dos analíticos reais
 * de agosto e setembro/2026 — inclusive os três que o spec não previa: valor
 * base negativo, "Novo contrato" com a receita na coluna de mudança, e
 * competência anterior à do repasse.
 */

const CABECALHO = [
  "Aluno (a)",
  "Produto",
  "Competência",
  "Mensalidades",
  "Mudanças em mensalidades",
  "Valor base para cálculo ", // espaço final, como no arquivo real
  "Taxa isaac",
  "Valor final",
  "Tipo mudança em mensalidades",
  "Identificador da parcela",
];

const CABECALHO_MUDANCAS = [
  "Aluno (a)",
  "Produto",
  "Competência",
  "Valor da mudança",
  "Data da mudança",
  "Tipo mudança em mensalidades",
  "Identificador da parcela",
];

const PARCELAS = [
  CABECALHO,
  ["Aluno Um", "Mensalidade - Ensino Fundamental - 5º Ano", "Agosto/2026", 745, 0, 745, 54.3, 690.7, null, "aaa11111"],
  ["Aluno Dois", "Anuidade 1º Ano", "Agosto/2026", 685, 0, 685, 49.93, 635.07, null, "bbb22222"],
  ["Aluno Três", "Materia De Apoio Pedagogico Infantil 4", "Agosto/2026", 300, 0, 300, 21.87, 278.13, null, "ccc33333"],
  // "Novo contrato": mensalidade ZERO, receita inteira na coluna de mudança.
  ["Aluno Quatro", "Mensalidade - Ensino Fundamental - 2º Ano", "Agosto/2026", 0, 745, 745, 54.31, 690.69, "Novo contrato", "ddd44444"],
  // Estorno: base NEGATIVA. Não pode virar cobrança, nem ser descartado calado.
  ["Aluno Cinco", "Mensalidade - Ensino Fundamental - 1º Ano", "Agosto/2026", 0, -690, -690, 0, -690, "Recebido na escola", "eee55555"],
  // Cancelamento: base e taxa negativas.
  ["Aluno Seis", "Mensalidade - Ensino Fundamental - 8º Ano", "Agosto/2026", 0, -890, -890, -64.88, -825.12, "Cancelado", "fff66666"],
  // Ajuste de centavo: base ZERO com taxa 0,01.
  ["Aluno Sete", "Mensalidade - Ensino Fundamental - 6º Ano", "Agosto/2026", 0, 0, 0, 0.01, -0.01, "Adicional desc. antecipação", "ggg77777"],
  // Competência ANTERIOR à do repasse — parcela atrasada que só agora repassou.
  ["Aluno Oito", "Mensalidade - Ensino Fundamental - 7º Ano", "Junho/2026", 500, 0, 500, 36.5, 463.5, null, "hhh88888"],
  // Tipo COMPOSTO: o isaac junta dois tipos na mesma célula com barra.
  ["Aluno Nove", "Mensalidade - Ensino Fundamental - 3º Ano", "Setembro/2026", 650, -650, 0, 47.38, -47.38, "Adicional desc. antecipação / Recebido na escola", "iii99999"],
  // Linhas vazias da grade do xlsx, que o parser tem que ignorar.
  [],
  [null, null, null],
];

const MUDANCAS = [
  CABECALHO_MUDANCAS,
  ["Aluno Cinco", "Mensalidade - Ensino Fundamental - 1º Ano", "Agosto/2026", -690, "15/07/2026", "Recebido na escola", "eee55555"],
  ["Aluno Seis", "Mensalidade - Ensino Fundamental - 8º Ano", "Agosto/2026", -890, "30/07/2026", "Cancelado", "fff66666"],
  ["Aluno Sete", "Mensalidade - Ensino Fundamental - 6º Ano", "Agosto/2026", 0, "30/07/2026", "Adicional desc. antecipação", "ggg77777"],
  [],
];

describe("classificarProduto", () => {
  it("trata mensalidade e anuidade como mensalidade", () => {
    expect(classificarProduto("Mensalidade - Ensino Fundamental - 5º Ano")).toBe("mensalidade");
    expect(classificarProduto("Anuidade 1º Ano")).toBe("mensalidade");
    expect(classificarProduto("Anuidade 3º Ano")).toBe("mensalidade");
  });

  it("aceita as três grafias de material que o isaac usa", () => {
    // O isaac escreve "Materia" sem acento em algumas e "Material" em outras.
    expect(classificarProduto("Materia De Apoio Pedagogico Infantil 4")).toBe("material");
    expect(classificarProduto("Material Apoio Pedagógico Fund 2")).toBe("material");
    expect(classificarProduto("Material Didático")).toBe("material");
  });

  it("cai em 'outro' quando não reconhece, em vez de adivinhar", () => {
    expect(classificarProduto("Taxa de rematrícula")).toBe("outro");
    expect(classificarProduto("")).toBe("outro");
  });
});

describe("parseCompetencia", () => {
  it("converte o mês por extenso em PT-BR para YYYY-MM", () => {
    expect(parseCompetencia("Agosto/2026")).toBe("2026-08");
    expect(parseCompetencia("Junho/2026")).toBe("2026-06");
    expect(parseCompetencia("Março/2026")).toBe("2026-03");
    expect(parseCompetencia("Dezembro/2025")).toBe("2025-12");
  });

  it("recusa o que não reconhece em vez de gravar texto livre", () => {
    // A coluna tem check ^\d{4}-\d{2}$: passar adiante quebraria só no insert.
    expect(() => parseCompetencia("2026-08")).toThrow(AnaliticoInvalidoError);
    expect(() => parseCompetencia("Setembre/2026")).toThrow(/não reconhecida/);
    expect(() => parseCompetencia(null)).toThrow(AnaliticoInvalidoError);
  });
});

describe("parseDataMudanca", () => {
  it("converte DD/MM/AAAA para ISO", () => {
    expect(parseDataMudanca("15/07/2026")).toBe("2026-07-15");
  });

  it("aceita Date, que é o que exceljs devolve em célula formatada como data", () => {
    expect(parseDataMudanca(new Date(Date.UTC(2026, 6, 15)))).toBe("2026-07-15");
  });

  it("devolve null em vez de data inventada", () => {
    expect(parseDataMudanca(null)).toBeNull();
    expect(parseDataMudanca("")).toBeNull();
    expect(parseDataMudanca("julho")).toBeNull();
  });
});

describe("parseAnaliticoIsaac", () => {
  const analitico = parseAnaliticoIsaac(PARCELAS, MUDANCAS);

  it("ignora as linhas vazias da grade do xlsx", () => {
    expect(analitico.parcelas).toHaveLength(9);
    expect(analitico.totais.linhas).toBe(9);
  });

  it("classifica o produto de cada parcela", () => {
    const porId = new Map(analitico.parcelas.map((p) => [p.idParcela, p]));
    expect(porId.get("aaa11111")?.tipo).toBe("mensalidade");
    expect(porId.get("bbb22222")?.tipo).toBe("mensalidade");
    expect(porId.get("ccc33333")?.tipo).toBe("material");
  });

  it("preserva parcela com valor base negativo — é estorno, não lixo a descartar", () => {
    const estorno = analitico.parcelas.find((p) => p.idParcela === "eee55555");
    expect(estorno?.valorBase).toBe(-690);
    expect(estorno?.tipoMudanca).toBe("Recebido na escola");
  });

  it("preserva a parcela de ajuste com base zero e taxa de centavo", () => {
    const ajuste = analitico.parcelas.find((p) => p.idParcela === "ggg77777");
    expect(ajuste?.valorBase).toBe(0);
    expect(ajuste?.taxa).toBe(0.01);
  });

  it("guarda competência da parcela distinta da do repasse", () => {
    const atrasada = analitico.parcelas.find((p) => p.idParcela === "hhh88888");
    expect(atrasada?.competencia).toBe("2026-06");
  });

  it("soma os totais das cinco colunas de valor", () => {
    expect(analitico.totais.mensalidades).toBe(2880);
    expect(analitico.totais.mudancas).toBe(-1485);
    expect(analitico.totais.base).toBe(1395);
    expect(analitico.totais.taxa).toBe(199.42);
    expect(analitico.totais.final).toBe(1195.58);
  });

  it("fecha nas duas identidades internas do arquivo", () => {
    expect(validarAnalitico(analitico)).toEqual([]);
  });

  it("lê a aba de mudanças com data e tipo", () => {
    expect(analitico.mudancas).toHaveLength(3);
    expect(analitico.mudancas[0]).toEqual({
      idParcela: "eee55555",
      nomeIsaac: "Aluno Cinco",
      produto: "Mensalidade - Ensino Fundamental - 1º Ano",
      competencia: "2026-08",
      valor: -690,
      dataMudanca: "2026-07-15",
      tipo: "Recebido na escola",
    });
  });
});

describe("mudancasPorTipo — é o que casa o analítico com o resumo", () => {
  const porTipo = mudancasPorTipo(parseAnaliticoIsaac(PARCELAS, MUDANCAS));

  it("soma 'Novo contrato' pela coluna de mudança, porque a mensalidade é zero", () => {
    // Em set/2026 isso vale R$ 5.960,00: somar só "Mensalidades" perderia tudo.
    expect(porTipo.get("Novo contrato")).toBe(745);
  });

  it("conta tipo composto em CADA tipo que o compõe", () => {
    // Regressão: o isaac junta dois tipos numa célula só, separados por barra
    // ("Adicional desc. antecipação / Recebido na escola"). Tratar a célula
    // como rótulo único fez o total de "Recebido na escola" da Educação
    // Infantil em set/2026 dar -3.224,96 em vez dos -3.874,96 do resumo.
    expect(porTipo.get("Recebido na escola")).toBe(-690 + -650);
    expect(porTipo.get("Adicional desc. antecipação")).toBe(0 + -650);
  });

  it("devolve os descontos negativos, como o resumo mostra", () => {
    expect(porTipo.get("Cancelado")).toBe(-890);
  });

  it("não cria entrada para parcela sem tipo de mudança", () => {
    expect(porTipo.has("")).toBe(false);
    expect(Array.from(porTipo.keys()).sort()).toEqual([
      "Adicional desc. antecipação",
      "Cancelado",
      "Novo contrato",
      "Recebido na escola",
    ]);
  });
});

describe("separarTiposMudanca", () => {
  it("divide o tipo composto que o isaac grava com barra", () => {
    expect(separarTiposMudanca("Adicional desc. antecipação / Recebido na escola")).toEqual([
      "Adicional desc. antecipação",
      "Recebido na escola",
    ]);
  });

  it("devolve o tipo simples intacto", () => {
    expect(separarTiposMudanca("Cancelado")).toEqual(["Cancelado"]);
  });

  it("devolve lista vazia para parcela sem mudança", () => {
    expect(separarTiposMudanca(null)).toEqual([]);
    expect(separarTiposMudanca("")).toEqual([]);
  });
});

describe("parseAnaliticoIsaac — falha ruidosa", () => {
  it("recusa aba vazia", () => {
    expect(() => parseAnaliticoIsaac([], [])).toThrow(/vazia/);
  });

  it("recusa coluna renomeada, nomeando a que faltou", () => {
    const renomeado = [["Aluno (a)", "Produto", "Competência", "Valor", "x", "y", "z", "w", "v", "u"], ...PARCELAS.slice(1)];
    expect(() => parseAnaliticoIsaac(renomeado, [])).toThrow(/"Mensalidades" não encontrada/);
  });

  it("aceita coluna reordenada, porque mapeia por nome e não por posição", () => {
    const ordemTrocada = PARCELAS.map((linha) =>
      linha.length === 0 ? linha : [linha[9], ...linha.slice(0, 9)],
    );
    const analitico = parseAnaliticoIsaac(ordemTrocada, []);
    expect(analitico.parcelas).toHaveLength(9);
    expect(analitico.totais.base).toBe(1395);
  });

  it("recusa identificador de parcela vazio — sem ele o reimport duplicaria", () => {
    const semId = [CABECALHO, ["Aluno X", "Mensalidade - 1º Ano", "Agosto/2026", 100, 0, 100, 7, 93, null, ""]];
    expect(() => parseAnaliticoIsaac(semId, [])).toThrow(/Identificador da parcela" vazio/);
  });

  it("recusa identificador repetido no mesmo arquivo", () => {
    const duplicado = [
      CABECALHO,
      ["Aluno X", "Mensalidade - 1º Ano", "Agosto/2026", 100, 0, 100, 7, 93, null, "zzz99999"],
      ["Aluno Y", "Mensalidade - 2º Ano", "Agosto/2026", 100, 0, 100, 7, 93, null, "zzz99999"],
    ];
    expect(() => parseAnaliticoIsaac(duplicado, [])).toThrow(/repetido no arquivo: zzz99999/);
  });

  it("recusa valor não numérico em vez de silenciar como zero", () => {
    const sujo = [CABECALHO, ["Aluno X", "Mensalidade - 1º Ano", "Agosto/2026", "n/d", 0, 100, 7, 93, null, "kkk00000"]];
    expect(() => parseAnaliticoIsaac(sujo, [])).toThrow(/não é número/);
  });

  it("acusa quando o arquivo não fecha internamente", () => {
    const adulterado = [CABECALHO, ["Aluno X", "Mensalidade - 1º Ano", "Agosto/2026", 100, 0, 999, 7, 93, null, "mmm00000"]];
    const divergencias = validarAnalitico(parseAnaliticoIsaac(adulterado, []));
    expect(divergencias.map((d) => d.o_que)).toContain("base ≠ mensalidades + mudanças");
  });
});
