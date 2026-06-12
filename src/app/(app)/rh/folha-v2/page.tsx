import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { DataTableShell } from "@/components/ui/data-table";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { getRuns } from "@/lib/data/folha";
import { gerarFolhaManualAction } from "@/lib/actions/folha";
import { money } from "@/lib/constants";
import { createServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  em_revisao: "Em revisão",
  aprovada: "Aprovada",
  paga: "Paga",
  fechada: "Fechada",
};

const STATUS_TONE: Record<string, StatusTone> = {
  rascunho: "warning",
  em_revisao: "neutral",
  aprovada: "neutral",
  paga: "success",
  fechada: "success",
};

function mesLabel(competencia: string) {
  const [y, m] = competencia.split("-");
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${meses[Number(m) - 1]} ${y}`;
}

export default async function FolhaV2Page() {
  await requirePermission("rh.folha-v2", "read");

  const supabase = await createServerClient();
  const [runs, companiesRes] = await Promise.all([
    getRuns(),
    supabase.from("companies").select("id, name").order("name"),
  ]);
  const companies = companiesRes.data ?? [];

  const now = new Date();
  const competenciaAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "RH", href: "/rh/funcionarios" }, { label: "Folha de Pagamento v2" }]}
        title="Folha de Pagamento v2"
        counter={runs.length.toLocaleString("pt-BR")}
        description="Folhas mensais por empresa — motor de rubricas v2."
      />

      <Card>
        <div className="mb-4 text-xs font-bold uppercase tracking-kicker text-ink/55">
          Gerar folha manualmente
        </div>
        <form action={gerarFolhaManualAction} className="flex flex-wrap items-end gap-3">
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
            Competência
            <input name="competencia" type="month" defaultValue={competenciaAtual} required />
          </label>
          <Button type="submit" variant="primary">
            <Plus size={14} /> Gerar folha
          </Button>
        </form>
      </Card>

      <DataTableShell
        footer={
          runs.length > 0 ? (
            <span>
              Mostrando <strong className="text-ink">{runs.length}</strong> folha(s)
            </span>
          ) : undefined
        }
      >
        <table className="ds-dt min-w-[820px]">
          <thead>
            <tr>
              <th>Competência</th>
              <th>Empresa</th>
              <th>Status</th>
              <th className="text-right">Proventos</th>
              <th className="text-right">Líquido</th>
              <th className="text-right">Abrir</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12">
                  <div className="flex flex-col items-center justify-center gap-2 text-ink/40">
                    <FileText size={28} />
                    <p className="text-sm">Nenhuma folha gerada ainda.</p>
                  </div>
                </td>
              </tr>
            ) : null}
            {runs.map((r) => {
              const company = r.companies as { name: string } | null;
              return (
                <tr key={r.id}>
                  <td className="font-medium tabular-nums">{mesLabel(r.competencia)}</td>
                  <td className="text-ink/80">{company?.name ?? "—"}</td>
                  <td>
                    <StatusPill tone={STATUS_TONE[r.status] ?? "neutral"}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </StatusPill>
                  </td>
                  <td className="text-right tabular-nums">{money.format(Number(r.total_proventos ?? 0))}</td>
                  <td className="text-right tabular-nums">{money.format(Number(r.total_liquido ?? 0))}</td>
                  <td className="text-right">
                    <Link
                      href={`/rh/folha-v2/${r.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                    >
                      Abrir
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
