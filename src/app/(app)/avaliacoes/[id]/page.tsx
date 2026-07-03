import { notFound, redirect } from "next/navigation";
import { ClipboardList, Trash2, Users, Pencil } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { PageHeader } from "@/components/ui/page-header";
import { getAvaliacaoDetalhe } from "@/lib/data/pedagogico";
import {
  deleteAvaliacaoAction,
  updateAvaliacaoAction,
} from "@/lib/actions/avaliacoes";
import { requirePermission } from "@/lib/auth/session";
import { NotasInlineGrid } from "@/components/avaliacoes/notas-inline-grid";

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
  await requirePermission("avaliacoes", "read");
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
          <Pencil size={16} className="text-brand" />
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
              <ConfirmButton
                message={`Tem certeza que quer excluir a avaliação "${aval.titulo}"? Esta operação não pode ser desfeita.`}
                className="inline-flex items-center gap-1 rounded-ui bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/20"
              >
                <Trash2 size={12} /> Excluir
              </ConfirmButton>
            </form>
            <button className="ds-button ds-button-primary px-4">Salvar dados</button>
          </div>
        </form>
      </Panel>

      <Panel className="grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-bold text-ink">
            <ClipboardList size={16} className="text-brand" />
            Lançamento de notas
          </h2>
          <div className="text-right">
            <p className="text-xs text-ink/60">{aval.notasLancadas} de {aval.totalAlunos} alunos</p>
            <div className="mt-1 h-1.5 w-32 rounded-pill bg-muted overflow-hidden">
              <div
                className={`h-1.5 ${pct === 100 ? "bg-success" : "bg-warning"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {aval.alunos.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-ink/60">
            <Users size={28} />
            <p className="text-sm font-medium">Nenhum aluno matriculado na turma.</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-ink/60">
              Salva automaticamente ao sair do campo ou pressionar Enter.
            </p>
            <NotasInlineGrid
              avaliacaoId={aval.id}
              valorMaximo={aval.valorMaximo}
              alunos={aval.alunos.map((a) => ({
                matriculaId: a.matriculaId,
                alunoId: a.alunoId,
                nome: a.nome,
                valorAtual: a.valorAtual,
              }))}
            />
          </>
        )}
      </Panel>
    </div>
  );
}
