import { ArrowLeft, Plus, Cpu } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { getGateDevices } from "@/lib/data/gate";
import { requirePermission } from "@/lib/auth/session";
import { NovoDispositivoForm } from "@/components/portaria/novo-dispositivo-form";
import { DispositivoCard } from "@/components/portaria/dispositivo-card";

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
        <NovoDispositivoForm />
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
          <DispositivoCard key={device.id} device={device} />
        ))}
      </section>
    </div>
  );
}
