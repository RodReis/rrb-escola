import { CalendarOff, MapPin, Pencil } from "lucide-react";
import Link from "next/link";
import { Panel } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { excluirEventoAction } from "@/lib/actions/eventos";
import type { EventoEscola } from "@/lib/data/eventos";

function formatPeriodo(inicio: string, fim: string): string {
  const fmt = (d: string) => d.split("-").reverse().join("/");
  return inicio === fim ? fmt(inicio) : `${fmt(inicio)} – ${fmt(fim)}`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function EventosList({
  eventos,
  canEdit,
  canDelete,
}: {
  eventos: EventoEscola[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const hoje = todayIso();
  return (
    <Panel className="grid gap-3">
      <h2 className="font-bold text-ink">Eventos cadastrados</h2>

      {eventos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-ink/40">
          <CalendarOff size={24} />
          <p className="text-sm">Nenhum evento cadastrado.</p>
        </div>
      ) : (
        <ul className="grid gap-2">
          {eventos.map((ev) => {
            const passado = ev.dataFim < hoje;
            return (
              <li
                key={ev.id}
                className={`flex items-center justify-between gap-3 rounded-ui border border-line p-3 ${passado ? "opacity-60" : ""}`}
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="rounded-pill bg-brand/10 px-2 py-0.5 text-[0.66rem] font-semibold uppercase text-brand">
                    {passado ? "Passado" : "Próximo"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{ev.titulo}</p>
                    <p className="text-xs text-ink/55">{formatPeriodo(ev.dataInicio, ev.dataFim)}</p>
                    {ev.local && (
                      <p className="mt-0.5 flex items-center gap-1 text-[0.66rem] text-ink/55">
                        <MapPin size={11} /> {ev.local}
                      </p>
                    )}
                    {ev.descricao && (
                      <p className="mt-1 line-clamp-2 text-xs text-ink/70">{ev.descricao}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {canEdit && (
                    <Link
                      href={`/eventos?editar=${ev.id}`}
                      className="ds-button ds-button-ghost text-xs"
                    >
                      <Pencil size={12} /> Editar
                    </Link>
                  )}
                  {canDelete && (
                    <form action={excluirEventoAction}>
                      <input type="hidden" name="id" value={ev.id} />
                      <ConfirmButton
                        message={`Excluir o evento "${ev.titulo}"?`}
                        className="ds-button ds-button-ghost text-xs"
                      >
                        Excluir
                      </ConfirmButton>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
