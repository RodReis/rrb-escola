import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { createRoleAction } from "@/lib/actions/roles";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const ERRO_LABEL: Record<string, string> = {
  campos: "Preencha código e nome.",
  codigo: "Código deve começar com letra minúscula e conter apenas letras, números, _ ou -.",
};

export default async function NovaRolePage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  await requirePermission("configuracoes.perfis", "create");
  const sp = await searchParams;

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[
          { label: "Configurações" },
          { label: "Perfis e Permissões" },
          { label: "Nova role" },
        ]}
        title="Nova role custom"
        description="Crie um novo perfil de acesso. Após criar, configure a matriz de permissões."
      />

      {sp.erro && (
        <div className="flex items-center gap-2 rounded-ui bg-danger/10 p-4 text-sm font-semibold text-danger">
          <AlertCircle size={16} />
          {ERRO_LABEL[sp.erro] ?? `Falha: ${decodeURIComponent(sp.erro)}`}
        </div>
      )}

      <Panel>
        <form action={createRoleAction} className="grid gap-4 max-w-2xl">
          <label>
            <span className="text-xs font-semibold text-ink/55">Código</span>
            <input
              name="codigo"
              required
              pattern="[a-z][a-z0-9_-]*"
              placeholder="ex: coordenador"
              className="font-mono"
            />
            <p className="mt-1 text-xs text-ink/55">
              Letras minúsculas, números, _ ou -. Começa com letra.
            </p>
          </label>
          <label>
            <span className="text-xs font-semibold text-ink/55">Nome</span>
            <input name="nome" required placeholder="ex: Coordenador Pedagógico" />
          </label>
          <label>
            <span className="text-xs font-semibold text-ink/55">Descrição (opcional)</span>
            <input name="descricao" />
          </label>
          <div className="flex gap-2 justify-end">
            <Link href="/configuracoes/perfis" className="ds-button ds-button-secondary">
              Cancelar
            </Link>
            <button className="ds-button ds-button-primary">Criar role</button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
