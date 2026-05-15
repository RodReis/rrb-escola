type Props = {
  defaults: { de: string; ate: string; statuses: string[]; aluno: string };
};

export function DelinquencyFilters({ defaults }: Props) {
  const allStatuses = ["aberta", "parcial", "vencida"];
  return (
    <form method="GET" className="grid gap-3 rounded-ui border border-line bg-muted/30 p-4 md:grid-cols-[140px_140px_1fr_180px_120px]">
      <label>
        De
        <input type="date" name="de" defaultValue={defaults.de} required />
      </label>
      <label>
        Ate
        <input type="date" name="ate" defaultValue={defaults.ate} required />
      </label>
      <fieldset className="grid gap-2">
        <legend className="text-xs font-black uppercase tracking-[0.12em] text-ink/60">Status</legend>
        <div className="flex flex-wrap gap-3">
          {allStatuses.map((s) => (
            <label key={s} className="flex items-center gap-1 text-sm">
              <input type="checkbox" name="status" value={s} defaultChecked={defaults.statuses.includes(s)} />
              {s}
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        Aluno
        <input name="aluno" placeholder="Nome ou matricula" defaultValue={defaults.aluno} />
      </label>
      <button className="ds-button ds-button-primary self-end" type="submit">Filtrar</button>
    </form>
  );
}
