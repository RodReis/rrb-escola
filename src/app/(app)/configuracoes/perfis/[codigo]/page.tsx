import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { getRole, getRolePermissoes, permissoesToMap } from "@/lib/data/permissoes";
import { updateRoleAction, updateRolePermissionsAction } from "@/lib/actions/roles";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { PermissionsMatrix } from "@/components/perfis/permissions-matrix";
import { MODULO_CODIGOS, type Acao, type ModuloCodigo } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

const ERRO_LABEL: Record<string, string> = {
  campos: "Preencha todos os campos.",
  adminreadonly: "Permissões da role admin não podem ser editadas (sempre full).",
};

export default async function EditarPerfilPage({
  params,
  searchParams,
}: {
  params: Promise<{ codigo: string }>;
  searchParams: Promise<{ salvo?: string; atualizado?: string; erro?: string }>;
}) {
  await requirePermission("configuracoes.perfis", "update");
  const { codigo } = await params;
  const sp = await searchParams;

  const role = await getRole(codigo);
  if (!role) notFound();

  const permsList = await getRolePermissoes(codigo);
  const initialMatrix = permissoesToMap(permsList);

  const isAdmin = codigo === "admin";
  let displayMatrix: Record<ModuloCodigo, Record<Acao, boolean>> = initialMatrix;
  if (isAdmin) {
    displayMatrix = {} as Record<ModuloCodigo, Record<Acao, boolean>>;
    for (const m of MODULO_CODIGOS) {
      displayMatrix[m] = { read: true, create: true, update: true, delete: true };
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[
          { label: "Configurações" },
          { label: "Perfis e Permissões", href: "/configuracoes/perfis" },
          { label: role.nome },
        ]}
        title={`Editar perfil: ${role.nome}`}
        description={role.sistema ? "Role de sistema. Código não editável." : "Role custom."}
      />

      {sp.salvo && (
        <div className="rounded-ui bg-success/10 p-4 text-sm font-semibold text-success">
          Permissões salvas.
        </div>
      )}
      {sp.atualizado && (
        <div className="rounded-ui bg-success/10 p-4 text-sm font-semibold text-success">
          Dados atualizados.
        </div>
      )}
      {sp.erro && (
        <div className="rounded-ui bg-danger/10 p-4 text-sm font-semibold text-danger">
          {ERRO_LABEL[sp.erro] ?? `Falha: ${decodeURIComponent(sp.erro)}`}
        </div>
      )}

      <Panel>
        <form action={updateRoleAction} className="grid gap-3 md:grid-cols-[200px_1fr_auto] items-end">
          <input type="hidden" name="codigo" value={role.codigo} />
          <label>
            <span className="text-xs font-semibold text-ink/55">Código</span>
            <input value={role.codigo} disabled className="font-mono" />
          </label>
          <label>
            <span className="text-xs font-semibold text-ink/55">Nome</span>
            <input name="nome" defaultValue={role.nome} required />
          </label>
          <button className="ds-button ds-button-secondary">Atualizar dados</button>
          <label className="md:col-span-3">
            <span className="text-xs font-semibold text-ink/55">Descrição</span>
            <input name="descricao" defaultValue={role.descricao ?? ""} />
          </label>
        </form>
      </Panel>

      <form action={updateRolePermissionsAction} className="grid gap-4">
        <input type="hidden" name="codigo" value={role.codigo} />
        {isAdmin && (
          <div className="rounded-ui bg-muted p-4 text-sm font-semibold text-ink/75">
            Admin sempre tem acesso total. Esta matriz é apenas informativa.
          </div>
        )}
        <PermissionsMatrix initial={displayMatrix} disabled={isAdmin} />
        {!isAdmin && (
          <div className="flex justify-end">
            <button className="ds-button ds-button-primary">Salvar permissões</button>
          </div>
        )}
      </form>
    </div>
  );
}
