import { RefreshCcw, ArrowLeft, Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { retryGuardianNotificationAction } from "@/lib/actions/gate";
import { getGateNotifications } from "@/lib/data/gate";
import { requirePermission } from "@/lib/auth/session";

const filters = [
  { href: "/portaria/notificacoes", label: "Todas", value: "" },
  { href: "/portaria/notificacoes?status=erro", label: "Erros", value: "erro" },
  { href: "/portaria/notificacoes?status=pendente", label: "Pendentes", value: "pendente" },
  { href: "/portaria/notificacoes?status=enviada", label: "Enviadas", value: "enviada" },
  { href: "/portaria/notificacoes?status=simulada", label: "Simuladas", value: "simulada" }
];

function statusTone(status: string): "green" | "red" | "gold" | "gray" {
  if (status === "enviada") return "green";
  if (status === "erro") return "red";
  if (status === "pendente") return "gold";
  return "gray";
}

export default async function GateNotificationsPage({ searchParams }: { searchParams: { status?: string } }) {
  await requirePermission("portaria", "read");
  const selectedStatus = searchParams.status ?? "";
  const notifications = await getGateNotifications(selectedStatus);

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line bg-paper px-6 py-7">
        <div>
          <p className="ds-kicker">Portaria</p>
          <h1 className="mt-7 font-serif text-4xl text-ink">Notificações</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted">
            Acompanhe mensagens enviadas, pendentes, simuladas e tentativas com erro.
          </p>
        </div>
        <ButtonLink href="/portaria" variant="secondary">
          <ArrowLeft size={14} /> Voltar para portaria
        </ButtonLink>
      </header>

      <nav className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <ButtonLink key={filter.href} href={filter.href} variant={selectedStatus === filter.value ? "primary" : "secondary"}>
            {filter.label}
          </ButtonLink>
        ))}
      </nav>

      <section className="overflow-hidden rounded-panel border border-line bg-surface shadow-soft">
        <div className="grid grid-cols-[1.3fr_0.7fr_0.8fr_0.8fr] border-b border-line bg-muted px-4 py-3 text-xs font-bold uppercase text-muted max-lg:hidden">
          <span>Aluno e mensagem</span>
          <span>Destino</span>
          <span>Status</span>
          <span>Envio</span>
        </div>

        <div className="grid bg-paper/70">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-ink/40">
              <Bell size={28} />
              <p className="text-sm font-medium">Nenhuma notificação encontrada.</p>
            </div>
          ) : null}
          {notifications.map((notification) => (
            <div key={notification.id} className="grid gap-3 border-b border-line px-4 py-4 last:border-b-0 lg:grid-cols-[1.3fr_0.7fr_0.8fr_0.8fr]">
              <div>
                <strong>{notification.alunos?.nome ?? "Aluno não localizado"}</strong>
                <span className="block text-sm text-muted">{notification.alunos?.matricula_codigo}</span>
                <p className="mt-2 text-sm">{notification.mensagem}</p>
                {notification.erro ? <p className="mt-2 text-sm font-bold text-clay">{notification.erro}</p> : null}
              </div>
              <div className="text-sm">
                <span className="block font-bold">{notification.canal}</span>
                <span className="text-muted">{notification.telefone_destino || "Sem telefone"}</span>
              </div>
              <div>
                <Badge tone={statusTone(notification.status)}>{notification.status}</Badge>
                {notification.provider_message_id ? <p className="mt-2 text-xs text-muted">{notification.provider_message_id}</p> : null}
              </div>
              <div className="flex flex-wrap items-start gap-2">
                <span className="text-sm text-muted">{new Date(notification.created_at).toLocaleString("pt-BR")}</span>
                {notification.status === "erro" || notification.status === "pendente" ? (
                  <form action={retryGuardianNotificationAction}>
                    <input type="hidden" name="notificacao_id" value={notification.id} />
                    <Button className="px-3 py-2 text-xs" variant="secondary">
                      <RefreshCcw size={14} />
                      Reenviar
                    </Button>
                  </form>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
