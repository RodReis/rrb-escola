import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => supabaseMock,
}));

vi.mock("@/lib/sicoob/pix", () => ({
  consultarPixRecebido: vi.fn(async (e2e: string) => {
    if (e2e === "desconhecido") return { ok: true, data: { txid: "tx-desconhecido", valor: "10.00", horario: "2026-09-11T10:00:00Z" } };
    return { ok: true, data: { txid: "tx-1", valor: "10.00", horario: "2026-09-11T10:00:00Z" } };
  }),
}));

const supabaseMock = {
  from: vi.fn((table: string) => {
    if (table === "webhooks_recebidos") {
      return {
        insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: "w1" }, error: null })) })) })),
        update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      };
    }
    if (table === "pix_cobranca") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn((_field: string, value: string) => ({
            maybeSingle: vi.fn(async () => ({
              data: value === "tx-desconhecido" ? null : { id: "pix1" },
              error: null,
            })),
          })),
        })),
      };
    }
    return {};
  }),
  rpc: vi.fn(async () => ({ data: "p1", error: null })),
};

describe("processarWebhookPixSicoob", () => {
  beforeEach(() => {
    supabaseMock.rpc.mockClear();
    supabaseMock.from.mockClear();
  });

  it("processa múltiplos Pix válidos", async () => {
    const { processarWebhookPixSicoob } = await import("@/lib/sicoob/webhook");

    const result = await processarWebhookPixSicoob({
      pix: [{ endToEndId: "e1" }, { endToEndId: "e2" }],
    });

    expect(result).toEqual({ ok: true, processados: 2, ignorados: 0 });
    expect(supabaseMock.rpc).toHaveBeenCalledTimes(2);
    expect(supabaseMock.rpc).toHaveBeenCalledWith("registrar_pix_recebido", expect.objectContaining({
      p_txid: "tx-1",
    }));
  });

  it("ignora Pix com txid desconhecido", async () => {
    const { processarWebhookPixSicoob } = await import("@/lib/sicoob/webhook");

    const result = await processarWebhookPixSicoob({
      pix: [{ endToEndId: "desconhecido" }],
    });

    expect(result).toEqual({ ok: true, processados: 0, ignorados: 1 });
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });
});
