import { Search } from "lucide-react";

type Props = {
  defaults: { de: string; ate: string; statuses: string[]; aluno: string };
};

const STATUS_LABELS: Record<string, string> = {
  aberta: "Aberta",
  parcial: "Parcial",
  vencida: "Vencida",
};

export function DelinquencyFilters({ defaults }: Props) {
  const allStatuses = ["aberta", "parcial", "vencida"];
  return (
    <form method="GET" className="grid gap-3 rounded-ui border border-line bg-muted/30 p-4 md:grid-cols-[140px_140px_1fr_1fr_120px] items-end">
      <label>
        De
        <input type="date" name="de" defaultValue={defaults.de} required />
      </label>
      <label>
        Até
        <input type="date" name="ate" defaultValue={defaults.ate} required />
      </label>
      <fieldset className="grid gap-1.5">
        <legend className="text-xs font-black uppercase tracking-[0.12em] text-ink/60">Status</legend>
        <div className="flex flex-wrap gap-3">
          {allStatuses.map((s) => (
            <label key={s} className="flex items-center gap-1.5 text-sm font-medium">
              <input type="checkbox" name="status" value={s} defaultChecked={defaults.statuses.includes(s)} className="h-4 w-4 accent-brand" />
              {STATUS_LABELS[s] ?? s}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="relative">
        Aluno
        <Search size={14} className="absolute left-3 bottom-3 text-ink/40" />
        <input name="aluno" placeholder="Nome ou matrícula" defaultValue={defaults.aluno} className="pl-9" />
      </label>
      <button className="ds-button ds-button-primary" type="submit">Filtrar</button>
    </form>
  );
}
