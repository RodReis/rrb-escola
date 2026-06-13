import Link from "next/link";
import { FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { DataTableShell } from "@/components/ui/data-table";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { getRuns } from "@/lib/data/folha";
import { gerarFolhaManualAction } from "@/lib/actions/folha";
import { gerarRunEspecialAction } from "@/lib/actions/folha-especiais";
import { money } from "@/lib/constants";
import { createServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { ExcluirFolhaButton } from "@/components/folha/run-acoes";
import { GerarFolhaButton } from "@/components/folha/gerar-folha-button";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  iniciada:    "Iniciada",
  em_andamento: "Em andamento",
  revisao:     "Revisão",
  aprovacao:   "Aprovação",
  aprovado:    "Aprovado",
};

const STATUS_TONE: Record<string, StatusTone> = {
  iniciada:    "warning",
  em_andamento: "neutral",
  revisao:     "neutral",
  aprovacao:   "neutral",
  aprovado:    "success",
};

function mesLabel(competencia: string) {
  const [y, m] = competencia.split("-");
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${meses[Number(m) - 1]} ${y}`;
}

const TIPO_LABEL: Record<string, string> = {
  decimo_1a: "13º 1ª",
  decimo_2a: "13º 2ª",
  ferias: "Férias",
};

const TIPO_TONE: Record<string, StatusTone> = {
  decimo_1a: "neutral",
  decimo_2a: "neutral",
  ferias: "warning",
};

export default async function FolhaV2Page({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  await requirePermission("rh.folha-v2", "read");
  const { erro, ok } = await searchParams;

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

      {erro ? (
        <div className="flex items-center gap-2 rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">
          <AlertCircle size={16} /> {erro}
        </div>
      ) : null}
      {ok ? (
        <div className="flex items-center gap-2 rounded-ui bg-success/10 p-3 text-sm font-semibold text-success">
          <CheckCircle2 size={16} /> {ok === "gerada" ? "Folha gerada com sucesso." : "Folha especial gerada com sucesso."}
        </div>
      ) : null}

      <Card>
        <div className="mb-4 text-xs font-bold uppercase tracking-kicker text-ink/55">
          Gerar folha manualmente
        </div>
        <form action={gerarFolhaManualAction} className="flex flex-wrap items-end gap-3">
          <label className="flex w-full flex-col gap-1 text-sm font-medium text-ink/80 sm:w-64">
            Empresa
            <select name="company_id" required>
              <option value="">Selecione…</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="flex w-full flex-col gap-1 text-sm font-medium text-ink/80 sm:w-48">
            Competência
            <input name="competencia" type="month" defaultValue={competenciaAtual} required />
          </label>
          <GerarFolhaButton label="Gerar folha" />
        </form>

        <div className="mt-6 border-t border-line pt-5">
          <div className="mb-3 text-xs font-bold uppercase tracking-kicker text-ink/55">
            Gerar 13º / Férias
          </div>
          <form action={gerarRunEspecialAction} className="flex flex-wrap items-end gap-3">
            <label className="flex w-full flex-col gap-1 text-sm font-medium text-ink/80 sm:w-56">
              Empresa
              <select name="company_id" required>
                <option value="">Selecione…</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="flex w-full flex-col gap-1 text-sm font-medium text-ink/80 sm:w-44">
              Competência
              <input name="competencia" type="month" defaultValue={competenciaAtual} required />
            </label>
            <label className="flex w-full flex-col gap-1 text-sm font-medium text-ink/80 sm:w-40">
              Tipo
              <select name="tipo" required>
                <option value="decimo_1a">13º 1ª parcela</option>
                <option value="decimo_2a">13º 2ª parcela</option>
                <option value="ferias">Férias</option>
              </select>
            </label>
            <label className="flex w-full flex-col gap-1 text-sm font-medium text-ink/80 sm:w-36">
              Janela (férias, opcional)
              <input name="janela" type="text" placeholder="Ex.: J1" />
            </label>
            <GerarFolhaButton label="Gerar 13º / Férias" pendingLabel="Gerando…" variant="accent" />
          </form>
        </div>
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
        <table className="ds-dt min-w-[900px]">
          <thead>
            <tr>
              <th>Competência</th>
              <th>Empresa</th>
              <th>Tipo</th>
              <th>Status</th>
              <th className="text-right">Proventos</th>
              <th className="text-right">Líquido</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12">
                  <div className="flex flex-col items-center justify-center gap-2 text-ink/40">
                    <FileText size={28} />
                    <p className="text-sm">Nenhuma folha gerada ainda.</p>
                  </div>
                </td>
              </tr>
            ) : null}
            {runs.map((r) => {
              const company = r.companies as { name: string } | null;
              const tipoRaw = (r as { tipo?: string }).tipo;
              const tipoLabel = tipoRaw ? TIPO_LABEL[tipoRaw] : null;
              const tipoTone = tipoRaw ? (TIPO_TONE[tipoRaw] ?? "neutral") : null;
              return (
                <tr key={r.id}>
                  <td className="font-medium tabular-nums">{mesLabel(r.competencia)}</td>
                  <td className="text-ink/80">{company?.name ?? "—"}</td>
                  <td>
                    {tipoLabel ? (
                      <StatusPill tone={tipoTone ?? "neutral"}>{tipoLabel}</StatusPill>
                    ) : (
                      <span className="text-xs text-ink/40">Mensal</span>
                    )}
                  </td>
                  <td>
                    <StatusPill tone={STATUS_TONE[r.status] ?? "neutral"}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </StatusPill>
                  </td>
                  <td className="text-right tabular-nums">{money.format(Number(r.total_proventos ?? 0))}</td>
                  <td className="text-right tabular-nums">{money.format(Number(r.total_liquido ?? 0))}</td>
                  <td className="text-right">
                    <div className="inline-flex items-center gap-3 justify-end">
                      <Link
                        href={`/rh/folha-v2/${r.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                      >
                        Abrir
                      </Link>
                      {r.status === "iniciada" && (
                        <ExcluirFolhaButton runId={r.id} />
                      )}
                    </div>
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
