import { ArrowLeft } from "lucide-react";
import { GateCameraConsole } from "@/components/gate/gate-camera-console";
import { ButtonLink } from "@/components/ui/button";
import { getGateData } from "@/lib/data/gate";
import { requirePermission } from "@/lib/auth/session";

export default async function GateCameraPage() {
  await requirePermission("portaria", "read");
  const data = await getGateData();

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line bg-paper px-6 py-7">
        <div>
          <p className="ds-kicker">Portaria</p>
          <h1 className="mt-7 font-display text-4xl text-ink">Camera</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted">
            Console de camera para registrar entradas e saidas por identificacao simulada.
          </p>
        </div>
        <ButtonLink href="/portaria" variant="secondary">
          <ArrowLeft size={14} /> Voltar para portaria
        </ButtonLink>
      </header>

      <GateCameraConsole students={data.students} devices={data.devices} />
    </div>
  );
}
