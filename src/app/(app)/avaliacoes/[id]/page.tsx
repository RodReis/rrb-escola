import { notFound, redirect } from "next/navigation";
import { ClipboardList, Save, Trash2 } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getAvaliacaoDetalhe } from "@/lib/data/pedagogico";
import {
  deleteAvaliacaoAction,
  lancarNotasAction,
  updateAvaliacaoAction,
} from "@/lib/actions/avaliacoes";

const TIPO_LABEL: Record<string, string> = {
  prova: "Prova",
  trabalho: "Trabalho",
  participacao: "Participação",
  simulado: "Simulado",
  outro: "Outro",
};

async function deleteAndRedirect(formData: FormData) {
  "use server";
  await deleteAvaliacaoAction(formData);
  redirect("/avaliacoes");
}

export default async function AvaliacaoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const aval = await getAvaliacaoDetalhe(id);
  if (!aval) notFound();

  const pct = aval.totalAlunos > 0 ? (aval.notasLancadas / aval.totalAlunos) * 100 : 0;

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[
          { label: "Pedagógico" },
          { label: "Avaliações", href: "/avaliacoes" },
          { label: aval.titulo },
        ]}
        title={aval.titulo}
        counter={`${aval.notasLancadas}/${aval.totalAlunos}`}
        description={`${aval.serie} ${aval.turma} · ${aval.disciplina} · ${aval.bimestre}º Bim ${aval.anoLetivo}`}
      />

      <Panel className="grid gap-4">
        <div className="flex items-center gap-2">
          <ClipboardList size={16} className="text-brand" />
          <h2 className="font-bold text-ink">Dados da avaliação</h2>
        </div>
        <form action={updateAvaliacaoAction} className="grid gap-3 md:grid-cols-3">
          <input type="hidden" name="id" value={aval.id} />
          <label className="md:col-span-3">
            Título
            <input name="titulo" defaultValue={aval.titulo} required maxLength={200} />
          </label>
          <label>
            Bimestre
            <select name="bimestre" defaultValue={String(aval.bimestre)}>
              <option value="1">1º Bimestre</option>
              <option value="2">2º Bimestre</option>
              <option value="3">3º Bimestre</option>
              <option value="4">4º Bimestre</option>
            </select>
          </label>
          <label>
            Tipo
            <select name="tipo" defaultValue={aval.tipo}>
              <option value="prova">Prova</option>
              <option value="trabalho">Trabalho</option>
              <option value="participacao">Participação</option>
              <option value="simulado">Simulado</option>
              <option value="outro">Outro</option>
            </select>
          </label>
          <label>
            Data de aplicação
            <input name="data_aplicacao" type="date" defaultValue={aval.dataAplicacao ?? ""} />
          </label>
          <label>
            Peso
            <input name="peso" type="number" step="0.1" defaultValue={aval.peso} min={0.1} />
          </label>
          <label>
            Valor máximo
            <input name="valor_maximo" type="number" step="0.1" defaultValue={aval.valorMaximo} />
          </label>
          <div />
          <div className="md:col-span-3 flex justify-between">
            <form action={deleteAndRedirect}>
              <input type="hidden" name="id" value={aval.id} />
              <button className="inline-flex items-center gap-1 rounded-ui bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/20">
                <Trash2 size={12} /> Excluir
              </button>
            </form>
            <button className="ds-button ds-button-primary px-4">Salvar dados</button>
          </div>
        </form>
      </Panel>

      <Panel className="grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold text-ink">Lançamento de notas</h2>
          <div className="text-right">
            <p className="text-xs text-ink/55">{aval.notasLancadas} de {aval.totalAlunos} alunos</p>
            <div className="mt-1 h-1.5 w-32 rounded-pill bg-muted overflow-hidden">
              <div
                className={`h-1.5 ${pct === 100 ? "bg-success" : "bg-warning"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {aval.alunos.length === 0 ? (
          <p className="text-sm text-ink/60">Nenhum aluno matriculado na turma.</p>
        ) : (
          <form action={lancarNotasAction}>
            <input type="hidden" name="avaliacao_id" value={aval.id} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[0.66rem] uppercase tracking-kicker text-ink/55">
                    <th className="px-2 py-2 text-left">Aluno</th>
                    <th className="px-2 py-2 text-right w-32">Nota (0 a {aval.valorMaximo})</th>
                    <th className="px-2 py-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {aval.alunos.map((a) => (
                    <tr key={a.matriculaId} className="border-t border-line">
                      <td className="px-2 py-2 font-medium text-ink">{a.nome}</td>
                      <td className="px-2 py-2 text-right">
                        <input type="hidden" name={`aluno_${a.matriculaId}`} value={a.alunoId} />
                        <input
                          name={`nota_${a.matriculaId}`}
                          type="number"
                          step="0.1"
                          min={0}
                          max={aval.valorMaximo}
                          defaultValue={a.valorAtual ?? ""}
                          placeholder="—"
                          className="w-24 rounded-ui border border-line bg-surface px-2 py-1 text-right text-sm font-semibold"
                        />
                      </td>
                      <td className="px-2 py-2 text-right text-xs">
                        {a.valorAtual === null ? (
                          <span className="text-ink/40">pendente</span>
                        ) : a.valorAtual >= aval.valorMaximo * 0.6 ? (
                          <span className="font-semibold text-success">{a.valorAtual.toFixed(1)} ✓</span>
                        ) : (
                          <span className="font-semibold text-danger">{a.valorAtual.toFixed(1)} ✗</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <button className="ds-button ds-button-primary px-6">
                <Save size={14} /> Salvar notas
              </button>
            </div>
          </form>
        )}
      </Panel>
    </div>
  );
}
