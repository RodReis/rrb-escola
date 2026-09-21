import { requirePermission } from "@/lib/auth/session";
import { listRoles } from "@/lib/data/permissoes";
import { NovoUsuarioForm } from "@/components/usuarios/novo-usuario-form";

export const dynamic = "force-dynamic";

export default async function NovoUsuarioPage() {
  const session = await requirePermission("usuarios", "create");
  const roles = await listRoles(session.profile.escola_id);

  return (
    <section className="ds-section max-w-lg">
      <header className="mb-6">
        <p className="ds-kicker">Administracao</p>
        <h1 className="font-display text-3xl text-ink">Novo usuario</h1>
        <p className="mt-2 text-sm text-muted">Senha aleatoria sera gerada e exibida apos criar.</p>
      </header>

      <NovoUsuarioForm roles={roles} />
    </section>
  );
}
