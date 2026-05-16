import { Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { deactivateUserAction } from "@/lib/actions/users";
import { readUserCreatedFlash } from "@/lib/actions/user-flash";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { DataTableShell } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";

export const dynamic = "force-dynamic";

export default async function UsuariosPage({ searchParams }: { searchParams: { criado?: string; desativado?: string; erro?: string } }) {
  await requireAdmin();
  const supabase = await createServerClient();
  const { data: perfis } = await supabase
    .from("perfis")
    .select("id, nome, email, perfil, ativo, created_at")
    .order("created_at", { ascending: false });

  const flash = searchParams.criado ? readUserCreatedFlash() : null;
  const rows = perfis ?? [];
  const ativos = rows.filter((p) => p.ativo).length;

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Administração" }, { label: "Usuários" }]}
        title="Usuários"
        counter={rows.length.toLocaleString("pt-BR")}
        description="Gerencie acesso, perfis e status dos usuários do sistema."
        actions={
          <ButtonLink href="/usuarios/novo" variant="primary">
            <Plus size={14} /> Novo usuário
          </ButtonLink>
        }
        kpis={[
          { label: "Total",    value: rows.length.toLocaleString("pt-BR") },
          { label: "Ativos",   value: ativos.toLocaleString("pt-BR"), tone: "success" },
          { label: "Inativos", value: (rows.length - ativos).toLocaleString("pt-BR"), tone: "danger" }
        ]}
      />

      {flash ? (
        <div className="rounded-ui bg-success/10 p-4 text-sm font-semibold text-success">
          Usuário {flash.email} criado. Senha inicial: <code className="font-mono">{flash.password}</code>
          <p className="mt-1 text-xs font-medium text-ink/55">Anote agora — esta mensagem não será exibida novamente.</p>
        </div>
      ) : null}
      {searchParams.desativado ? (
        <div className="rounded-ui bg-success/10 p-4 text-sm font-semibold text-success">Usuário desativado.</div>
      ) : null}
      {searchParams.erro ? (
        <div className="rounded-ui bg-danger/10 p-4 text-sm font-semibold text-danger">
          {searchParams.erro === "self" ? "Você não pode desativar a própria conta." : `Falha: ${searchParams.erro}`}
        </div>
      ) : null}

      <DataTableShell>
        <table className="ds-dt min-w-[720px]">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Email</th>
              <th>Perfil</th>
              <th>Status</th>
              <th className="text-right"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="font-semibold text-ink">{p.nome}</td>
                <td className="text-ink/75">{p.email}</td>
                <td className="text-ink/75">{p.perfil}</td>
                <td>
                  <StatusPill tone={p.ativo ? "success" : "danger"}>
                    {p.ativo ? "Ativo" : "Inativo"}
                  </StatusPill>
                </td>
                <td className="text-right">
                  {p.ativo ? (
                    <form action={deactivateUserAction} className="inline">
                      <input type="hidden" name="perfilId" value={p.id} />
                      <button className="text-xs font-semibold text-danger hover:underline">Desativar</button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </div>
  );
}
