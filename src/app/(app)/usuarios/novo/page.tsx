import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { createUserAction } from "@/lib/actions/users";
import { listRoles } from "@/lib/data/permissoes";

export const dynamic = "force-dynamic";

export default async function NovoUsuarioPage({ searchParams }: { searchParams: { erro?: string } }) {
  const session = await requirePermission("usuarios", "create");
  const roles = await listRoles(session.profile.escola_id);

  return (
    <section className="ds-section max-w-lg">
      <header className="mb-6">
        <p className="ds-kicker">Administracao</p>
        <h1 className="font-serif text-3xl text-ink">Novo usuario</h1>
        <p className="mt-2 text-sm text-muted">Senha aleatoria sera gerada e exibida apos criar.</p>
      </header>

      {searchParams.erro ? (
        <div className="mb-4 flex items-center gap-2 rounded-ui bg-clay/10 p-3 text-sm font-bold text-clay">
          <AlertCircle size={16} />
          {searchParams.erro === "campos"
            ? "Informe nome e email."
            : searchParams.erro === "auth"
              ? "Falha ao criar usuario no Supabase."
              : searchParams.erro === "perfil"
                ? "Falha ao criar perfil."
                : "Falha desconhecida."}
        </div>
      ) : null}

      <form action={createUserAction} className="grid gap-4">
        <label>
          Nome
          <input name="nome" type="text" required />
        </label>
        <label>
          Email
          <input name="email" type="email" required />
        </label>
        <label>
          Perfil
          <select name="perfil" defaultValue="admin" required>
            {roles.map((r) => (
              <option key={r.codigo} value={r.codigo}>
                {r.codigo === "admin" ? "Administrador" : r.nome}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-3">
          <button className="ds-button ds-button-primary">Criar</button>
          <Link href="/usuarios" className="ds-button ds-button-secondary">Cancelar</Link>
        </div>
      </form>
    </section>
  );
}
