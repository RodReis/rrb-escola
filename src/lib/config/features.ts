/**
 * Feature flags de produto.
 *
 * Desligar uma flag esconde a funcionalidade dos menus e do Acesso rápido.
 * A rota em si continua acessível por URL direta (útil para testar antes de
 * liberar) — se precisar bloquear de verdade, use o RBAC em
 * `src/lib/auth/permissions.ts`.
 *
 * Valor padrão quando a env não existe está em cada flag abaixo.
 * Só `false` (string exata) desliga; qualquer outro valor mantém o padrão.
 */

function flag(raw: string | undefined, padrao: boolean): boolean {
  if (raw === undefined || raw === "") return padrao;
  return raw !== "false";
}

export const FEATURES = {
  /** Inbox do WhatsApp. Desligado por padrão até o módulo estar pronto. */
  whatsapp: flag(process.env.NEXT_PUBLIC_FEATURE_WHATSAPP, false),
} as const;

export type FeatureName = keyof typeof FEATURES;
