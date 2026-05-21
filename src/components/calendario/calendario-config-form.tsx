import { salvarCalendarioAction } from "@/lib/actions/calendario";
import { Panel } from "@/components/ui/card";
import type { Calendario } from "@/lib/calendario/types";

const DIAS = [
  { v: 1, label: "Seg" },
  { v: 2, label: "Ter" },
  { v: 3, label: "Qua" },
  { v: 4, label: "Qui" },
  { v: 5, label: "Sex" },
  { v: 6, label: "Sáb" },
  { v: 0, label: "Dom" },
];

export function CalendarioConfigForm({
  anoLetivo, calendario,
}: {
  anoLetivo: number; calendario: Calendario | null;
}) {
  const dias = calendario?.diasSemanaLetivos ?? [1, 2, 3, 4, 5];

  return (
    <Panel className="grid gap-4">
      <h2 className="font-bold text-ink">
        {calendario ? "Editar" : "Configurar"} calendário {anoLetivo}
      </h2>
      <form action={salvarCalendarioAction} className="grid gap-4">
        {calendario && <input type="hidden" name="id" value={calendario.id} />}
        <input type="hidden" name="ano_letivo" value={anoLetivo} />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Início do ano letivo
            <input
              type="date"
              name="data_inicio"
              required
              defaultValue={calendario?.dataInicio ?? ""}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Fim do ano letivo
            <input
              type="date"
              name="data_fim"
              required
              defaultValue={calendario?.dataFim ?? ""}
            />
          </label>
        </div>

        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold text-ink">Dias da semana letivos</legend>
          <div className="flex flex-wrap gap-3">
            {DIAS.map((d) => (
              <label key={d.v} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  name="dia_semana"
                  value={d.v}
                  defaultChecked={dias.includes(d.v)}
                  className="h-4 w-4"
                />
                {d.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex justify-end">
          <button className="ds-button ds-button-primary">
            Salvar calendário
          </button>
        </div>
      </form>
    </Panel>
  );
}
