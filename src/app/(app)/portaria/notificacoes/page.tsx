import { ArrowLeft, Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { getGateNotifications } from "@/lib/data/gate";
import { requirePermission } from "@/lib/auth/session";

const filters = [
  { href: "/portaria/notificacoes", label: "Todas", value: "" },
  { href: "/portaria/notificacoes?status=falha", label: "Falhas", value: "falha" },
  { href: "/portaria/notificacoes?status=pendente", label: "Pendentes", value: "pendente" },
  { href: "/portaria/notificacoes?status=enviada", label: "Enviadas", value: "enviada" },
];

function statusTone(status: string): "green" | "red" | "gold" | "gray" {
  if (status === "enviada") return "green";
  if (status === "falha") return "red";
  if (status === "pendente") return "gold";
  return "gray";
}

type AlunoRel = { nome: string | null; matricula_codigo: string | null } | { nome: string | null; matricula_codigo: string | null }[] | null;

export default async function GateNotificationsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  await requirePermission("portaria", "read");
  const selectedStatus = searchParams.status ?? "";
  const notifications = await getGateNotifications(selectedStatus);

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line bg-paper px-6 py-7">
        <div>
          <p className="ds-kicker">Portaria</p>
          <h1 className="mt-7 font-display text-4xl text-ink">Notificações</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted">
            Mensagens de entrada e saída enviadas aos responsáveis via WhatsApp.
          </p>
        </div>
        <ButtonLink href="/portaria" variant="secondary">
          <ArrowLeft size={14} /> Voltar para portaria
        </ButtonLink>
      </header>

      <nav className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <ButtonLink
            key={filter.href}
            href={filter.href}
            variant={selectedStatus === filter.value ? "primary" : "secondary"}
          >
            {filter.label}
          </ButtonLink>
        ))}
      </nav>

      <section className="overflow-hidden rounded-panel border border-line bg-surface shadow-soft">
        <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr] border-b border-line bg-muted px-4 py-3 text-xs font-bold uppercase text-muted max-lg:hidden">
          <span>Aluno e mensagem</span>
          <span>Destino</span>
          <span>Status</span>
          <span>Envio</span>
        </div>

        <div className="grid bg-paper/70">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-ink/60">
              <Bell size={28} />
              <p className="text-sm font-medium">Nenhuma notificação encontrada.</p>
            </div>
          ) : null}
          {notifications.map((notification) => {
            const alunoRaw = (notification.alunos as AlunoRel) ?? null;
            const aluno = Array.isArray(alunoRaw) ? alunoRaw[0] ?? null : alunoRaw;
            return (
              <div
                key={notification.id}
                className="grid gap-3 border-b border-line px-4 py-4 last:border-b-0 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr]"
              >
                <div>
                  <strong>{aluno?.nome ?? "Aluno não localizado"}</strong>
                  <span className="block text-sm text-muted">{aluno?.matricula_codigo}</span>
                  <p className="mt-2 text-sm">{notification.mensagem}</p>
                  {notification.erro ? (
                    <p className="mt-2 text-sm font-bold text-clay">{notification.erro}</p>
                  ) : null}
                </div>
                <div className="text-sm">
                  <span className="block font-bold">WhatsApp</span>
                  <span className="text-muted">{notification.telefone || "Sem telefone"}</span>
                </div>
                <div>
                  <Badge tone={statusTone(notification.status)}>{notification.status}</Badge>
                  {notification.provider_message_id ? (
                    <p className="mt-2 text-xs text-muted">{notification.provider_message_id}</p>
                  ) : null}
                </div>
                <div className="text-sm text-muted">
                  {new Date(notification.created_at).toLocaleString("pt-BR")}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
