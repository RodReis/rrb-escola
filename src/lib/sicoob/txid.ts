const TXID_PREFIX = "rrb";

export function gerarTxidOrigem(origemTipo: string, origemId: string): string {
  const normalized = `${origemTipo}${origemId}`.replace(/[^a-zA-Z0-9]/g, "");
  const txid = `${TXID_PREFIX}${normalized}`.slice(0, 35);
  if (txid.length < 26) {
    throw new Error("origem não gera txid válido");
  }
  return txid;
}

export function gerarTxidCobranca(cobrancaId: string): string {
  return gerarTxidOrigem("cobranca", cobrancaId);
}
