type VinculoChipProps = {
  lead_id: string | null;
  aluno_id: string | null;
  responsavel_id: string | null;
};

export function VinculoChip({ lead_id, aluno_id, responsavel_id }: VinculoChipProps) {
  if (lead_id) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-bold" style={{ background: 'var(--tint-green)', color: 'color-mix(in oklab, var(--ok) var(--on-tint), var(--text))' }}>
        🎓 Lead
      </span>
    );
  }
  if (aluno_id || responsavel_id) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-bold" style={{ background: 'var(--tint-blue)', color: 'color-mix(in oklab, var(--c-blue) var(--on-tint), var(--text))' }}>
        👤 Responsável
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-bold" style={{ background: 'var(--surface-3)', color: 'var(--text-soft)' }}>
      ❓ Sem vínculo
    </span>
  );
}
