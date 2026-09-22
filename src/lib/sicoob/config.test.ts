import { afterEach, describe, expect, it, vi } from "vitest";
import { readSicoobConfig } from "@/lib/sicoob/config";

const b64 = (texto: string) => Buffer.from(texto, "utf8").toString("base64");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("readSicoobConfig — credencial por conta", () => {
  it("sem ref, lê as variáveis globais (compatível com quem tem um CNPJ só)", () => {
    vi.stubEnv("SICOOB_CLIENT_ID", "client-global");
    vi.stubEnv("SICOOB_CERT_PEM_B64", b64("CERT-GLOBAL"));
    vi.stubEnv("SICOOB_KEY_PEM_B64", b64("KEY-GLOBAL"));

    const config = readSicoobConfig("production");
    expect(config).toMatchObject({ env: "production", clientId: "client-global" });
    expect(config && "certPem" in config && config.certPem).toBe("CERT-GLOBAL");
  });

  it("com ref, lê SICOOB_<REF>_* e ignora as globais", () => {
    vi.stubEnv("SICOOB_CLIENT_ID", "client-global");
    vi.stubEnv("SICOOB_CERT_PEM_B64", b64("CERT-GLOBAL"));
    vi.stubEnv("SICOOB_KEY_PEM_B64", b64("KEY-GLOBAL"));
    vi.stubEnv("SICOOB_PINGUINHO_CLIENT_ID", "client-pinguinho");
    vi.stubEnv("SICOOB_PINGUINHO_CERT_PEM_B64", b64("CERT-PINGUINHO"));
    vi.stubEnv("SICOOB_PINGUINHO_KEY_PEM_B64", b64("KEY-PINGUINHO"));

    const config = readSicoobConfig("production", "PINGUINHO");
    expect(config).toMatchObject({ clientId: "client-pinguinho" });
    expect(config && "certPem" in config && config.certPem).toBe("CERT-PINGUINHO");
  });

  it("dois CNPJs devolvem credenciais distintas", () => {
    vi.stubEnv("SICOOB_INTEGRADO_CLIENT_ID", "client-integrado");
    vi.stubEnv("SICOOB_INTEGRADO_CERT_PEM_B64", b64("CERT-INTEGRADO"));
    vi.stubEnv("SICOOB_INTEGRADO_KEY_PEM_B64", b64("KEY-INTEGRADO"));
    vi.stubEnv("SICOOB_PINGUINHO_CLIENT_ID", "client-pinguinho");
    vi.stubEnv("SICOOB_PINGUINHO_CERT_PEM_B64", b64("CERT-PINGUINHO"));
    vi.stubEnv("SICOOB_PINGUINHO_KEY_PEM_B64", b64("KEY-PINGUINHO"));

    const a = readSicoobConfig("production", "INTEGRADO");
    const b = readSicoobConfig("production", "PINGUINHO");
    expect(a?.clientId).toBe("client-integrado");
    expect(b?.clientId).toBe("client-pinguinho");
  });

  it("ref sem variáveis devolve null em vez de cair na credencial global", () => {
    // Cair na global seria pior que falhar: consultaria a conta do outro CNPJ.
    vi.stubEnv("SICOOB_CLIENT_ID", "client-global");
    vi.stubEnv("SICOOB_CERT_PEM_B64", b64("CERT-GLOBAL"));
    vi.stubEnv("SICOOB_KEY_PEM_B64", b64("KEY-GLOBAL"));

    expect(readSicoobConfig("production", "INEXISTENTE")).toBeNull();
  });

  it("certificado faltando devolve null mesmo com client id presente", () => {
    vi.stubEnv("SICOOB_PARCIAL_CLIENT_ID", "client-parcial");
    expect(readSicoobConfig("production", "PARCIAL")).toBeNull();
  });
});
