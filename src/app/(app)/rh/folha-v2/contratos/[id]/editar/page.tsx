import { notFound } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTableShell } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";
import {
  updateContratoAction,
  createVerbaAction,
  deleteVerbaAction,
} from "@/lib/actions/folha-cadastros";
import { getContrato, getPerfis, getRubricas } from "@/lib/data/folha";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { money } from "@/lib/constants";

export const dynamic = "force-dynamic";

type VerbaRow = {
  id: string;
  valor: number | null;
  percentual: number | null;
  ativa: boolean;
  folha_rubricas: { id: string; codigo: string; nome: string } | null;
};

export default async function EditarContratoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  await requirePermission("rh.folha-v2", "update");
  const { id } = await params;
  const { erro } = await searchParams;

  const supabase = await createServerClient();
  const [contratoRaw, perfisRaw, rubricasRaw, companiesRes] = await Promise.all([
    getContrato(id).catch(() => null),
    getPerfis(),
    getRubricas(),
    supabase.from("companies").select("id, name").order("name"),
  ]);

  if (!contratoRaw) notFound();

  type AulasPorTurno = { manha?: number | null; tarde?: number | null; noite?: number | null } | null;

  type ContratoFull = {
    id: string;
    salario_base: number | null;
    valor_hora_aula: number | null;
    aulas_semanais: number | null;
    dependentes_irrf: number;
    data_admissao: string;
    data_desligamento: string | null;
    ativo: boolean;
    cargo: string | null;
    cbo: string | null;
    aulas_por_turno: AulasPorTurno;
    employees: { id: string; name: string } | null;
    companies: { id: string; name: string } | null;
    folha_perfis_calculo: { id: string; codigo: string; nome: string } | null;
    folha_contratos_rubricas: VerbaRow[];
  };

  const c = contratoRaw as unknown as ContratoFull;
  const perfis = perfisRaw as unknown as { id: string; codigo: string; nome: string }[];
  const rubricas = rubricasRaw as unknown as { id: string; codigo: string; nome: string; ativa: boolean }[];
  const companies = companiesRes.data ?? [];
  const verbas = c.folha_contratos_rubricas;

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "RH", href: "/rh/funcionarios" },
          { label: "Folha v2", href: "/rh/folha-v2" },
          { label: "Contratos", href: "/rh/folha-v2/contratos" },
          { label: c.employees?.name ?? id },
        ]}
        title={`Contrato — ${c.employees?.name ?? "—"}`}
        description={`${c.companies?.name ?? "—"} · ${c.folha_perfis_calculo?.nome ?? "—"}`}
      />

      {erro ? (
        <div className="flex items-center gap-2 rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">
          <AlertCircle size={16} /> {erro}
        </div>
      ) : null}

      <Panel className="p-6">
        <p className="mb-4 text-xs font-bold uppercase tracking-kicker text-ink/55">Dados do contrato</p>
        <form action={updateContratoAction} className="grid gap-5 max-w-2xl">
          <input type="hidden" name="id" value={c.id} />
          <input type="hidden" name="funcionario_id" value={c.employees?.id ?? ""} />

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
              Empresa
              <select name="company_id" required defaultValue={c.companies?.id ?? ""}>
                <option value="">Selecione…</option>
                {companies.map((co) => (
                  <option key={co.id} value={co.id}>{co.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
              Perfil de cálculo
              <select name="perfil_calculo_id" required defaultValue={c.folha_perfis_calculo?.id ?? ""}>
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
              <input
                name="salario_base"
                type="number"
                step="0.01"
                min="0"
                defaultValue={c.salario_base ?? ""}
                placeholder="Deixe em branco se hora-aula"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
              Valor hora-aula (R$)
              <input
                name="valor_hora_aula"
                type="number"
                step="0.01"
                min="0"
                defaultValue={c.valor_hora_aula ?? ""}
                placeholder="Deixe em branco se salário"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
              Aulas semanais
              <input
                name="aulas_semanais"
                type="number"
                min="1"
                step="1"
                defaultValue={c.aulas_semanais ?? ""}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
              Dependentes IRRF
              <input name="dependentes_irrf" type="number" min="0" step="1" defaultValue={c.dependentes_irrf} />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
              Aulas manhã
              <input name="aulas_manha" type="number" min="0" step="1" defaultValue={c.aulas_por_turno?.manha ?? ""} placeholder="—" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
              Aulas tarde
              <input name="aulas_tarde" type="number" min="0" step="1" defaultValue={c.aulas_por_turno?.tarde ?? ""} placeholder="—" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
              Aulas noite
              <input name="aulas_noite" type="number" min="0" step="1" defaultValue={c.aulas_por_turno?.noite ?? ""} placeholder="—" />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
              Cargo
              <input name="cargo" type="text" maxLength={100} defaultValue={c.cargo ?? ""} placeholder="Ex.: Professor de Matemática" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
              CBO
              <input name="cbo" type="text" maxLength={20} defaultValue={c.cbo ?? ""} placeholder="Ex.: 2312-05" />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
              Data de admissão
              <input name="data_admissao" type="date" required defaultValue={c.data_admissao} className="w-48" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
              Data de desligamento
              <input name="data_desligamento" type="date" defaultValue={c.data_desligamento ?? ""} className="w-48" />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-ink/80 cursor-pointer">
            <input type="checkbox" name="ativo" defaultChecked={c.ativo} /> Contrato ativo
          </label>

          <div className="flex gap-3">
            <Button type="submit" variant="primary">Salvar</Button>
            <a href="/rh/folha-v2/contratos" className="ds-button ds-button-secondary">Voltar</a>
          </div>
        </form>
      </Panel>

      <Card>
        <p className="mb-4 text-xs font-bold uppercase tracking-kicker text-ink/55">
          Verbas contratuais
        </p>
        <p className="mb-4 text-sm text-ink/60">
          Valores ou percentuais fixos calculados como parte deste contrato (ex.: salário dobrado, adicional de função).
        </p>

        <DataTableShell>
          <table className="ds-dt min-w-[580px]">
            <thead>
              <tr>
                <th>Rubrica</th>
                <th className="text-right">Valor (R$)</th>
                <th className="text-right">Percentual (%)</th>
                <th>Status</th>
                <th className="text-right">Remover</th>
              </tr>
            </thead>
            <tbody>
              {verbas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-sm text-ink/40">
                    Nenhuma verba contratual.
                  </td>
                </tr>
              ) : null}
              {verbas.map((v) => (
                <tr key={v.id}>
                  <td className="font-medium">
                    {v.folha_rubricas
                      ? `${v.folha_rubricas.codigo} — ${v.folha_rubricas.nome}`
                      : "—"}
                  </td>
                  <td className="text-right tabular-nums">
                    {v.valor != null ? money.format(Number(v.valor)) : "—"}
                  </td>
                  <td className="text-right tabular-nums">
                    {v.percentual != null ? `${Number(v.percentual).toFixed(2)}%` : "—"}
                  </td>
                  <td>
                    <StatusPill tone={v.ativa ? "success" : "neutral"}>
                      {v.ativa ? "Ativa" : "Inativa"}
                    </StatusPill>
                  </td>
                  <td className="text-right">
                    <form action={deleteVerbaAction} className="inline">
                      <input type="hidden" name="id" value={v.id} />
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

        <form action={createVerbaAction} className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="contrato_id" value={c.id} />
          <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
            Rubrica
            <select name="rubrica_id" required className="min-w-[220px]">
              <option value="">Selecione…</option>
              {rubricas.filter((r) => r.ativa).map((r) => (
                <option key={r.id} value={r.id}>{r.codigo} — {r.nome}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
            Valor (R$)
            <input name="valor" type="number" step="0.01" min="0" placeholder="Ou use percentual" className="w-32" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
            Percentual (%)
            <input name="percentual" type="number" step="0.0001" min="0" placeholder="Ou use valor" className="w-28" />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-ink/80 cursor-pointer mt-5">
            <input type="checkbox" name="ativa" defaultChecked /> Ativa
          </label>
          <Button type="submit" variant="secondary" className="mt-5">Adicionar verba</Button>
        </form>
      </Card>
    </div>
  );
}
