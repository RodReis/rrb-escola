"use client";

import { updateGateDeviceAction, toggleGateDeviceAction } from "@/lib/actions/gate";
import { useAction } from "@/lib/hooks/use-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";

type Dispositivo = { id: string; nome: string; local: string | null; tipo: string; ativo: boolean };

export function DispositivoCard({ device }: { device: Dispositivo }) {
  const save = useAction(updateGateDeviceAction, {
    success: "Dispositivo salvo.",
    error: "Falha ao salvar o dispositivo.",
  });
  const toggle = useAction(toggleGateDeviceAction, {
    confirm: {
      message: `Tem certeza que quer ${device.ativo ? "desativar" : "ativar"} o dispositivo "${device.nome}"?`,
    },
    success: `Dispositivo ${device.ativo ? "desativado" : "ativado"}.`,
    error: "Falha ao alterar status.",
  });

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    save.run(new FormData(e.currentTarget));
  }

  function handleToggle() {
    const fd = new FormData();
    fd.set("id", device.id);
    fd.set("ativo", device.ativo ? "" : "on");
    toggle.run(fd);
  }

  return (
    <Panel className="grid gap-4">
      <form onSubmit={handleSave} className="grid gap-3 md:grid-cols-[1fr_1fr_160px_110px_130px]">
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
        <Button type="submit" variant="primary" loading={save.pending} className="self-end">Salvar</Button>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={device.ativo ? "green" : "red"}>{device.ativo ? "Ativo" : "Inativo"}</Badge>
          <span className="text-sm text-muted">{device.tipo} / {device.local || "sem local"}</span>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={toggle.pending}
          className="text-xs font-bold text-clay disabled:opacity-50"
        >
          {toggle.pending ? "Aguarde…" : device.ativo ? "Desativar" : "Ativar"}
        </button>
      </div>
    </Panel>
  );
}
