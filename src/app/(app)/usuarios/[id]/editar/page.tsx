import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { listRoles } from "@/lib/data/permissoes";
import { EditarUsuarioForm } from "@/components/usuarios/editar-usuario-form";

export const dynamic = "force-dynamic";

export default async function EditarUsuarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission("usuarios", "update");
  const { id } = await params;

  const supabase = await createServerClient();
  const { data: perfil } = await supabase
    .from("perfis")
    .select("id, nome, email, perfil, ativo")
    .eq("id", id)
    .maybeSingle();

  if (!perfil) notFound();

  const roles = await listRoles(session.profile.escola_id);

  return (
    <section className="ds-section max-w-lg">
      <header className="mb-6">
        <p className="ds-kicker">Administração</p>
        <h1 className="font-display text-3xl text-ink">Editar usuário</h1>
        <p className="mt-2 text-sm text-muted">{perfil.email}</p>
      </header>

      <EditarUsuarioForm perfil={perfil} roles={roles} />
    </section>
  );
}
