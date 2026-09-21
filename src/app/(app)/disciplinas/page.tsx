import { BookOpen, Plus } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getAcademicData } from "@/lib/data/lookups";
import { listDisciplinas } from "@/lib/data/pedagogico";
import { createDisciplinaAction } from "@/lib/actions/disciplinas";
import { requirePermission } from "@/lib/auth/session";
import { DisciplinaListItem } from "@/components/pedagogico/disciplina-list-item";

const SEG_LABEL: Record<string, string> = {
  INFANTIL: "Ed. Infantil",
  FUNDAMENTAL1: "Fund. I",
  FUNDAMENTAL2: "Fund. II",
  MEDIO: "Médio",
};

const SEG_COLOR: Record<string, string> = {
  INFANTIL: "bg-gold/15 text-gold",
  FUNDAMENTAL1: "bg-brand/15 text-brand",
  FUNDAMENTAL2: "bg-clay/15 text-clay",
  MEDIO: "bg-moss/15 text-moss",
};

export default async function DisciplinasPage() {
  await requirePermission("disciplinas", "read");
  const [disciplinas, { series }] = await Promise.all([
    listDisciplinas(),
    getAcademicData(),
  ]);

  const porSerie = new Map<string, typeof disciplinas>();
  for (const d of disciplinas) {
    const arr = porSerie.get(d.serieId) ?? [];
    arr.push(d);
    porSerie.set(d.serieId, arr);
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "Pedagógico" }, { label: "Disciplinas" }]}
        title="Disciplinas"
        counter={disciplinas.length.toString()}
        description="Disciplinas por série. Use para organizar avaliações e notas."
      />

      <Panel className="grid gap-4">
        <h2 className="text-lg font-bold text-ink flex items-center gap-2">
          <Plus size={16} className="text-brand" />
          Nova disciplina
        </h2>
        <form action={createDisciplinaAction} className="grid gap-3 md:grid-cols-4">
          <label>
            Série
            <select name="serie_id" required>
              <option value="">Selecione...</option>
              {series.map((s) => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
          </label>
          <label className="md:col-span-2">
            Nome
            <input name="nome" required maxLength={80} placeholder="Ex.: Matemática" />
          </label>
          <label>
            Ordem
            <input name="ordem" type="number" defaultValue={0} />
          </label>
          <div className="md:col-span-4 flex justify-end">
            <button className="ds-button ds-button-primary px-4">Adicionar</button>
          </div>
        </form>
      </Panel>

      {disciplinas.length === 0 && (
        <Panel>
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-ink/60">
            <BookOpen size={28} />
            <p className="text-sm font-medium">Nenhuma disciplina cadastrada.</p>
          </div>
        </Panel>
      )}

      {series.map((s) => {
        const lista = porSerie.get(s.id) ?? [];
        if (lista.length === 0) return null;
        const segLabel = SEG_LABEL[(lista[0]?.segmento as string) ?? ""] ?? lista[0]?.segmento;
        const segColor = SEG_COLOR[(lista[0]?.segmento as string) ?? ""] ?? "bg-muted";
        return (
          <Panel key={s.id} className="grid gap-3">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-brand" />
              <h3 className="font-bold text-ink">{s.nome}</h3>
              <span className={`rounded-pill px-2 py-0.5 text-[0.66rem] font-semibold uppercase tracking-kicker ${segColor}`}>
                {segLabel}
              </span>
              <span className="ml-auto text-xs text-ink/60">{lista.length} disciplinas</span>
            </div>
            <ul className="grid gap-2">
              {lista.map((d) => (
                <DisciplinaListItem key={d.id} disciplina={d} />
              ))}
            </ul>
          </Panel>
        );
      })}
    </div>
  );
}
