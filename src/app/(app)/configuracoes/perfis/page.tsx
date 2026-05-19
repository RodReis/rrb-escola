import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { listRoles } from "@/lib/data/permissoes";
import { deleteRoleAction } from "@/lib/actions/roles";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { DataTableShell } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";

export const dynamic = "force-dynamic";

const ERRO_LABEL: Record<string, string> = {
  notfound: "Role não encontrada.",
  sistema: "Roles de sistema não podem ser excluídas.",
  emuso: "Esta role está em uso por usuários. Mude o perfil dos usuários antes de excluir.",
};

export default async function PerfisPage({
  searchParams,
}: {
  searchParams: Promise<{ excluido?: string; erro?: string }>;
}) {
  const session = await requirePermission("configuracoes.perfis", "read");
  const sp = await searchParams;
  const roles = await listRoles(session.profile.escola_id);

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "Configurações" }, { label: "Perfis e Permissões" }]}
        title="Perfis e Permissões"
        counter={roles.length.toLocaleString("pt-BR")}
        description="Gerencie roles de acesso e a matriz de permissões de cada perfil."
        actions={
          <ButtonLink href="/configuracoes/perfis/nova" variant="primary">
            <Plus size={14} /> Nova role
          </ButtonLink>
        }
      />

      {sp.excluido && (
        <div className="rounded-ui bg-success/10 p-4 text-sm font-semibold text-success">
          Role excluída.
        </div>
      )}
      {sp.erro && (
        <div className="rounded-ui bg-danger/10 p-4 text-sm font-semibold text-danger">
          {ERRO_LABEL[sp.erro] ?? `Falha: ${decodeURIComponent(sp.erro)}`}
        </div>
      )}

      <DataTableShell>
        <table className="ds-dt min-w-[720px]">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nome</th>
              <th>Tipo</th>
              <th>Usuários</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.codigo}>
                <td className="font-mono text-xs text-ink/70">{r.codigo}</td>
                <td className="font-semibold text-ink">{r.nome}</td>
                <td>
                  <StatusPill tone={r.sistema ? "success" : "neutral"}>
                    {r.sistema ? "Sistema" : "Custom"}
                  </StatusPill>
                </td>
                <td className="text-ink/75">{r.usuarios}</td>
                <td className="text-right">
                  <div className="inline-flex items-center gap-2">
                    <Link
                      href={`/configuracoes/perfis/${r.codigo}`}
                      className="text-xs font-semibold text-brand hover:underline"
                    >
                      Editar permissões
                    </Link>
                    {!r.sistema && (
                      <form action={deleteRoleAction} className="inline">
                        <input type="hidden" name="codigo" value={r.codigo} />
                        <button className="text-xs font-semibold text-danger hover:underline">
                          Excluir
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </div>
  );
}
