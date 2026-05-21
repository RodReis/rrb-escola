import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { saveStudentGateSettingsAction } from "@/lib/actions/gate";

type GateSettings = {
  consent: {
    autorizado: boolean;
    observacao: string | null;
  } | null;
  preferences: {
    responsavel_id: string | null;
    telefone_destino: string | null;
    notificar_entrada: boolean;
    notificar_saida: boolean;
    ativo: boolean;
  } | null;
  guardians: Array<{
    id: string;
    nome: string;
    parentesco: string | null;
    celular: string | null;
    telefone: string | null;
  }>;
  events: Array<{
    id: string;
    tipo: string;
    origem: string;
    data_evento: string;
    dispositivos_acesso: { nome: string } | null;
  }>;
  notifications: Array<{
    id: string;
    mensagem: string;
    status: string;
    telefone: string | null;
    erro: string | null;
    created_at: string;
  }>;
};

function ToggleLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="flex grid-cols-none items-center gap-3 rounded-ui border border-line bg-surface px-4 py-3 text-sm font-semibold text-ink">
      {children}
    </label>
  );
}

type Props = { alunoId: string; settings: GateSettings };

export function StudentGatePanel({ alunoId, settings }: Props) {
  return (
    <Panel className="grid gap-5">
      <div className="flex items-center gap-3">
        <ShieldCheck className="text-moss" />
        <h2 className="font-serif text-2xl text-ink">Portaria e biometria</h2>
      </div>

      <form action={saveStudentGateSettingsAction} className="grid gap-4 md:grid-cols-4">
        <input type="hidden" name="aluno_id" value={alunoId} />
        <label>
          Responsavel
          <select name="responsavel_id" defaultValue={settings.preferences?.responsavel_id ?? ""}>
            <option value="">Selecione</option>
            {settings.guardians.map((guardian) => (
              <option key={guardian.id} value={guardian.id}>
                {guardian.nome} {guardian.parentesco ? `- ${guardian.parentesco}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          WhatsApp destino
          <input name="telefone_destino" defaultValue={settings.preferences?.telefone_destino ?? ""} />
        </label>
        <ToggleLabel>
          <input name="autorizado" type="checkbox" className="h-4 w-4" defaultChecked={settings.consent?.autorizado ?? false} />
          Autoriza biometria
        </ToggleLabel>
        <ToggleLabel>
          <input name="notificacao_ativa" type="checkbox" className="h-4 w-4" defaultChecked={settings.preferences?.ativo ?? true} />
          Notificacao ativa
        </ToggleLabel>
        <ToggleLabel>
          <input name="notificar_entrada" type="checkbox" className="h-4 w-4" defaultChecked={settings.preferences?.notificar_entrada ?? true} />
          Avisar entrada
        </ToggleLabel>
        <ToggleLabel>
          <input name="notificar_saida" type="checkbox" className="h-4 w-4" defaultChecked={settings.preferences?.notificar_saida ?? true} />
          Avisar saida
        </ToggleLabel>
        <label className="md:col-span-2">
          Observação do consentimento
          <input name="observacao" defaultValue={settings.consent?.observacao ?? ""} />
        </label>
        <div className="md:col-span-4">
          <Button variant="accent">Salvar portaria</Button>
        </div>
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-bold text-ink">Ultimos eventos</h3>
          <div className="grid gap-2">
            {settings.events.length === 0 ? <p className="text-sm text-muted">Nenhum evento registrado.</p> : null}
            {settings.events.map((event) => (
              <div key={event.id} className="border-b border-line py-3 text-sm last:border-b-0">
                <strong>{event.tipo}</strong>
                <span className="block text-muted">
                  {new Date(event.data_evento).toLocaleString("pt-BR")} / {event.dispositivos_acesso?.nome ?? event.origem}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-bold text-ink">Mensagens WhatsApp</h3>
          <div className="grid gap-2">
            {settings.notifications.length === 0 ? <p className="text-sm text-muted">Nenhuma notificação registrada.</p> : null}
            {settings.notifications.map((notification) => (
              <div key={notification.id} className="border-b border-line py-3 text-sm last:border-b-0">
                <strong>{notification.status}</strong>
                <span className="block text-muted">{notification.telefone}</span>
                <p className="mt-1">{notification.mensagem}</p>
                {notification.erro ? <p className="mt-1 text-clay">{notification.erro}</p> : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}
