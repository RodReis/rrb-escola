import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { deactivateUserAction } from "@/lib/actions/users";
import { readUserCreatedFlash } from "@/lib/actions/user-flash";

export const dynamic = "force-dynamic";

export default async function UsuariosPage({ searchParams }: { searchParams: { criado?: string; desativado?: string; erro?: string } }) {
  await requireAdmin();
  const supabase = await createServerClient();
  const { data: perfis } = await supabase
    .from("perfis")
    .select("id, nome, email, perfil, ativo, created_at")
    .order("created_at", { ascending: false });

  const flash = searchParams.criado ? readUserCreatedFlash() : null;

  return (
    <section className="ds-section">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="ds-kicker">Administracao</p>
          <h1 className="font-serif text-3xl text-ink">Usuarios</h1>
        </div>
        <Link href="/usuarios/novo" className="ds-button ds-button-primary">Novo usuario</Link>
      </header>

      {flash ? (
        <div className="mb-4 rounded-ui bg-success/10 p-4 text-sm font-bold text-success">
          Usuario {flash.email} criado. Senha inicial: <code>{flash.password}</code>
          <p className="mt-1 text-xs font-medium text-muted">Anote agora — esta mensagem nao sera exibida novamente.</p>
        </div>
      ) : null}
      {searchParams.desativado ? (
        <div className="mb-4 rounded-ui bg-success/10 p-4 text-sm font-bold text-success">Usuario desativado.</div>
      ) : null}
      {searchParams.erro ? (
        <div className="mb-4 rounded-ui bg-clay/10 p-4 text-sm font-bold text-clay">
          {searchParams.erro === "self"
            ? "Voce nao pode desativar a propria conta."
            : `Falha: ${searchParams.erro}`}
        </div>
      ) : null}

      <table className="ds-table w-full">
        <thead>
          <tr>
            <th>Nome</th><th>Email</th><th>Perfil</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>
          {(perfis ?? []).map((p) => (
            <tr key={p.id}>
              <td>{p.nome}</td>
              <td>{p.email}</td>
              <td>{p.perfil}</td>
              <td>{p.ativo ? "Ativo" : "Inativo"}</td>
              <td>
                {p.ativo ? (
                  <form action={deactivateUserAction}>
                    <input type="hidden" name="perfilId" value={p.id} />
                    <button className="ds-button ds-button-ghost">Desativar</button>
                  </form>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
