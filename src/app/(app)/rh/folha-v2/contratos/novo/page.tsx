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

      <Panel className="p-6">
        <form action={createContratoAction} className="grid gap-5 max-w-2xl">
          <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
            Funcionário
            <select name="funcionario_id" required>
              <option value="">Selecione…</option>
              {funcionarios.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-4">
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
                  <option key={p.id} value={p.id}>{p.codigo} — {p.nome}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
              Salário base (R$)
              <input name="salario_base" type="number" step="0.01" min="0" placeholder="Deixe em branco se hora-aula" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
              Valor hora-aula (R$)
              <input name="valor_hora_aula" type="number" step="0.01" min="0" placeholder="Deixe em branco se salário" />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
              Aulas semanais
              <input name="aulas_semanais" type="number" min="1" step="1" placeholder="Obrigatório se hora-aula" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
              Dependentes IRRF
              <input name="dependentes_irrf" type="number" min="0" step="1" defaultValue="0" />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-4">
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

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
              Cargo
              <input name="cargo" type="text" maxLength={100} placeholder="Ex.: Professor de Matemática" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
              CBO
              <input name="cbo" type="text" maxLength={20} placeholder="Ex.: 2312-05" />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
            Data de admissão
            <input name="data_admissao" type="date" required className="w-48" />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
              Janela de férias (ex.: J1)
              <input name="janela_ferias" type="text" maxLength={20} placeholder="Opcional" />
            </label>
            <div className="flex flex-col gap-3 pt-5">
              <label className="flex items-center gap-2 text-sm font-medium text-ink/80 cursor-pointer">
                <input type="checkbox" name="antecipa_13_com_ferias" /> Antecipar 13º com férias
              </label>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-ink/80 cursor-pointer">
            <input type="checkbox" name="ativo" defaultChecked /> Contrato ativo
          </label>

          <div className="flex gap-3">
            <Button type="submit" variant="primary">Salvar e adicionar verbas</Button>
            <a href="/rh/folha-v2/contratos" className="ds-button ds-button-secondary">Cancelar</a>
          </div>
        </form>
      </Panel>
    </div>
  );
}
