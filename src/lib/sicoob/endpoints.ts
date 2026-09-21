import "server-only";

export type SicoobEnv = "sandbox" | "production";

export type SicoobEndpoints = {
  env: SicoobEnv;
  authUrl?: string;
  apiBaseUrl: string;
  pixBasePath: string;
  contaCorrenteBasePath: string;
};

export function getSicoobEnv(): SicoobEnv {
  return process.env.SICOOB_ENV === "production" ? "production" : "sandbox";
}

export function getSicoobEndpoints(env: SicoobEnv = getSicoobEnv()): SicoobEndpoints {
  if (env === "production") {
    return {
      env,
      authUrl: "https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token",
      apiBaseUrl: "https://api.sicoob.com.br",
      pixBasePath: "/pix/api/v2",
      contaCorrenteBasePath: "/conta-corrente/v4",
    };
  }

  return {
    env,
    apiBaseUrl: "https://sandbox.sicoob.com.br/sicoob/sandbox",
    pixBasePath: "/pix/api/v2",
    contaCorrenteBasePath: "/conta-corrente/v4",
  };
}
