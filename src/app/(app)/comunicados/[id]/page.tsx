import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { requirePermission } from "@/lib/auth/session";
import { getComunicado, getDestinatarios } from "@/lib/data/comunicados";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, StatusTone> = {
  enviada: "success",
  falha: "danger",
  pendente: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  enviada: "Enviada",
  falha: "Falha",
  pendente: "Pendente",
};

export default async function ComunicadoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission("comunicados", "read");
  const { id } = await params;

  const comunicadoOrNull = await getComunicado(id, session.profile.escola_id);
  if (!comunicadoOrNull) notFound();
  const comunicado = comunicadoOrNull;

  const destinatarios = await getDestinatarios(id, session.profile.escola_id);

  function alcanceLabel(): string {
    if (comunicado.alcance === "geral") return "Geral";
    if (comunicado.alcance === "individual") return "Individual";
    const nTurmas = comunicado.alvos.filter((a) => a.tipo === "turma").length;
    const nSeries = comunicado.alvos.filter((a) => a.tipo === "serie").length;
    const partes: string[] = [];
    if (nTurmas > 0) partes.push(`${nTurmas} turma(s)`);
    if (nSeries > 0) partes.push(`${nSeries} série(s)`);
    return `Segmentado · ${partes.join(", ")}`;
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[
          { label: "RH" },
          { label: "Comunicados", href: "/comunicados" },
          { label: comunicado.titulo },
        ]}
        title={comunicado.titulo}
        description={`${alcanceLabel()} · ${new Date(comunicado.createdAt).toLocaleDateString("pt-BR")}`}
        kpis={[
          { label: "Destinatários", value: comunicado.totalDestinatarios.toString() },
          { label: "Enviados", value: comunicado.totalEnviados.toString() },
          {
            label: "Falhas",
            value: comunicado.totalFalhas.toString(),
            ...(comunicado.totalFalhas > 0 ? { tone: "danger" as const } : {}),
          },
          { label: "Status", value: comunicado.status === "concluido" ? "Concluído" : "Processando" },
        ]}
      />

      <Panel className="grid gap-2">
        <h2 className="font-bold text-ink">Mensagem</h2>
        <p className="whitespace-pre-wrap text-sm text-ink/80">{comunicado.mensagem}</p>
      </Panel>

      <Panel className="grid gap-3">
        <h2 className="font-bold text-ink">Destinatários ({destinatarios.length})</h2>
        {destinatarios.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink/55">
            Nenhum destinatário — nenhum responsável financeiro com WhatsApp encontrado.
          </p>
        ) : (
          <ul className="grid gap-1.5">
            {destinatarios.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-ui border border-line p-2.5 text-sm"
              >
                <span className="font-mono text-ink/70">{d.telefone}</span>
                <div className="flex items-center gap-2">
                  {d.erro && <span className="text-xs text-danger">{d.erro}</span>}
                  <StatusPill tone={STATUS_TONE[d.status] ?? "neutral"}>
                    {STATUS_LABEL[d.status] ?? d.status}
                  </StatusPill>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
