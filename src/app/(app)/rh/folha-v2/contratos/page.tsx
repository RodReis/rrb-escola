import Link from "next/link";
import { Plus, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { DataTableShell } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";
import { getContratos } from "@/lib/data/folha";
import { requirePermission } from "@/lib/auth/session";
import { money } from "@/lib/constants";
import { ExcluirContratoButton } from "@/components/folha/excluir-contrato-button";

export const dynamic = "force-dynamic";

type ContratoRow = {
  id: string;
  salario_base: number | null;
  valor_hora_aula: number | null;
  aulas_semanais: number | null;
  ativo: boolean;
  employees: { name: string } | null;
  companies: { name: string } | null;
  folha_perfis_calculo: { codigo: string; nome: string } | null;
};

export default async function ContratosPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  await requirePermission("rh.folha-v2", "read");
  const { erro, ok } = await searchParams;
  const ativos = await getContratos(true);
  const inativos = await getContratos(false);
  const todos = [...ativos, ...inativos.filter((c) => !(c as unknown as ContratoRow).ativo)];
  const rows = todos as unknown as ContratoRow[];

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "RH", href: "/rh/funcionarios" },
          { label: "Folha v2", href: "/rh/folha-v2" },
          { label: "Contratos" },
        ]}
        title="Contratos"
        counter={rows.length.toLocaleString("pt-BR")}
        description="Vínculos empregatícios com perfis de cálculo da folha v2."
        actions={
          <ButtonLink href="/rh/folha-v2/contratos/novo" variant="primary">
            <Plus size={14} /> Novo contrato
          </ButtonLink>
        }
      />

      {erro ? (
        <div className="flex items-center gap-2 rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">
          <AlertCircle size={16} /> {erro}
        </div>
      ) : null}
      {ok ? (
        <div className="flex items-center gap-2 rounded-ui bg-success/10 p-3 text-sm font-semibold text-success">
          <CheckCircle2 size={16} /> Contrato excluído com sucesso.
        </div>
      ) : null}

      <DataTableShell
        footer={
          rows.length > 0 ? (
            <span><strong className="text-ink">{rows.length}</strong> contrato(s)</span>
          ) : undefined
        }
      >
        <table className="ds-dt min-w-[820px]">
          <thead>
            <tr>
              <th>Funcionário</th>
              <th>Empresa</th>
              <th>Perfil</th>
              <th className="text-right">Salário / H-aula</th>
              <th>Status</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12">
                  <div className="flex flex-col items-center gap-2 text-ink/40">
                    <FileText size={24} />
                    <p className="text-sm">Nenhum contrato cadastrado.</p>
                  </div>
                </td>
              </tr>
            ) : null}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-medium">{r.employees?.name ?? "—"}</td>
                <td className="text-ink/70">{r.companies?.name ?? "—"}</td>
                <td className="text-sm text-ink/70">
                  {r.folha_perfis_calculo
                    ? `${r.folha_perfis_calculo.codigo} — ${r.folha_perfis_calculo.nome}`
                    : "—"}
                </td>
                <td className="text-right tabular-nums text-sm">
                  {r.salario_base != null
                    ? money.format(Number(r.salario_base))
                    : r.valor_hora_aula != null
                    ? `${money.format(Number(r.valor_hora_aula))}/h · ${r.aulas_semanais ?? 0} aulas`
                    : "—"}
                </td>
                <td>
                  <StatusPill tone={r.ativo ? "success" : "neutral"}>
                    {r.ativo ? "Ativo" : "Inativo"}
                  </StatusPill>
                </td>
                <td className="text-right">
                  <div className="inline-flex items-center gap-3 justify-end">
                    <Link
                      href={`/rh/folha-v2/contratos/${r.id}/editar`}
                      className="text-xs font-semibold text-brand hover:underline"
                    >
                      Editar
                    </Link>
                    <ExcluirContratoButton id={r.id} nome={r.employees?.name ?? "este funcionário"} />
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
