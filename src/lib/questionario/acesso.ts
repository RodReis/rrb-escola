import { can, type Acao, type ModuloCodigo } from "@/lib/auth/permissions";
import type { Session } from "@/lib/auth/session";

/** Admin passa direto (mesma regra de requirePermission); demais conforme role_permissoes. */
export function podeAcao(session: Session, modulo: ModuloCodigo, acao: Acao): boolean {
  return session.profile.perfil === "admin" || can(session.permissions, modulo, acao);
}
