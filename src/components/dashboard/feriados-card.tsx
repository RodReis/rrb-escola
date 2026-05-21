import { CalendarDays, PartyPopper, CalendarOff } from "lucide-react";
import type { CalendarioExcecao } from "@/lib/calendario/types";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const TIPO_LABEL: Record<string, string> = {
  feriado: "Feriado",
  recesso: "Recesso",
};

function parseISO(date: string): { dia: number; mes: number; ano: number; diaSemana: number } {
  const [ano, mes, dia] = date.split("-").map(Number);
  const diaSemana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
  return { dia, mes, ano, diaSemana };
}

function hojeISO(): string {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`;
}

export function FeriadosCard({ items }: { items: CalendarioExcecao[] }) {
  const hoje = hojeISO();
  // Próximo evento ainda não passado (data_fim >= hoje).
  const futuros = items.filter((e) => e.dataFim >= hoje);
  const destaque = futuros[0] ?? null;
  const demais = futuros.slice(1);

  return (
    <article className="rounded-panel bg-surface bg-gradient-to-br from-danger/10 to-transparent p-6 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-ui bg-danger/15 text-danger">
            <CalendarDays size={16} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-ink">Feriados e recessos</h3>
            <p className="text-[0.66rem] text-ink/55">este mês e o próximo</p>
          </div>
        </div>
        {futuros.length > 0 && (
          <span className="rounded-pill bg-danger/20 px-2 py-0.5 text-[0.66rem] font-bold text-danger">
            {futuros.length}
          </span>
        )}
      </div>

      {futuros.length === 0 && (
        <div className="mt-6 flex flex-col items-center justify-center gap-2 rounded-ui bg-muted/30 py-8 text-ink/40">
          <CalendarOff size={24} />
          <p className="text-sm">Nenhum feriado ou recesso à frente.</p>
        </div>
      )}

      {destaque && (() => {
        const d = parseISO(destaque.dataInicio);
        const periodo = destaque.dataInicio === destaque.dataFim
          ? `${MESES[d.mes - 1]} · ${DIAS_SEMANA[d.diaSemana]}`
          : `${destaque.dataInicio.split("-").reverse().join("/")} – ${destaque.dataFim.split("-").reverse().join("/")}`;
        return (
          <div className="mt-4 flex items-center gap-3 rounded-ui border border-danger/30 bg-gradient-to-br from-danger/20 to-danger/5 p-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-ui bg-danger text-paper shadow-soft">
              <span className="text-lg font-bold leading-none">{String(d.dia).padStart(2, "0")}</span>
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <PartyPopper size={13} className="text-danger" />
                <p className="text-[0.6rem] font-bold uppercase tracking-kicker text-danger">
                  Próximo · {TIPO_LABEL[destaque.tipo]}
                </p>
              </div>
              <p className="truncate text-sm font-bold text-ink">{destaque.descricao}</p>
              <p className="text-xs text-ink/55">{periodo}</p>
            </div>
          </div>
        );
      })()}

      {demais.length > 0 && (
        <ul className="mt-4 grid gap-2">
          {demais.map((e) => {
            const d = parseISO(e.dataInicio);
            return (
              <li
                key={e.id}
                className="flex items-center gap-3 rounded-ui border border-line p-2"
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-ui text-xs font-bold ${
                  e.tipo === "feriado" ? "bg-danger/15 text-danger" : "bg-warning/15 text-warning"
                }`}>
                  {String(d.dia).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{e.descricao}</p>
                  <p className="text-xs text-ink/55">
                    {TIPO_LABEL[e.tipo]} · {MESES[d.mes - 1]}
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
