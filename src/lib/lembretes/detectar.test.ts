import { describe, it, expect } from "vitest";
import { filtrarElegiveis } from "./detectar";

const HOJE = "2026-03-20";

function cobranca(over: Partial<{
  id: string;
  status: string;
  data_vencimento: string;
  temResponsavel: boolean;
}>) {
  const base = {
    id: "cob-1",
    descricao: "Mensalidade 03/2026",
    valor_final: 450,
    data_vencimento: "2026-03-10",
    status: "aberta",
    aluno_id: "aluno-1",
    temResponsavel: true,
    ...over,
  };
  return {
    id: base.id,
    descricao: base.descricao,
    valor_final: base.valor_final,
    data_vencimento: base.data_vencimento,
    status: base.status,
    aluno_id: base.aluno_id,
    alunos: {
      nome: "João Silva",
      responsaveis_aluno: base.temResponsavel
        ? [{ nome: "Maria Silva", celular: "62999990000", responsavel_financeiro: true }]
        : [],
    },
  };
}

describe("filtrarElegiveis", () => {
  it("cobrança vencida, em aberto, com responsável → elegível", () => {
    const r = filtrarElegiveis([cobranca({})], HOJE, new Set());
    expect(r).toHaveLength(1);
    expect(r[0].cobrancaId).toBe("cob-1");
    expect(r[0].telefone).toBe("62999990000");
    expect(r[0].diasAtraso).toBe(10);
  });

  it("cobrança não vencida (vence depois de hoje) → ignorada", () => {
    const r = filtrarElegiveis([cobranca({ data_vencimento: "2026-04-01" })], HOJE, new Set());
    expect(r).toHaveLength(0);
  });

  it("cobrança paga → ignorada", () => {
    const r = filtrarElegiveis([cobranca({ status: "paga" })], HOJE, new Set());
    expect(r).toHaveLength(0);
  });

  it("cobrança cancelada → ignorada", () => {
    const r = filtrarElegiveis([cobranca({ status: "cancelada" })], HOJE, new Set());
    expect(r).toHaveLength(0);
  });

  it("status parcial e vencida também são elegíveis", () => {
    expect(filtrarElegiveis([cobranca({ status: "parcial" })], HOJE, new Set())).toHaveLength(1);
    expect(filtrarElegiveis([cobranca({ status: "vencida" })], HOJE, new Set())).toHaveLength(1);
  });

  it("cobrança sem responsável financeiro com celular → ignorada", () => {
    const r = filtrarElegiveis([cobranca({ temResponsavel: false })], HOJE, new Set());
    expect(r).toHaveLength(0);
  });

  it("cobrança já com lembrete enviado → ignorada quando o id está no Set", () => {
    const r = filtrarElegiveis([cobranca({ id: "cob-9" })], HOJE, new Set(["cob-9"]));
    expect(r).toHaveLength(0);
  });

  it("Set vazio não exclui nada (modo forçar reenvio)", () => {
    const r = filtrarElegiveis([cobranca({ id: "cob-9" })], HOJE, new Set());
    expect(r).toHaveLength(1);
  });
});
