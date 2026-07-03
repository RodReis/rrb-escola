import Link from "next/link";
import { Plus, Tag } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { DataTableShell } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";
import { getRubricas } from "@/lib/data/folha";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const TIPO_LABEL: Record<string, string> = {
  provento: "Provento",
  desconto: "Desconto",
  base: "Base",
  informativa: "Informativa",
};

const TIPO_TONE: Record<string, "success" | "danger" | "neutral" | "warning"> = {
  provento: "success",
  desconto: "danger",
  base: "neutral",
  informativa: "warning",
};

export default async function RubricasPage() {
  await requirePermission("rh.folha-v2", "read");
  const rubricas = await getRubricas();

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "RH", href: "/rh/funcionarios" },
          { label: "Folha v2", href: "/rh/folha-v2" },
          { label: "Rubricas" },
        ]}
        title="Rubricas"
        counter={rubricas.length.toLocaleString("pt-BR")}
        description="Verbas que compõem o cálculo da folha."
        actions={
          <ButtonLink href="/rh/folha-v2/rubricas/nova" variant="primary">
            <Plus size={14} /> Nova rubrica
          </ButtonLink>
        }
      />

      <DataTableShell
        footer={
          rubricas.length > 0 ? (
            <span>
              <strong className="text-ink">{rubricas.length}</strong> rubrica(s)
            </span>
          ) : undefined
        }
      >
        <table className="ds-dt min-w-[860px]">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nome</th>
              <th>Tipo</th>
              <th>Método</th>
              <th className="text-center">INSS</th>
              <th className="text-center">IRRF</th>
              <th className="text-center">FGTS</th>
              <th className="text-center">DSR</th>
              <th className="text-right">Ordem</th>
              <th>Status</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rubricas.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-12">
                  <div className="flex flex-col items-center gap-2 text-ink/60">
                    <Tag size={24} />
                    <p className="text-sm">Nenhuma rubrica cadastrada.</p>
                  </div>
                </td>
              </tr>
            ) : null}
            {rubricas.map((r) => {
              const row = r as unknown as {
                id: string; codigo: string; nome: string; tipo: string;
                metodo_calculo: string; incide_inss: boolean; incide_irrf: boolean;
                incide_fgts: boolean; incide_dsr: boolean; ordem_holerite: number; ativa: boolean;
              };
              return (
                <tr key={row.id}>
                  <td className="font-mono text-sm font-semibold">{row.codigo}</td>
                  <td className="font-medium">{row.nome}</td>
                  <td>
                    <StatusPill tone={TIPO_TONE[row.tipo] ?? "neutral"}>
                      {TIPO_LABEL[row.tipo] ?? row.tipo}
                    </StatusPill>
                  </td>
                  <td className="text-sm text-ink/70">{row.metodo_calculo}</td>
                  <td className="text-center text-sm">{row.incide_inss ? "✓" : "—"}</td>
                  <td className="text-center text-sm">{row.incide_irrf ? "✓" : "—"}</td>
                  <td className="text-center text-sm">{row.incide_fgts ? "✓" : "—"}</td>
                  <td className="text-center text-sm">{row.incide_dsr ? "✓" : "—"}</td>
                  <td className="text-right tabular-nums text-sm">{row.ordem_holerite}</td>
                  <td>
                    <StatusPill tone={row.ativa ? "success" : "neutral"}>
                      {row.ativa ? "Ativa" : "Inativa"}
                    </StatusPill>
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/rh/folha-v2/rubricas/${row.id}/editar`}
                      className="text-xs font-semibold text-brand hover:underline"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataTableShell>
    </div>
  );
}
