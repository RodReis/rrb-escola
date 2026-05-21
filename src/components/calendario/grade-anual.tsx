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

const ESTADO_LABEL: Record<EstadoDia, string> = {
  letivo: "Dia letivo",
  feriado: "Feriado",
  recesso: "Recesso",
  "nao-letivo": "Não letivo",
};

function infoDoDia(
  date: string,
  calendario: Calendario,
  excecoes: CalendarioExcecao[],
): { estado: EstadoDia; descricao: string | null } {
  if (isDiaLetivo(date, calendario, excecoes)) {
    return { estado: "letivo", descricao: null };
  }
  for (const ex of excecoes) {
    if (date >= ex.dataInicio && date <= ex.dataFim) {
      return { estado: ex.tipo, descricao: ex.descricao };
    }
  }
  return { estado: "nao-letivo", descricao: null };
}

const CELL_CLASS: Record<EstadoDia, string> = {
  letivo: "bg-surface text-ink",
  feriado: "bg-danger/20 text-danger font-bold ring-1 ring-inset ring-danger/50",
  recesso: "bg-warning/20 text-warning font-bold ring-1 ring-inset ring-warning/50",
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
          const { estado, descricao } = infoDoDia(date, calendario, excecoes);
          const dataBR = date.split("-").reverse().join("/");
          const hint = descricao
            ? `${dataBR} — ${ESTADO_LABEL[estado]}: ${descricao}`
            : `${dataBR} — ${ESTADO_LABEL[estado]}`;
          const destaque = estado === "feriado" || estado === "recesso";
          return (
            <span
              key={i}
              className={`relative rounded-sm py-1 ${destaque ? "cursor-help" : ""} ${CELL_CLASS[estado]}`}
              title={hint}
            >
              {dia}
              {destaque && (
                <span
                  className={`absolute right-0.5 top-0.5 h-1 w-1 rounded-full ${
                    estado === "feriado" ? "bg-danger" : "bg-warning"
                  }`}
                />
              )}
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
