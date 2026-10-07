import type { ActionResult } from "./tipos";

type Resposta = { error: { code?: string; message: string } | null };

/**
 * Violação de unicidade (23505) vira resultado `{ ok: false }`, não exceção: em
 * produção o Next oculta a mensagem de erros lançados em Server Actions, e o
 * usuário veria um texto genérico em vez da mensagem amigável. Outros erros
 * (devolve null) seguem para `assertOk`.
 */
export function duplicado(resposta: Resposta, mensagem: string): ActionResult | null {
  return resposta.error?.code === "23505" ? { ok: false, error: mensagem } : null;
}
