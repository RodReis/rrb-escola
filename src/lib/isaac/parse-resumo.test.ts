import { describe, expect, it } from "vitest";
import {
  linhaPorTipo,
  parseResumoIsaac,
  ResumoInvalidoError,
  validarResumo,
} from "./parse-resumo";

/**
 * Fixtures com a estrutura exata dos resumos reais de setembro/2026 (o texto
 * que pdf-parse extrai), com os valores reais — são totais de repasse, não dado
 * de aluno, e são o critério de aceite do importador.
 */

const RESUMO_EPG_TRINDADE = `EPG Trindade
Repasse de mensalidades Período de atualizações:
30 de Julho até 31 de Agosto de 2026
Setembro de 2026
Transferências programadas
5 de Setembro
R$ 125.479,01
15 de Setembro
R$ 53.776,71
Recebimentos
Valores referentes a parcelas de mensalidades
307 alunos | 327 cobranças
Mensalidades 	R$ 215.174,95
Mudanças em mensalidades
Novo contrato 	R$ 5.960,00
Descontos
Valores referentes a parcelas de mensalidades
Taxa isaac 	- R$ 16.052,69
Mudanças em mensalidades
Recebido na escola 	- R$ 1.790,00
Cancelado 	- R$ 890,00
Outros valores
Crédito
Débito da parcela do crédito de curto prazo 	- R$ 23.146,54
Valor total a ser transferido
R$ 179.255,72
WhatsApp (11) 97876-5797
falecom@isaac.com.br
www.isaac.com.br
OISA TECNOLOGIA E SERVIÇOS LTDA.
CNPJ 38.008.510/0001-88
R. Augusta, 2840 - Jardins, São Paulo - SP, 01412-100
|`;

/** Mesma unidade-irmã: SEM "Cancelado" e SEM a seção "Outros valores". */
const RESUMO_EDUCACAO_INFANTIL = `EPG Trindade - Educação Infantil
Repasse de mensalidades Período de atualizações:
30 de Julho até 31 de Agosto de 2026
Setembro de 2026
Transferências programadas
5 de Setembro
R$ 115.216,04
15 de Setembro
R$ 49.378,30
Recebimentos
Valores referentes a parcelas de mensalidades
451 alunos | 587 cobranças
Mensalidades 	R$ 180.690,86
Mudanças em mensalidades
Novo contrato 	R$ 1.019,50
Descontos
Valores referentes a parcelas de mensalidades
Taxa isaac 	- R$ 13.241,06
Mudanças em mensalidades
Recebido na escola 	- R$ 3.874,96
Valor total a ser transferido
R$ 164.594,34
WhatsApp (11) 97876-5797
falecom@isaac.com.br`;

describe("parseResumoIsaac — EPG Trindade (set/2026)", () => {
  const resumo = parseResumoIsaac(RESUMO_EPG_TRINDADE);

  it("lê unidade, competência do repasse e período de atualizações", () => {
    expect(resumo.unidade).toBe("EPG Trindade");
    expect(resumo.competencia).toBe("2026-09");
    expect(resumo.periodo).toBe("30 de julho até 31 de agosto de 2026");
  });

  it("extrai as duas transferências programadas com data ISO", () => {
    expect(resumo.transferencias).toEqual([
      { data: "2026-09-05", valor: 125479.01 },
      { data: "2026-09-15", valor: 53776.71 },
    ]);
  });

  it("extrai as seis linhas com o sinal que o PDF mostra", () => {
    expect(resumo.linhas).toEqual([
      { grupo: "recebimento", tipo: "Mensalidades", valor: 215174.95 },
      { grupo: "recebimento", tipo: "Novo contrato", valor: 5960 },
      { grupo: "desconto", tipo: "Taxa isaac", valor: -16052.69 },
      { grupo: "desconto", tipo: "Recebido na escola", valor: -1790 },
      { grupo: "desconto", tipo: "Cancelado", valor: -890 },
      { grupo: "outros", tipo: "Débito da parcela do crédito de curto prazo", valor: -23146.54 },
    ]);
  });

  it("captura o crédito de curto prazo, que o analítico .xlsx não traz", () => {
    expect(linhaPorTipo(resumo, "Débito da parcela do crédito de curto prazo")).toBe(-23146.54);
  });

  it("lê o total e a contagem de conferência do cabeçalho", () => {
    expect(resumo.total).toBe(179255.72);
    expect(resumo.alunosInformados).toBe(307);
    expect(resumo.cobrancasInformadas).toBe(327);
  });

  it("fecha nas duas equações independentes", () => {
    expect(validarResumo(resumo)).toEqual([]);
  });

  it("ignora rodapé e subtítulos, sem inventar linha", () => {
    // "Crédito", "Mudanças em mensalidades" e o endereço do isaac não viram linha.
    expect(resumo.linhas.map((l) => l.tipo)).not.toContain("Crédito");
    expect(resumo.linhas.some((l) => l.tipo.includes("Augusta"))).toBe(false);
  });
});

