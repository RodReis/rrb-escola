import { describe, expect, it } from "vitest";
import {
  competenciasDaJanela,
  extrairEndToEndId,
  extrairTransacoes,
  idTransacao,
  mapearLote,
  parseValor,
} from "@/lib/conciliacao/sync-extrato";

describe("parseValor", () => {
  it("aceita número já tipado", () => {
    expect(parseValor(1234.56)).toBe(1234.56);
  });

  it("converte valor em formato brasileiro", () => {
    expect(parseValor("1.234,56")).toBe(1234.56);
  });

  it("aceita valor negativo, que indica débito", () => {
    expect(parseValor("-49,90")).toBe(-49.9);
  });

  it("rejeita o texto fictício do sandbox em vez de virar NaN", () => {
    expect(parseValor("ut velit incididunt ullamco")).toBeNull();
  });

  it("rejeita valor ausente", () => {
    expect(parseValor(undefined)).toBeNull();
    expect(parseValor("")).toBeNull();
  });
});

describe("competenciasDaJanela", () => {
  it("usa só o mês corrente quando a janela de 3 dias não cruza o mês", () => {
    expect(competenciasDaJanela(new Date("2026-09-11T12:00:00"))).toEqual([{ mes: 9, ano: 2026 }]);
  });

  it("inclui o mês anterior quando a janela cruza a virada", () => {
    expect(competenciasDaJanela(new Date("2026-09-02T12:00:00"))).toEqual([
      { mes: 8, ano: 2026 },
      { mes: 9, ano: 2026 },
    ]);
  });

  it("trata a virada de ano", () => {
    expect(competenciasDaJanela(new Date("2026-01-02T12:00:00"))).toEqual([
      { mes: 12, ano: 2025 },
      { mes: 1, ano: 2026 },
    ]);
  });
});

describe("extrairEndToEndId", () => {
  const e2e = "E12345678202609111230abcdefghijk";

  it("encontra o end-to-end id no texto complementar", () => {
    expect(extrairEndToEndId({ descInfComplementar: `PIX RECEBIDO ${e2e}` })).toBe(e2e);
  });

  it("encontra também na descrição", () => {
    expect(extrairEndToEndId({ descricao: `TRANSF ${e2e}` })).toBe(e2e);
  });

  it("devolve null quando o movimento não é Pix", () => {
    expect(extrairEndToEndId({ descricao: "TARIFA MENSAL", descInfComplementar: "cesta basica" })).toBeNull();
  });
});

describe("idTransacao", () => {
  it("usa numeroDocumento quando o Sicoob manda", () => {
    expect(idTransacao({ numeroDocumento: "123456" }, "conta-1", "2026-09-05", 0)).toBe("123456");
  });

  it("sem numeroDocumento, gera hash estável para o mesmo item", () => {
    const item = { data: "2026-09-05", tipo: "debito", valor: "150,00", descricao: "TARIFA" };
    const a = idTransacao(item, "conta-1", "2026-09-05", 0);
    const b = idTransacao(item, "conta-1", "2026-09-05", 0);
    expect(a).toBe(b);
    expect(a).toMatch(/^sha:[0-9a-f]{32}$/);
  });

  it("separa contas diferentes com o mesmo movimento", () => {
    const item = { descricao: "TARIFA", valor: "150,00", tipo: "debito" };
    expect(idTransacao(item, "conta-1", "2026-09-05", 0)).not.toBe(
      idTransacao(item, "conta-2", "2026-09-05", 0),
    );
  });
});

describe("mapearLote", () => {
  it("dois débitos idênticos no mesmo dia geram DUAS linhas", () => {
    // O fallback antigo era data-descricao-valor: as duas linhas recebiam a
    // mesma chave e o unique (conta_id, id_transacao) descartava a segunda.
    const itens = [
      { data: "05/09/2026", tipo: "debito", valor: "150,00", descricao: "TARIFA PACOTE" },
      { data: "05/09/2026", tipo: "debito", valor: "150,00", descricao: "TARIFA PACOTE" },
    ];
    const rows = mapearLote(itens, "conta-1", "escola-1");
    expect(rows).toHaveLength(2);
    expect(rows[0].id_transacao).not.toBe(rows[1].id_transacao);
  });

  it("o ordinal conta só entre itens idênticos, não a posição na resposta", () => {
    // Item novo no meio do mês não pode deslocar a chave dos seguintes, senão
    // o extrato inteiro reimporta como movimento novo.
    const tarifa = { data: "05/09/2026", tipo: "debito", valor: "150,00", descricao: "TARIFA" };
    const outro = { data: "06/09/2026", tipo: "credito", valor: "900,00", descricao: "TED" };

    const semNovo = mapearLote([tarifa, tarifa], "conta-1", "escola-1");
    const comNovo = mapearLote([tarifa, outro, tarifa], "conta-1", "escola-1");

    expect(comNovo.map((r) => r.id_transacao)).toContain(semNovo[0].id_transacao);
    expect(comNovo.map((r) => r.id_transacao)).toContain(semNovo[1].id_transacao);
  });

  it("descarta item sem valor numérico, como o sandbox devolve", () => {
    const rows = mapearLote(
      [{ data: "05/09/2026", valor: "texto", descricao: "FICTICIO" }, { data: "05/09/2026", valor: 10, descricao: "REAL" }],
      "conta-1",
      "escola-1",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].descricao).toBe("REAL");
  });

  it("preserva numeroDocumento quando existe", () => {
    const rows = mapearLote(
      [{ data: "05/09/2026", valor: 10, descricao: "X", numeroDocumento: "999" }],
      "conta-1",
      "escola-1",
    );
    expect(rows[0].id_transacao).toBe("999");
  });
});

