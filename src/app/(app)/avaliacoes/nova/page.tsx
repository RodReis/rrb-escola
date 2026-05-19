import { Plus, ClipboardList } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getAcademicData } from "@/lib/data/lookups";
import { listDisciplinas } from "@/lib/data/pedagogico";
import { createAvaliacaoAction } from "@/lib/actions/avaliacoes";
import { requirePermission } from "@/lib/auth/session";

export default async function NovaAvaliacaoPage() {
  await requirePermission("avaliacoes", "read");
  const [disciplinas, { turmas }] = await Promise.all([
    listDisciplinas(),
    getAcademicData(),
  ]);

  const anoCorrente = new Date().getFullYear();

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[
          { label: "Pedagógico" },
          { label: "Avaliações", href: "/avaliacoes" },
          { label: "Nova" },
        ]}
        title="Nova avaliação"
        description="Crie uma prova/trabalho. Depois lance as notas dos alunos."
      />

      <Panel className="grid gap-4">
        <div className="flex items-center gap-2">
          <ClipboardList size={16} className="text-brand" />
          <h2 className="text-sm font-bold uppercase tracking-kicker text-ink/55">Dados da avaliação</h2>
        </div>
        <form action={createAvaliacaoAction} className="grid gap-3 md:grid-cols-2">
          <label className="md:col-span-2">
            Título
            <input name="titulo" required maxLength={200} placeholder="Ex.: Prova bimestral - Funções" />
          </label>
          <label>
            Disciplina
            <select name="disciplina_id" required>
              <option value="">Selecione...</option>
              {disciplinas.map((d) => (
                <option key={d.id} value={d.id}>{d.serie} · {d.nome}</option>
              ))}
            </select>
          </label>
          <label>
            Turma
            <select name="turma_id" required>
              <option value="">Selecione...</option>
              {turmas.map((t) => (
                <option key={t.id} value={t.id}>
                  {(t.series as { nome?: string } | undefined)?.nome ?? "—"} {t.nome} ({t.ano_letivo})
                </option>
              ))}
            </select>
          </label>
          <label>
            Bimestre
            <select name="bimestre" required defaultValue="1">
              <option value="1">1º Bimestre</option>
              <option value="2">2º Bimestre</option>
              <option value="3">3º Bimestre</option>
              <option value="4">4º Bimestre</option>
            </select>
          </label>
          <label>
            Ano letivo
            <input name="ano_letivo" type="number" defaultValue={anoCorrente} />
          </label>
          <label>
            Tipo
            <select name="tipo" defaultValue="prova">
              <option value="prova">Prova</option>
              <option value="trabalho">Trabalho</option>
              <option value="participacao">Participação</option>
              <option value="simulado">Simulado</option>
              <option value="outro">Outro</option>
            </select>
          </label>
          <label>
            Peso
            <input name="peso" type="number" step="0.1" defaultValue={1} min={0.1} />
          </label>
          <label>
            Valor máximo
            <input name="valor_maximo" type="number" step="0.1" defaultValue={10} />
          </label>
          <label>
            Data de aplicação
            <input name="data_aplicacao" type="date" />
          </label>
          <div className="md:col-span-2 flex justify-end">
            <button className="ds-button ds-button-primary px-6">
              <Plus size={14} /> Criar avaliação
            </button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
