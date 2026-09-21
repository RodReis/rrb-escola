import Link from "next/link";
import { Plus, Pencil, Trash2, CheckCircle2, AlertCircle, Shield } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { listRoles } from "@/lib/data/permissoes";
import { deleteRoleAction } from "@/lib/actions/roles";
import { ButtonLink } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
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
        <div className="flex items-center gap-2 rounded-ui bg-success/10 p-4 text-sm font-semibold text-success">
          <CheckCircle2 size={16} /> Role excluída.
        </div>
      )}
      {sp.erro && (
        <div className="flex items-center gap-2 rounded-ui bg-danger/10 p-4 text-sm font-semibold text-danger">
          <AlertCircle size={16} />
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
            {roles.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12">
                  <div className="flex flex-col items-center justify-center gap-2 text-ink/60">
                    <Shield size={28} />
                    <p className="text-sm">Nenhuma role cadastrada.</p>
                  </div>
                </td>
              </tr>
            )}
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
                      title="Editar permissoes"
                      aria-label="Editar permissoes"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-ui text-brand hover:bg-brand/10"
                    >
                      <Pencil size={14} />
                    </Link>
                    {!r.sistema && (
                      <form action={deleteRoleAction} className="inline">
                        <input type="hidden" name="codigo" value={r.codigo} />
                        <ConfirmButton
                          message={`Tem certeza que quer excluir o perfil "${r.nome}"? Esta operação não pode ser desfeita.`}
                          title="Excluir role"
                          aria-label="Excluir role"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-ui text-danger hover:bg-danger/10"
                        >
                          <Trash2 size={14} />
                        </ConfirmButton>
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