describe("parseValor no formato que produção devolve", () => {
  it("lê o ponto como separador decimal quando não há vírgula", () => {
    // O Sicoob manda "120779.92". Removendo o ponto vinha 12077992 — o valor
    // em centavos, cem vezes maior, gravado no extrato sem erro nenhum.
    expect(parseValor("120779.92")).toBe(120779.92);
    expect(parseValor("48303.61")).toBe(48303.61);
  });

  it("continua lendo o formato brasileiro, onde o ponto é milhar", () => {
    expect(parseValor("1.234,56")).toBe(1234.56);
    expect(parseValor("120.779,92")).toBe(120779.92);
  });

  it("lê valor sem separador nenhum", () => {
    expect(parseValor("1234")).toBe(1234);
  });
});

describe("idTransacao com transactionId", () => {
  it("prefere transactionId, que é único por transação", () => {
    const item = { transactionId: "abc123", numeroDocumento: "000", valor: 10 };
    expect(idTransacao(item, "conta-1", "2026-08-05", 0)).toBe("abc123");
  });

  it("não deixa numeroDocumento repetido colapsar duas transações distintas", () => {
    // Medido em produção: 87 transações compartilhavam 23 numeroDocumento.
    // Com numeroDocumento como chave, o unique (conta_id, id_transacao)
    // descartava 64 movimentos no upsert — sem erro nenhum.
    const a = { transactionId: "tx-1", numeroDocumento: "0", valor: 10 };
    const b = { transactionId: "tx-2", numeroDocumento: "0", valor: 20 };
    expect(idTransacao(a, "conta-1", "2026-08-05", 0)).not.toBe(
      idTransacao(b, "conta-1", "2026-08-05", 0),
    );
  });

  it("cai em numeroDocumento quando não há transactionId", () => {
    const item = { numeroDocumento: "999", valor: 10 };
    expect(idTransacao(item, "conta-1", "2026-08-05", 0)).toBe("999");
  });
});

describe("mapearLote sem chave duplicada", () => {
  it("não produz id_transacao repetido num lote real, que derrubava o upsert", () => {
    // ON CONFLICT DO UPDATE command cannot affect row a second time (21000):
    // o Postgres recusa o lote inteiro quando duas linhas do mesmo comando
    // trazem a mesma chave.
    const itens = [
      { transactionId: "tx-1", numeroDocumento: "0", data: "05/08/2026", valor: "10,00", descricao: "A" },
      { transactionId: "tx-2", numeroDocumento: "0", data: "05/08/2026", valor: "20,00", descricao: "B" },
      { transactionId: "tx-3", numeroDocumento: "0", data: "06/08/2026", valor: "30,00", descricao: "C" },
    ];
    const rows = mapearLote(itens, "conta-1", "escola-1");
    const chaves = rows.map((r) => r.id_transacao);
    expect(new Set(chaves).size).toBe(rows.length);
  });
});

describe("extrairTransacoes", () => {
  it("lê transações do envelope resultado, que é o que produção devolve", () => {
    const resposta = { resultado: { transacoes: [{ valor: "10,00" }, { valor: "20,00" }] } };
    expect(extrairTransacoes(resposta)).toHaveLength(2);
  });

  it("lê transações da raiz, que é o que o sandbox devolve", () => {
    const resposta = { transacoes: [{ valor: "10,00" }] };
    expect(extrairTransacoes(resposta)).toHaveLength(1);
  });

  it("devolve lista vazia quando não há transações em lugar nenhum", () => {
    expect(extrairTransacoes({})).toEqual([]);
    expect(extrairTransacoes(null)).toEqual([]);
  });

  it("ignora transacoes que não é array, em vez de quebrar", () => {
    expect(extrairTransacoes({ transacoes: "nenhuma" })).toEqual([]);
    expect(extrairTransacoes({ resultado: { transacoes: null } })).toEqual([]);
  });
});
