import { AlertCircle, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { DataTableShell } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { getPerfis, getRubricas } from "@/lib/data/folha";
import {
  createPerfilAction,
  updatePerfilAction,
  deletePerfilAction,
  addRubricaAoPerfilAction,
  removeRubricaDoPerfilAction,
} from "@/lib/actions/folha-cadastros";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type PerfilRubrica = {
  id: string;
  ordem_execucao: number;
  automatica: boolean;
  folha_rubricas: { id: string; codigo: string; nome: string } | null;
};

type Perfil = {
  id: string;
  codigo: string;
  nome: string;
  ativo: boolean;
  folha_perfis_rubricas: PerfilRubrica[];
};

type Rubrica = { id: string; codigo: string; nome: string };

export default async function PerfisPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  await requirePermission("rh.folha-v2", "read");
  const { erro } = await searchParams;
  const [perfisRaw, rubricasRaw] = await Promise.all([getPerfis(), getRubricas()]);
  const perfis = perfisRaw as unknown as Perfil[];
  const rubricas = rubricasRaw as unknown as Rubrica[];

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "RH", href: "/rh/funcionarios" },
          { label: "Folha v2", href: "/rh/folha-v2" },
          { label: "Perfis de Cálculo" },
        ]}
        title="Perfis de Cálculo"
        counter={perfis.length.toLocaleString("pt-BR")}
        description="Agrupamentos de rubricas aplicados por funcionário/contrato."
      />

      {erro ? (
        <div className="flex items-center gap-2 rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">
          <AlertCircle size={16} /> {erro}
        </div>
      ) : null}

      <Card>
        <p className="mb-4 text-xs font-bold uppercase tracking-kicker text-ink/55">Novo perfil</p>
        <form action={createPerfilAction} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
            Código <input name="codigo" required maxLength={20} placeholder="CLT_PROF" className="w-36" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
            Nome <input name="nome" required maxLength={100} placeholder="CLT Professor" className="w-56" />
          </label>
          <Button type="submit" variant="primary">Criar</Button>
        </form>
      </Card>

      {perfis.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-panel border border-line bg-surface py-14 text-ink/40">
          <Users size={28} />
          <p className="text-sm">Nenhum perfil cadastrado.</p>
        </div>
      ) : null}

      {perfis.map((perfil) => (
        <Card key={perfil.id}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-semibold text-brand">{perfil.codigo}</span>
              <span className="font-semibold text-ink">{perfil.nome}</span>
              <StatusPill tone={perfil.ativo ? "success" : "neutral"}>
                {perfil.ativo ? "Ativo" : "Inativo"}
              </StatusPill>
            </div>
            <div className="flex gap-2">
              <form action={updatePerfilAction} className="flex items-center gap-2">
                <input type="hidden" name="id" value={perfil.id} />
                <input name="codigo" type="hidden" value={perfil.codigo} />
                <input name="nome" type="hidden" value={perfil.nome} />
                <input type="hidden" name="ativo" value={perfil.ativo ? "" : "on"} />
                <Button type="submit" variant="secondary" className="text-xs h-7 px-2">
                  {perfil.ativo ? "Desativar" : "Ativar"}
                </Button>
              </form>
              <form action={deletePerfilAction}>
                <input type="hidden" name="id" value={perfil.id} />
                <Button type="submit" variant="secondary" className="text-xs h-7 px-2 text-danger border-danger/30 hover:bg-danger/10">
                  Excluir
                </Button>
              </form>
            </div>
          </div>

          <DataTableShell>
            <table className="ds-dt min-w-[600px]">
              <thead>
                <tr>
                  <th>Rubrica</th>
                  <th className="text-center">Automática</th>
                  <th className="text-right">Ordem exec.</th>
                  <th className="text-right">Remover</th>
                </tr>
              </thead>
              <tbody>
                {perfil.folha_perfis_rubricas.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-sm text-ink/40">
                      Nenhuma rubrica vinculada.
                    </td>
                  </tr>
                ) : null}
                {perfil.folha_perfis_rubricas
                  .sort((a, b) => a.ordem_execucao - b.ordem_execucao)
                  .map((pr) => (
                    <tr key={pr.id}>
                      <td className="font-medium">
                        {pr.folha_rubricas
                          ? `${pr.folha_rubricas.codigo} — ${pr.folha_rubricas.nome}`
                          : "—"}
                      </td>
                      <td className="text-center text-sm">{pr.automatica ? "✓" : "—"}</td>
                      <td className="text-right tabular-nums text-sm">{pr.ordem_execucao}</td>
                      <td className="text-right">
                        <form action={removeRubricaDoPerfilAction} className="inline">
                          <input type="hidden" name="id" value={pr.id} />
                          <button type="submit" className="text-xs font-semibold text-danger hover:underline">
                            Remover
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </DataTableShell>

          <form action={addRubricaAoPerfilAction} className="mt-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="perfil_id" value={perfil.id} />
            <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
              Rubrica
              <select name="rubrica_id" required className="min-w-[220px]">
                <option value="">Selecione…</option>
                {rubricas.map((r) => (
                  <option key={r.id} value={r.id}>{r.codigo} — {r.nome}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
              Ordem exec.
              <input name="ordem_execucao" type="number" min="1" defaultValue="100" className="w-20" />
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-ink/80 cursor-pointer mt-5">
              <input type="checkbox" name="automatica" defaultChecked /> Automática
            </label>
            <Button type="submit" variant="secondary" className="mt-5">Adicionar rubrica</Button>
          </form>
        </Card>
      ))}
    </div>
  );
}
