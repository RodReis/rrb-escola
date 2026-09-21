import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, Panel } from "@/components/ui/card";
import { getContrato, getPerfis, getRubricas } from "@/lib/data/folha";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { EditarContratoForm } from "@/components/rh/folha-v2/editar-contrato-form";
import { VerbasContratuais } from "@/components/rh/folha-v2/verbas-contratuais";

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
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("rh.folha-v2", "update");
  const { id } = await params;

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
    antecipa_13_com_ferias: boolean;
    janela_ferias: string | null;
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

      <Panel className="p-6">
        <p className="mb-4 text-xs font-bold uppercase tracking-kicker text-ink/60">Dados do contrato</p>
        <EditarContratoForm c={c} perfis={perfis} companies={companies} />
      </Panel>

      <Card>
        <p className="mb-4 text-xs font-bold uppercase tracking-kicker text-ink/60">
          Verbas contratuais
        </p>
        <p className="mb-4 text-sm text-ink/60">
          Valores ou percentuais fixos calculados como parte deste contrato (ex.: salário dobrado, adicional de função).
        </p>
        <VerbasContratuais contratoId={c.id} verbas={verbas} rubricas={rubricas} />
      </Card>
    </div>
  );
}
