import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export type AuthEvento =
  | "login_ok"
  | "login_falha"
  | "logout"
  | "senha_alterada"
  | "dado_excluido";

type GravarEventoInput = {
  escola_id?: string | null;
  user_id?: string | null;
  email?: string | null;
  evento: AuthEvento;
  recurso?: string | null;
  recurso_id?: string | null;
  detalhe?: string | null;
};

/**
 * Grava um evento crítico de auth/dados no log append-only (auth_evento_log).
 * Fire-and-forget: nunca lança — falha de log não pode quebrar o fluxo principal.
 */
export async function gravarEventoAuth(input: GravarEventoInput): Promise<void> {
  try {
    const h = headers();
    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
    const userAgent = h.get("user-agent") ?? null;

    const admin = createAdminClient();
    await admin.rpc("auth_gravar_evento", {
      p_escola_id: input.escola_id ?? null,
      p_user_id: input.user_id ?? null,
      p_email: input.email ?? null,
      p_evento: input.evento,
      p_recurso: input.recurso ?? null,
      p_recurso_id: input.recurso_id ?? null,
      p_detalhe: input.detalhe ?? null,
      p_ip: ip,
      p_user_agent: userAgent,
    });
  } catch {
    // Log nunca derruba o fluxo de negócio.
  }
}
