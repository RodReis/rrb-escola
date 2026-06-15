import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { updateUserAction } from "@/lib/actions/users";
import { listRoles } from "@/lib/data/permissoes";

export const dynamic = "force-dynamic";

export default async function EditarUsuarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const session = await requirePermission("usuarios", "update");
  const { id } = await params;
  const sp = await searchParams;

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

      {sp.erro && (
        <div className="mb-4 flex items-center gap-2 rounded-ui bg-danger/10 p-3 text-sm font-bold text-danger">
          <AlertCircle size={16} />
          {decodeURIComponent(sp.erro)}
        </div>
      )}

      <form action={updateUserAction} className="grid gap-4">
        <input type="hidden" name="perfilId" value={perfil.id} />
        <label>
          Nome
          <input name="nome" type="text" defaultValue={perfil.nome} required />
        </label>
        <label>
          Email (somente leitura)
          <input type="email" value={perfil.email} readOnly disabled />
        </label>
        <label>
          Perfil
          <select name="perfil" defaultValue={perfil.perfil} required>
            {roles.map((r) => (
              <option key={r.codigo} value={r.codigo}>
                {r.codigo === "admin" ? "Administrador" : r.nome}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-3">
          <button className="ds-button ds-button-primary">Salvar</button>
          <Link href="/usuarios" className="ds-button ds-button-secondary">Cancelar</Link>
        </div>
      </form>
    </section>
  );
}
