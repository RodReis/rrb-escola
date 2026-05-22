import { notFound } from "next/navigation";
import {
  Megaphone,
  Layers,
  GraduationCap,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Image as ImageIcon,
} from "lucide-react";
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

const STATUS_ICON: Record<string, typeof CheckCircle2> = {
  enviada: CheckCircle2,
  falha: XCircle,
  pendente: Clock,
};

function horaCurta(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

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

  const turmas = comunicado.alvos.criterio.filter((c) => c.tipo === "turma");
  const series = comunicado.alvos.criterio.filter((c) => c.tipo === "serie");

  function alcanceLabel(): string {
    if (comunicado.alcance === "geral") return "Geral";
    if (comunicado.alcance === "individual") return "Individual";
    return "Segmentado";
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

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* ── Mensagem ── */}
        <Panel className="grid gap-4 self-start">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-ui bg-brand/10 text-brand">
              <Megaphone size={18} />
            </span>
            <div>
              <h2 className="font-bold text-ink">Mensagem enviada</h2>
              <p className="text-xs text-ink/55">Conteúdo entregue aos responsáveis.</p>
            </div>
          </div>

          <div className="rounded-ui border border-line bg-muted/20 p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/85">
              {comunicado.mensagem}
            </p>
          </div>

          {comunicado.imagemPath && (
            <p className="flex items-center gap-1.5 text-xs text-ink/55">
              <ImageIcon size={13} /> Comunicado com imagem anexada.
            </p>
          )}
        </Panel>

        {/* ── Segmentação ── */}
        <Panel className="grid gap-3 self-start">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-ui bg-brand/10 text-brand">
              <Users size={18} />
            </span>
            <div>
              <h2 className="font-bold text-ink">Segmentação</h2>
              <p className="text-xs text-ink/55">Critério usado para selecionar.</p>
            </div>
          </div>

          {comunicado.alcance === "geral" && (
            <p className="rounded-ui bg-muted/20 px-3 py-2.5 text-sm text-ink/70">
              Enviado para <strong className="text-ink">todos</strong> os responsáveis da escola.
            </p>
          )}

          {comunicado.alcance === "individual" && (
            <p className="rounded-ui bg-muted/20 px-3 py-2.5 text-sm text-ink/70">
              Comunicado <strong className="text-ink">individual</strong>.
            </p>
          )}

          {comunicado.alcance === "segmentado" && (
            <div className="grid gap-2.5">
              {series.length > 0 && (
                <div className="grid gap-1.5">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-ink/60">
                    <Layers size={12} className="text-brand" /> Séries
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {series.map((s) => (
                      <span
                        key={s.id}
                        className="rounded-pill bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand"
                      >
                        {s.nome}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {turmas.length > 0 && (
                <div className="grid gap-1.5">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-ink/60">
                    <GraduationCap size={12} className="text-brand" /> Turmas
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {turmas.map((t) => (
                      <span
                        key={t.id}
                        className="rounded-pill bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand"
                      >
                        {t.nome}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {series.length === 0 && turmas.length === 0 && (
                <p className="text-sm text-ink/55">Seleção manual de alunos.</p>
              )}
              <p className="border-t border-line pt-2 text-sm text-ink/70">
                <strong className="text-ink">{comunicado.alvos.alunos.length}</strong> aluno(s)
                selecionado(s).
              </p>
            </div>
          )}
        </Panel>
      </div>

      {/* ── Destinatários ── */}
      <Panel className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold text-ink">Destinatários ({destinatarios.length})</h2>
          {destinatarios.length > 0 && (
            <span className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1 text-success">
                <CheckCircle2 size={13} /> {comunicado.totalEnviados}
              </span>
              {comunicado.totalFalhas > 0 && (
                <span className="flex items-center gap-1 text-danger">
                  <XCircle size={13} /> {comunicado.totalFalhas}
                </span>
              )}
            </span>
          )}
        </div>

        {destinatarios.length === 0 ? (
          <div className="grid place-items-center gap-2 py-10 text-center">
            <Users size={28} className="text-ink/25" />
            <p className="text-sm font-semibold text-ink/55">Nenhum destinatário</p>
            <p className="max-w-sm text-xs text-ink/45">
              Nenhum responsável financeiro com WhatsApp foi encontrado para os alunos
              selecionados.
            </p>
          </div>
        ) : (
          <ul className="grid gap-1.5">
            {destinatarios.map((d) => {
              const Icon = STATUS_ICON[d.status] ?? Clock;
              return (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 rounded-ui border border-line p-3 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={
                        d.status === "enviada"
                          ? "text-success"
                          : d.status === "falha"
                            ? "text-danger"
                            : "text-ink/35"
                      }
                    >
                      <Icon size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">
                        {d.alunoNome ?? "Aluno"}
                      </p>
                      <p className="font-mono text-xs text-ink/55">{d.telefone}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {d.erro && <span className="text-xs text-danger">{d.erro}</span>}
                    <StatusPill
                      tone={STATUS_TONE[d.status] ?? "neutral"}
                      {...(d.enviadaEm ? { sub: horaCurta(d.enviadaEm) } : {})}
                    >
                      {STATUS_LABEL[d.status] ?? d.status}
                    </StatusPill>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
