import { Search } from "lucide-react";
import { MOTIVO_LABEL, type MotivoSemValor } from "@/lib/data/alunos-sem-valor";

type Option = { id: string; nome: string };

type Props = {
  defaults: {
    nome: string;
    motivo: string;
    serieId: string;
    turmaId: string;
  };
  series: Option[];
  turmas: Option[];
};

const MOTIVOS = Object.keys(MOTIVO_LABEL) as MotivoSemValor[];

export function AlunosSemValorFilters({ defaults, series, turmas }: Props) {
  return (
    <form
      method="GET"
      className="grid gap-3 rounded-ui border border-line bg-muted/30 p-4 md:grid-cols-[1fr_180px_180px_180px_120px] items-end"
    >
      <label className="relative">
        Aluno
        <Search size={14} className="absolute left-3 bottom-3 text-ink/40" />
        <input
          name="nome"
          placeholder="Nome do aluno"
          defaultValue={defaults.nome}
          className="pl-9"
        />
      </label>
      <label>
        Motivo
        <select name="motivo" defaultValue={defaults.motivo}>
          <option value="">Todos</option>
          {MOTIVOS.map((m) => (
            <option key={m} value={m}>
              {MOTIVO_LABEL[m]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Série
        <select name="serie" defaultValue={defaults.serieId}>
          <option value="">Todas</option>
          {series.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
          ))}
        </select>
      </label>
      <label>
        Turma
        <select name="turma" defaultValue={defaults.turmaId}>
          <option value="">Todas</option>
          {turmas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
      </label>
      <button className="ds-button ds-button-primary" type="submit">
        Filtrar
      </button>
    </form>
  );
}