describe("parseResumoIsaac — Educação Infantil (set/2026)", () => {
  const resumo = parseResumoIsaac(RESUMO_EDUCACAO_INFANTIL);

  it("aceita resumo sem as seções ausentes — elas somem quando vazias", () => {
    expect(resumo.linhas).toHaveLength(4);
    expect(linhaPorTipo(resumo, "Cancelado")).toBeNull();
    expect(linhaPorTipo(resumo, "Débito da parcela do crédito de curto prazo")).toBeNull();
  });

  it("fecha no total do Aceite B", () => {
    expect(resumo.total).toBe(164594.34);
    expect(validarResumo(resumo)).toEqual([]);
  });
});

describe("parseResumoIsaac — falha ruidosa, nunca silenciosa", () => {
  it("recusa PDF vazio", () => {
    expect(() => parseResumoIsaac("")).toThrow(ResumoInvalidoError);
  });

  it("recusa resumo sem competência", () => {
    const semCompetencia = RESUMO_EPG_TRINDADE.replace("Setembro de 2026\n", "");
    expect(() => parseResumoIsaac(semCompetencia)).toThrow(/Competência não encontrada/);
  });

  it("recusa resumo sem total", () => {
    const semTotal = RESUMO_EPG_TRINDADE.replace("Valor total a ser transferido\nR$ 179.255,72\n", "");
    expect(() => parseResumoIsaac(semTotal)).toThrow(/Total não encontrado/);
  });

  it("recusa resumo sem transferências", () => {
    const semTransferencias = RESUMO_EPG_TRINDADE
      .replace("Transferências programadas\n5 de Setembro\nR$ 125.479,01\n15 de Setembro\nR$ 53.776,71\n", "");
    expect(() => parseResumoIsaac(semTransferencias)).toThrow(/Nenhuma transferência/);
  });

  it("acusa quando uma linha some: o total deixa de fechar em vez de o dinheiro sumir", () => {
    const semCredito = RESUMO_EPG_TRINDADE
      .replace("Débito da parcela do crédito de curto prazo 	- R$ 23.146,54\n", "");
    const divergencias = validarResumo(parseResumoIsaac(semCredito));
    expect(divergencias).toHaveLength(1);
    expect(divergencias[0].o_que).toMatch(/soma das linhas/);
  });

  it("acusa quando uma transferência some", () => {
    const umaSo = RESUMO_EPG_TRINDADE.replace("15 de Setembro\nR$ 53.776,71\n", "");
    const divergencias = validarResumo(parseResumoIsaac(umaSo));
    expect(divergencias).toHaveLength(1);
    expect(divergencias[0].o_que).toMatch(/soma das transferências/);
  });

  it("um rótulo novo do isaac entra como linha e quebra o fechamento — não é engolido", () => {
    const comLinhaNova = RESUMO_EPG_TRINDADE
      .replace("Valor total a ser transferido", "Multa contratual 	- R$ 100,00\nValor total a ser transferido");
    const resumo = parseResumoIsaac(comLinhaNova);
    expect(linhaPorTipo(resumo, "Multa contratual")).toBe(-100);
    expect(validarResumo(resumo)).toHaveLength(1);
  });
});
