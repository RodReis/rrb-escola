import { describe, expect, it } from "vitest";
import { mensagemErroCobranca } from "./erro-cobranca";

describe("mensagemErroCobranca", () => {
  it("nao mostra nada quando nao houve erro", () => {
    expect(mensagemErroCobranca(undefined)).toBeNull();
    expect(mensagemErroCobranca("")).toBeNull();
  });

  it("traduz todos os slugs que finance.ts emite", () => {
    // Os slugs vem dos redirect() de src/lib/actions/finance.ts. Se um novo
    // for adicionado la sem entrada aqui, o usuario ve o texto cru.
    for (const slug of ["id", "campos", "paga", "pagamento", "editar", "estornar"]) {
      const msg = mensagemErroCobranca(slug);
      expect(msg, `slug "${slug}" sem tradução`).toBeTruthy();
      // O texto de fallback expõe o slug cru; uma tradução de verdade não.
      expect(msg, `slug "${slug}" caiu no fallback`).not.toMatch(/Erro ao processar/);
    }
  });

  it("degrada para o slug cru quando e desconhecido", () => {
    expect(mensagemErroCobranca("qualquer-coisa")).toContain("qualquer-coisa");
  });
});
