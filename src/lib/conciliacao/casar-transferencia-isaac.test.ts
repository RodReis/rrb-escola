import { describe, expect, it } from "vitest";
import {
  casarTransferenciasIsaac,
  transferenciasAtrasadas,
  type CreditoExtrato,
  type TransferenciaPendente,
} from "./casar-transferencia-isaac";

const PINGUINHO = "company-pinguinho";
const INTEGRADO = "company-integrado";

function transferencia(over: Partial<TransferenciaPendente> = {}): TransferenciaPendente {
  return {
    id: "t1",
    repasseId: "r1",
    dataPrevista: "2026-09-05",
    valor: 125479.01,
    companyId: PINGUINHO,
    ...over,
  };
}

function credito(over: Partial<CreditoExtrato> = {}): CreditoExtrato {
  return {
    id: "e1",
    contaId: "conta-1",
    companyId: PINGUINHO,
    data: "2026-09-05",
    valor: 125479.01,
    descricao: "TED ISAAC",
    ...over,
  };
}

describe("casarTransferenciasIsaac", () => {
  it("casa as duas transferências do repasse com os créditos certos", () => {
    // Valores reais de set/2026, EPG Trindade: 70% no dia 05, 30% no dia 15.
    const transferencias = [
      transferencia({ id: "t05", dataPrevista: "2026-09-05", valor: 125479.01 }),
      transferencia({ id: "t15", dataPrevista: "2026-09-15", valor: 53776.71 }),
    ];
    const creditos = [
      credito({ id: "e05", data: "2026-09-05", valor: 125479.01 }),
      credito({ id: "e15", data: "2026-09-15", valor: 53776.71 }),
    ];

    const { casamentos, alertas } = casarTransferenciasIsaac(transferencias, creditos);
    expect(alertas).toEqual([]);
    expect(casamentos).toEqual([
      { transferenciaId: "t05", extratoId: "e05", valor: 125479.01, defasagemDias: 0 },
      { transferenciaId: "t15", extratoId: "e15", valor: 53776.71, defasagemDias: 0 },
    ]);
  });

  it("aceita crédito atrasado dentro da janela", () => {
    // Dia 05 caiu num sábado: o crédito entra na segunda.
    const { casamentos } = casarTransferenciasIsaac(
      [transferencia({ dataPrevista: "2026-09-05" })],
      [credito({ data: "2026-09-07" })],
    );
    expect(casamentos).toHaveLength(1);
    expect(casamentos[0].defasagemDias).toBe(2);
  });

  it("aceita crédito adiantado", () => {
    const { casamentos } = casarTransferenciasIsaac(
      [transferencia({ dataPrevista: "2026-09-05" })],
      [credito({ data: "2026-09-03" })],
    );
    expect(casamentos[0].defasagemDias).toBe(-2);
  });

  it("não casa fora da janela — vira alerta em vez de match forçado", () => {
    const { casamentos, alertas } = casarTransferenciasIsaac(
      [transferencia({ dataPrevista: "2026-09-05" })],
      [credito({ data: "2026-09-20" })],
    );
    expect(casamentos).toEqual([]);
    expect(alertas[0].tipo).toBe("sem_credito");
  });

  it("tolera diferença de um centavo, mas não de dois", () => {
    const umCentavo = casarTransferenciasIsaac(
      [transferencia({ valor: 125479.01 })],
      [credito({ valor: 125479.02 })],
    );
    expect(umCentavo.casamentos).toHaveLength(1);

    const doisCentavos = casarTransferenciasIsaac(
      [transferencia({ valor: 125479.01 })],
      [credito({ valor: 125479.03 })],
    );
    expect(doisCentavos.casamentos).toEqual([]);
    expect(doisCentavos.alertas[0].tipo).toBe("sem_credito");
  });

  it("não casa crédito de outro CNPJ — ligaria o dinheiro à empresa errada", () => {
    const { casamentos, alertas } = casarTransferenciasIsaac(
      [transferencia({ companyId: PINGUINHO })],
      [credito({ companyId: INTEGRADO })],
    );
    expect(casamentos).toEqual([]);
    expect(alertas[0].tipo).toBe("sem_credito");
  });

  it("conta sem empresa classificada ainda casa — nullable não bloqueia", () => {
    // company_id entrou sem backfill: conta antiga fica null até classificarem.
    const { casamentos } = casarTransferenciasIsaac(
      [transferencia({ companyId: PINGUINHO })],
      [credito({ companyId: null })],
    );
    expect(casamentos).toHaveLength(1);
  });

  it("dois créditos idênticos na janela viram alerta, não escolha arbitrária", () => {
    const { casamentos, alertas } = casarTransferenciasIsaac(
      [transferencia()],
      [credito({ id: "e1" }), credito({ id: "e2", data: "2026-09-06" })],
    );
    expect(casamentos).toEqual([]);
    expect(alertas[0].tipo).toBe("ambiguo");
    expect(alertas[0].detalhe).toMatch(/2 créditos/);
  });

  it("um crédito não é usado por duas transferências", () => {
    // Duas unidades repassando o mesmo valor no mesmo dia, um crédito só.
    const transferencias = [
      transferencia({ id: "tA", companyId: PINGUINHO, dataPrevista: "2026-09-05" }),
      transferencia({ id: "tB", companyId: INTEGRADO, dataPrevista: "2026-09-06" }),
    ];
    const { casamentos, alertas } = casarTransferenciasIsaac(transferencias, [
      credito({ id: "unico", companyId: null, data: "2026-09-05" }),
    ]);
    expect(casamentos).toHaveLength(1);
    expect(casamentos[0].transferenciaId).toBe("tA");
    expect(alertas).toHaveLength(1);
    expect(alertas[0].transferenciaId).toBe("tB");
  });

  it("sem crédito nenhum, toda transferência vira alerta", () => {
    const { casamentos, alertas } = casarTransferenciasIsaac([transferencia()], []);
    expect(casamentos).toEqual([]);
    expect(alertas).toHaveLength(1);
    expect(alertas[0].valorEsperado).toBe(125479.01);
  });
});

describe("transferenciasAtrasadas", () => {
  it("acusa a que passou da janela sem crédito", () => {
    const atrasadas = transferenciasAtrasadas(
      [
        transferencia({ id: "vencida", dataPrevista: "2026-09-05" }),
        transferencia({ id: "recente", dataPrevista: "2026-09-18" }),
      ],
      "2026-09-20",
    );
    expect(atrasadas.map((t) => t.id)).toEqual(["vencida"]);
  });

  it("não acusa a que ainda está na janela", () => {
    expect(transferenciasAtrasadas([transferencia({ dataPrevista: "2026-09-05" })], "2026-09-08")).toEqual([]);
  });
});
