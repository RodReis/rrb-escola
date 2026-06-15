import { DoorOpen, Bell, Activity, Inbox } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { registerGateEventAction } from "@/lib/actions/gate";
import { getGateData } from "@/lib/data/gate";
import { requirePermission } from "@/lib/auth/session";

function statusTone(status: string): StatusTone {
  if (status === "enviada") return "success";
  if (status === "falha") return "danger";
  if (status === "pendente") return "warning";
  return "neutral";
}

export default async function PortariaPage() {
  await requirePermission("portaria", "read");
  const data = await getGateData();
  const defaultDevice = data.devices[0]?.id ?? "";

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Gestão", href: "/" }, { label: "Portaria" }]}
        title="Portaria"
        description="Registre entrada e saída, acompanhe eventos recentes e confira as notificações enviadas aos responsáveis."
        actions={
          <>
            <ButtonLink href="/portaria/painel" variant="primary">Painel diário</ButtonLink>
            <ButtonLink href="/portaria/camera" variant="secondary">Câmera</ButtonLink>
            <ButtonLink href="/portaria/notificacoes" variant="secondary">Notificações</ButtonLink>
            <ButtonLink href="/portaria/dispositivos" variant="secondary">Dispositivos</ButtonLink>
          </>
        }
      />

      <Panel className="grid gap-5">
        <div className="flex items-center gap-3">
          <DoorOpen className="text-moss" />
          <h2 className="font-display text-2xl text-ink">Registro manual ou facial simulado</h2>
        </div>
        <form action={registerGateEventAction} className="grid gap-4 md:grid-cols-5">
          <label className="md:col-span-2">
            Aluno
            <select name="aluno_id" required>
              {data.students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.matricula_codigo} - {student.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Dispositivo
            <select name="dispositivo_id" defaultValue={defaultDevice}>
              {data.devices.map((device) => (
                <option key={device.id} value={device.id}>{device.nome}</option>
              ))}
            </select>
          </label>
          <label>
            Origem
            <select name="origem" defaultValue="manual">
              <option value="manual">Manual</option>
              <option value="facial_simulado">Facial simulado</option>
            </select>
          </label>
          <label>Confiança<input name="confianca" inputMode="decimal" placeholder="98.5" /></label>
          <label className="md:col-span-3">Observação<input name="observacao" /></label>
          <Button name="tipo" value="entrada" variant="primary" className="self-end">Registrar entrada</Button>
          <Button name="tipo" value="saida" className="self-end border-danger bg-danger text-white hover:bg-danger/90">Registrar saída</Button>
        </form>
      </Panel>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel className="grid gap-4">
          <h2 className="flex items-center gap-2 font-display text-2xl text-ink">
            <Activity size={20} className="text-brand" />
            Eventos recentes
          </h2>
          <div className="grid gap-2">
            {data.events.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-ink/40">
                <Inbox size={24} />
                <p className="text-sm">Nenhum evento registrado ainda.</p>
              </div>
            )}
            {data.events.map((event) => (
              <div key={event.id} className="border-b border-line py-3 text-sm last:border-b-0">
                <strong>{event.alunos?.nome}</strong>
                <span className="block text-muted">
                  {event.tipo} / {new Date(event.data_evento).toLocaleString("pt-BR")} / {event.dispositivos_acesso?.nome}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="grid gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-display text-2xl text-ink">
              <Bell size={20} className="text-brand" />
              Mensagens
            </h2>
            <ButtonLink href="/portaria/notificacoes" variant="secondary">Ver todas</ButtonLink>
          </div>
          <div className="grid gap-2">
            {data.notifications.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-ink/40">
                <Bell size={24} />
                <p className="text-sm">Nenhuma notificação enviada.</p>
              </div>
            )}
            {data.notifications.map((notification) => (
              <div key={notification.id} className="border-b border-line py-3 text-sm last:border-b-0">
                <strong>{(Array.isArray(notification.alunos) ? notification.alunos[0] : notification.alunos as { nome: string } | null)?.nome}</strong>
                <span className="mt-2 flex flex-wrap items-center gap-2 text-muted">
                  <StatusPill tone={statusTone(notification.status)}>{notification.status}</StatusPill>
                  <span>{notification.telefone}</span>
                </span>
                <p className="mt-2">{notification.mensagem}</p>
                {notification.erro ? <p className="mt-1 font-bold text-clay">{notification.erro}</p> : null}
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </div>
  );
}
