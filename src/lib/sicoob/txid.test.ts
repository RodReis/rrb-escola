import { describe, expect, it } from "vitest";
import { gerarTxidCobranca } from "@/lib/sicoob/txid";

describe("gerarTxidCobranca", () => {
  it("gera txid determinístico compatível com Pix", () => {
    const txid = gerarTxidCobranca("16805633-c525-496f-b4e7-489c64eff3a5");

    expect(txid).toBe("rrbcobranca16805633c525496fb4e7489c");
    expect(txid).toMatch(/^[a-zA-Z0-9]{26,35}$/);
  });
});
