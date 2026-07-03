import { ArrowLeft, Plus, Cpu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Panel } from "@/components/ui/card";
import { createGateDeviceAction, toggleGateDeviceAction, updateGateDeviceAction } from "@/lib/actions/gate";
import { getGateDevices } from "@/lib/data/gate";
import { requirePermission } from "@/lib/auth/session";

export default async function GateDevicesPage() {
  await requirePermission("portaria", "read");
  const devices = await getGateDevices();

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line bg-paper px-6 py-7">
        <div>
          <p className="ds-kicker">Portaria</p>
          <h1 className="mt-7 font-display text-4xl text-ink">Dispositivos</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted">
            Cadastre cameras, totens e pontos de acesso usados nos registros da portaria.
          </p>
        </div>
        <ButtonLink href="/portaria" variant="secondary">
          <ArrowLeft size={14} /> Voltar para portaria
        </ButtonLink>
      </header>

      <Panel>
        <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-kicker text-ink/60">
          <Plus size={12} /> Novo dispositivo
        </div>
        <form action={createGateDeviceAction} className="grid gap-4 md:grid-cols-[1fr_1fr_180px_140px]">
          <label>Nome<input name="nome" placeholder="Camera entrada principal" required /></label>
          <label>Local<input name="local" placeholder="Entrada principal" /></label>
          <label>
            Tipo
            <select name="tipo" defaultValue="portaria">
              <option value="portaria">Portaria</option>
              <option value="camera">Câmera</option>
              <option value="totem">Totem</option>
            </select>
          </label>
          <Button className="self-end" variant="accent">Adicionar</Button>
        </form>
      </Panel>

      <section className="grid gap-3">
        {devices.length === 0 ? (
          <Panel>
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-ink/60">
              <Cpu size={28} />
              <p className="text-sm font-medium">Nenhum dispositivo cadastrado.</p>
            </div>
          </Panel>
        ) : null}
        {devices.map((device) => (
          <Panel key={device.id} className="grid gap-4">
            <form action={updateGateDeviceAction} className="grid gap-3 md:grid-cols-[1fr_1fr_160px_110px_130px]">
              <input type="hidden" name="id" value={device.id} />
              <label>
                Nome
                <input name="nome" defaultValue={device.nome} required />
              </label>
              <label>
                Local
                <input name="local" defaultValue={device.local ?? ""} />
              </label>
              <label>
                Tipo
                <select name="tipo" defaultValue={device.tipo}>
                  <option value="portaria">Portaria</option>
                  <option value="camera">Câmera</option>
                  <option value="totem">Totem</option>
                </select>
              </label>
              <label className="flex grid-cols-none items-center gap-2 self-end pb-3">
                <input name="ativo" type="checkbox" className="h-4 w-4" defaultChecked={device.ativo} />
                Ativo
              </label>
              <Button className="self-end" variant="primary">Salvar</Button>
            </form>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={device.ativo ? "green" : "red"}>{device.ativo ? "Ativo" : "Inativo"}</Badge>
                <span className="text-sm text-muted">{device.tipo} / {device.local || "sem local"}</span>
              </div>
              <form action={toggleGateDeviceAction}>
                <input type="hidden" name="id" value={device.id} />
                <input type="hidden" name="ativo" value={device.ativo ? "" : "on"} />
                <ConfirmButton
                  message={`Tem certeza que quer ${device.ativo ? "desativar" : "ativar"} o dispositivo "${device.nome}"?`}
                  className="text-xs font-bold text-clay"
                >
                  {device.ativo ? "Desativar" : "Ativar"}
                </ConfirmButton>
              </form>
            </div>
          </Panel>
        ))}
      </section>
    </div>
  );
}
