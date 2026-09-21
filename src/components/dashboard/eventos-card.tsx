import { CalendarHeart, MapPin, CalendarOff } from "lucide-react";
import type { EventoEscola } from "@/lib/data/eventos";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function parseISO(date: string): { dia: number; mes: number; ano: number; diaSemana: number } {
  const [ano, mes, dia] = date.split("-").map(Number);
  const diaSemana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
  return { dia, mes, ano, diaSemana };
}

function formatRange(inicio: string, fim: string): string {
  if (inicio === fim) {
    const d = parseISO(inicio);
    return `${MESES[d.mes - 1]} · ${DIAS_SEMANA[d.diaSemana]}`;
  }
  return `${inicio.split("-").reverse().join("/")} – ${fim.split("-").reverse().join("/")}`;
}

export function EventosCard({ items }: { items: EventoEscola[] }) {
  const destaque = items[0] ?? null;
  const demais = items.slice(1);

  return (
    <article className="rounded-panel bg-surface bg-gradient-to-br from-brand/10 to-transparent p-6 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-ui bg-brand/15 text-brand">
            <CalendarHeart size={16} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-ink">Eventos</h3>
            <p className="text-[0.66rem] text-ink/60">próximos da agenda da escola</p>
          </div>
        </div>
        {items.length > 0 && (
          <span className="rounded-pill bg-brand/20 px-2 py-0.5 text-[0.66rem] font-bold text-brand">
            {items.length}
          </span>
        )}
      </div>

      {items.length === 0 && (
        <div className="mt-6 flex flex-col items-center justify-center gap-2 rounded-ui bg-muted/30 py-8 text-ink/60">
          <CalendarOff size={24} />
          <p className="text-sm">Nenhum evento cadastrado.</p>
        </div>
      )}

      {destaque && (() => {
        const d = parseISO(destaque.dataInicio);
        return (
          <div className="mt-4 flex items-center gap-3 rounded-ui border border-brand/30 bg-gradient-to-br from-brand/20 to-brand/5 p-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-ui bg-brand text-paper shadow-soft">
              <span className="text-lg font-bold leading-none">{String(d.dia).padStart(2, "0")}</span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.6rem] font-bold uppercase tracking-kicker text-brand">
                Próximo evento
              </p>
              <p className="truncate text-sm font-bold text-ink">{destaque.titulo}</p>
              <p className="text-xs text-ink/60">{formatRange(destaque.dataInicio, destaque.dataFim)}</p>
              {destaque.local && (
                <p className="mt-0.5 flex items-center gap-1 text-[0.66rem] text-ink/60">
                  <MapPin size={11} /> {destaque.local}
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {demais.length > 0 && (
        <ul className="mt-4 grid gap-2">
          {demais.map((e) => {
            const d = parseISO(e.dataInicio);
            return (
              <li key={e.id} className="flex items-center gap-3 rounded-ui border border-line p-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-ui bg-brand/15 text-xs font-bold text-brand">
                  {String(d.dia).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{e.titulo}</p>
                  <p className="text-xs text-ink/60">
                    {MESES[d.mes - 1]}
                    {e.local && <span className="ml-1">· {e.local}</span>}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
