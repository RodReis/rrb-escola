import "server-only";
import type { OrigemRecebimento } from "@/lib/pagamentos/provider";

export type OrigemResolvida = {
  origemTipo: OrigemRecebimento;
  origemId: string | null;
  valor: number;
  descricao: string;
  devedorNome?: string | null;
  devedorDoc?: string | null;
};

export function validarOrigemPix(input: OrigemResolvida): { ok: true } | { ok: false; reason: string } {
  if (!input.valor || input.valor <= 0) return { ok: false, reason: "Valor do Pix inválido" };
  if (!input.descricao.trim()) return { ok: false, reason: "Descrição do Pix ausente" };
  if (input.origemTipo !== "avulso" && !input.origemId) {
    return { ok: false, reason: "Origem vinculada precisa de origemId" };
  }
  return { ok: true };
}
