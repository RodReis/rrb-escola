import { isDiaLetivo } from "@/lib/calendario/dias-letivos";
import type { Calendario, CalendarioExcecao } from "@/lib/calendario/types";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

type EstadoDia = "letivo" | "feriado" | "recesso" | "nao-letivo";

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function estadoDoDia(
  date: string,
  calendario: Calendario,
  excecoes: CalendarioExcecao[],
): EstadoDia {
  if (isDiaLetivo(date, calendario, excecoes)) return "letivo";
  for (const ex of excecoes) {
    if (date >= ex.dataInicio && date <= ex.dataFim) return ex.tipo;
  }
  return "nao-letivo";
}

const CELL_CLASS: Record<EstadoDia, string> = {
  letivo: "bg-surface text-ink",
  feriado: "bg-danger/15 text-danger font-semibold",
  recesso: "bg-warning/15 text-warning font-semibold",
  "nao-letivo": "bg-muted/50 text-ink/35",
};

function MesGrid({
  ano, mes, calendario, excecoes,
}: {
  ano: number; mes: number; calendario: Calendario; excecoes: CalendarioExcecao[];
}) {
  const primeiroDiaSemana = new Date(Date.UTC(ano, mes, 1)).getUTCDay();
  const diasNoMes = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  const celulas: Array<number | null> = [];
  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null);
  for (let d = 1; d <= diasNoMes; d++) celulas.push(d);

  return (
    <div className="rounded-ui border border-line p-3">
      <h3 className="mb-2 text-sm font-bold text-ink">{MESES[mes]}</h3>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[0.6rem]">
        {DIAS_SEMANA.map((d, i) => (
          <span key={i} className="font-bold text-ink/45">{d}</span>
        ))}
        {celulas.map((dia, i) => {
          if (dia === null) return <span key={i} />;
          const date = iso(ano, mes, dia);
          const estado = estadoDoDia(date, calendario, excecoes);
          return (
            <span
              key={i}
              className={`rounded-sm py-1 ${CELL_CLASS[estado]}`}
              title={`${date} — ${estado}`}
            >
              {dia}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function GradeAnual({
  calendario, excecoes,
}: {
  calendario: Calendario; excecoes: CalendarioExcecao[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 12 }, (_, mes) => (
        <MesGrid
          key={mes}
          ano={calendario.anoLetivo}
          mes={mes}
          calendario={calendario}
          excecoes={excecoes}
        />
      ))}
    </div>
  );
}
