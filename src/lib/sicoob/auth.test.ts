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
});
