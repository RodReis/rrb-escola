import { afterEach, describe, expect, it, vi } from "vitest";
import { getSicoobAccessToken, resetSicoobTokenCacheForTests } from "@/lib/sicoob/auth";

const config = {
  env: "production" as const,
  clientId: "client-1",
  certPem: "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----",
  keyPem: "-----BEGIN PRIVATE KEY-----\nMIIB\n-----END PRIVATE KEY-----",
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetSicoobTokenCacheForTests();
});

describe("getSicoobAccessToken", () => {
  it("reusa token em cache dentro do TTL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "token-a", expires_in: 300 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getSicoobAccessToken(config, "cob.read")).resolves.toBe("token-a");
    await expect(getSicoobAccessToken(config, "cob.read")).resolves.toBe("token-a");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("não mistura cache de escopos diferentes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "token-read", expires_in: 300 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "token-write", expires_in: 300 }) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getSicoobAccessToken(config, "cob.read")).resolves.toBe("token-read");
    await expect(getSicoobAccessToken(config, "cob.write")).resolves.toBe("token-write");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("não mistura tokens de CNPJs diferentes no mesmo escopo", async () => {
    // O cache era um slot chaveado só por escopo: o segundo CNPJ recebia o
    // token do primeiro e consultava a conta errada, sem erro nenhum.
    const outroCnpj = { ...config, clientId: "client-2" };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "token-cnpj-1", expires_in: 300 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "token-cnpj-2", expires_in: 300 }) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getSicoobAccessToken(config, "cco_consulta")).resolves.toBe("token-cnpj-1");
    await expect(getSicoobAccessToken(outroCnpj, "cco_consulta")).resolves.toBe("token-cnpj-2");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // E cada um continua com o seu ao repetir.
    await expect(getSicoobAccessToken(config, "cco_consulta")).resolves.toBe("token-cnpj-1");
    await expect(getSicoobAccessToken(outroCnpj, "cco_consulta")).resolves.toBe("token-cnpj-2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("getSicoobDispatcher", () => {
  it("reaproveita o Agent do mesmo certificado", async () => {
    // Antes criava um Agent novo por request, abrindo um pool TLS por chamada.
    const { getSicoobDispatcher } = await import("@/lib/sicoob/auth");
    const primeiro = getSicoobDispatcher(config);
    const segundo = getSicoobDispatcher(config);
    expect(primeiro).toBe(segundo);
  });

  it("dá Agents distintos para certificados distintos", async () => {
    const { getSicoobDispatcher } = await import("@/lib/sicoob/auth");
    const outro = { ...config, certPem: "-----BEGIN CERTIFICATE-----\nOUTRO\n-----END CERTIFICATE-----" };
    expect(getSicoobDispatcher(config)).not.toBe(getSicoobDispatcher(outro));
  });

  it("sandbox não usa dispatcher", async () => {
    const { getSicoobDispatcher } = await import("@/lib/sicoob/auth");
    expect(
      getSicoobDispatcher({ env: "sandbox", clientId: "c", sandboxToken: "t" }),
    ).toBeUndefined();
  });
});
