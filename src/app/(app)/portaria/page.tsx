import { DoorOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { registerGateEventAction } from "@/lib/actions/gate";
import { getGateData } from "@/lib/data/gate";

function statusTone(status: string): "green" | "red" | "gold" | "gray" {
  if (status === "enviada") return "green";
  if (status === "erro") return "red";
  if (status === "pendente") return "gold";
  return "gray";
}

export default async function PortariaPage() {
  const data = await getGateData();
  const defaultDevice = data.devices[0]?.id ?? "";

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line bg-paper px-6 py-7">
        <div>
          <p className="ds-kicker">Gestao / Entrada e saida</p>
          <h1 className="mt-7 font-serif text-4xl text-ink">Portaria</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted">
            Registre entrada e saida, acompanhe eventos recentes e confira as notificacoes enviadas aos responsaveis.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/portaria/painel" variant="primary">Painel diario</ButtonLink>
          <ButtonLink href="/portaria/camera" variant="accent">Camera</ButtonLink>
          <ButtonLink href="/portaria/notificacoes" variant="secondary">Notificacoes</ButtonLink>
          <ButtonLink href="/portaria/dispositivos" variant="secondary">Dispositivos</ButtonLink>
        </div>
      </header>

      <Panel className="grid gap-5">
        <div className="flex items-center gap-3">
          <DoorOpen className="text-moss" />
          <h2 className="font-serif text-2xl text-ink">Registro manual ou facial simulado</h2>
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
          <label>Confianca<input name="confianca" inputMode="decimal" placeholder="98.5" /></label>
          <label className="md:col-span-3">Observacao<input name="observacao" /></label>
          <Button name="tipo" value="entrada" variant="accent" className="self-end">Registrar entrada</Button>
          <Button name="tipo" value="saida" className="self-end border-clay bg-clay text-white hover:bg-clay/90">Registrar saida</Button>
        </form>
      </Panel>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel className="grid gap-4">
          <h2 className="font-serif text-2xl text-ink">Eventos recentes</h2>
          <div className="grid gap-2">
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
            <h2 className="font-serif text-2xl text-ink">Mensagens</h2>
            <ButtonLink href="/portaria/notificacoes" variant="secondary">Ver todas</ButtonLink>
          </div>
          <div className="grid gap-2">
            {data.notifications.map((notification) => (
              <div key={notification.id} className="border-b border-line py-3 text-sm last:border-b-0">
                <strong>{notification.alunos?.nome}</strong>
                <span className="mt-2 flex flex-wrap items-center gap-2 text-muted">
                  <Badge tone={statusTone(notification.status)}>{notification.status}</Badge>
                  <span>{notification.telefone_destino}</span>
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
