import { AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createContratoAction } from "@/lib/actions/folha-cadastros";
import { getEmployeesWithoutContract, getPerfis } from "@/lib/data/folha";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NovoContratoPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  await requirePermission("rh.folha-v2", "create");
  const { erro } = await searchParams;

  const supabase = await createServerClient();
  const [funcionarios, perfisRaw, companiesRes] = await Promise.all([
    getEmployeesWithoutContract(),
    getPerfis(),
    supabase.from("companies").select("id, name").order("name"),
  ]);
  const perfis = perfisRaw as unknown as { id: string; codigo: string; nome: string }[];
  const companies = companiesRes.data ?? [];

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "RH", href: "/rh/funcionarios" },
          { label: "Folha v2", href: "/rh/folha-v2" },
          { label: "Contratos", href: "/rh/folha-v2/contratos" },
          { label: "Novo" },
        ]}
        title="Novo contrato"
        description="Vincule um funcionário a um perfil de cálculo da folha v2."
      />

      {erro ? (
        <div className="flex items-center gap-2 rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">
          <AlertCircle size={16} /> {erro}
        </div>
      ) : null}

      <Panel className="p-6 lg:p-8">
        <form action={createContratoAction} className="grid gap-8">
          <section className="grid gap-4">
            <h2 className="text-xs font-bold uppercase tracking-kicker text-ink/55">Vínculo</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
                Funcionário
                <select name="funcionario_id" required>
                  <option value="">Selecione…</option>
                  {funcionarios.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
                Empresa
                <select name="company_id" required>
                  <option value="">Selecione…</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
                Perfil de cálculo
                <select name="perfil_calculo_id" required>
                  <option value="">Selecione…</option>
                  {perfis.map((p) => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="grid gap-4">
            <h2 className="text-xs font-bold uppercase tracking-kicker text-ink/55">Remuneração</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
                Salário base (R$)
                <input name="salario_base" type="number" step="0.01" min="0" placeholder="Se mensalista" />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
                Valor hora-aula (R$)
                <input name="valor_hora_aula" type="number" step="0.01" min="0" placeholder="Se horista" />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
                Aulas semanais
                <input name="aulas_semanais" type="number" min="1" step="1" placeholder="Se hora-aula" />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
                Dependentes IRRF
                <input name="dependentes_irrf" type="number" min="0" step="1" defaultValue="0" />
              </label>
            </div>
            <p className="text-xs text-ink/45">Preencha salário base (mensalista) <strong>ou</strong> valor hora-aula + aulas semanais (horista).</p>
          </section>

          <section className="grid gap-4">
            <h2 className="text-xs font-bold uppercase tracking-kicker text-ink/55">Aulas por turno (opcional)</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
                Aulas manhã
                <input name="aulas_manha" type="number" min="0" step="1" placeholder="—" />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
                Aulas tarde
                <input name="aulas_tarde" type="number" min="0" step="1" placeholder="—" />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
                Aulas noite
                <input name="aulas_noite" type="number" min="0" step="1" placeholder="—" />
              </label>
            </div>
          </section>

          <section className="grid gap-4">
            <h2 className="text-xs font-bold uppercase tracking-kicker text-ink/55">Dados do contrato</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
                Cargo
                <input name="cargo" type="text" maxLength={100} placeholder="Ex.: Professor de Matemática" />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
                CBO
                <input name="cbo" type="text" maxLength={20} placeholder="Ex.: 2312-05" />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
                Data de admissão
                <input name="data_admissao" type="date" required />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
                Janela de férias
                <input name="janela_ferias" type="text" maxLength={20} placeholder="Ex.: J1 (opcional)" />
              </label>
            </div>
          </section>

          <section className="grid gap-3">
            <h2 className="text-xs font-bold uppercase tracking-kicker text-ink/55">Opções</h2>
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-ink/80">
                <input type="checkbox" name="antecipa_13_com_ferias" className="h-4 w-4 shrink-0 accent-brand" />
                Antecipar 13º com férias
              </label>
              <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-ink/80">
                <input type="checkbox" name="ativo" defaultChecked className="h-4 w-4 shrink-0 accent-brand" />
                Contrato ativo
              </label>
            </div>
          </section>

          <div className="flex gap-3 border-t border-line pt-6">
            <Button type="submit" variant="primary">Salvar e adicionar verbas</Button>
            <a href="/rh/folha-v2/contratos" className="ds-button ds-button-secondary">Cancelar</a>
          </div>
        </form>
      </Panel>
    </div>
  );
}
