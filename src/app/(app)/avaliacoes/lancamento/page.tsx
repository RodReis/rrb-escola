import { ClipboardEdit } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";
import {
  getTurmasComSerie,
  getDisciplinasPorSerie,
  getGridNotasAnual,
} from "@/lib/data/lancamento-notas";
import { FiltrosLancamento } from "@/components/avaliacoes/filtros-lancamento";
import { NotasBimestraisGrid } from "@/components/avaliacoes/notas-bimestrais-grid";

function isValidAno(v: string | undefined): boolean {
  if (!v) return false;
  const n = Number(v);
  return Number.isInteger(n) && n >= 2000 && n <= 2100;
}

export default async function LancamentoNotasPage({
  searchParams,
}: {
  searchParams: Promise<{
    serie?: string;
    turma?: string;
    disciplina?: string;
    ano?: string;
  }>;
}) {
  await requirePermission("avaliacoes", "read");
  const sp = await searchParams;

  const ano = isValidAno(sp.ano) ? Number(sp.ano) : new Date().getFullYear();
  const serieSel = sp.serie || null;
  const turmaSel = sp.turma || null;
  const disciplinaSel = sp.disciplina || null;

  const turmasComSerie = await getTurmasComSerie(ano);
  const disciplinas = serieSel ? await getDisciplinasPorSerie(serieSel) : [];

  const turmaValida =
    !!turmaSel && turmasComSerie.some((t) => t.turmaId === turmaSel);
  const disciplinaValida =
    !!disciplinaSel && disciplinas.some((d) => d.id === disciplinaSel);

  const grid =
    turmaSel && disciplinaSel && turmaValida && disciplinaValida
      ? await getGridNotasAnual(turmaSel, disciplinaSel, ano)
      : null;

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[
          { label: "Pedagógico" },
          { label: "Avaliações", href: "/avaliacoes" },
          { label: "Lançamento" },
        ]}
        title="Lançamento de Notas"
        description="Selecione série, turma e disciplina para lançar as notas bimestrais."
      />

      <Panel className="grid gap-4">
        <FiltrosLancamento
          turmasComSerie={turmasComSerie}
          disciplinas={disciplinas}
          serieSel={serieSel}
          turmaSel={turmaSel}
          disciplinaSel={disciplinaSel}
          ano={ano}
        />
      </Panel>

      {!grid && (
        <div className="rounded-ui bg-muted/30 p-10 text-center text-ink/50">
          <ClipboardEdit className="mx-auto mb-2" size={28} />
          <p className="text-sm">
            Selecione série, turma e disciplina para começar a lançar as notas.
          </p>
        </div>
      )}

      {grid && (
        <Panel className="grid gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-ink">Notas dos alunos</h2>
            <p className="text-xs text-ink/55">
              {grid.alunos.length} aluno{grid.alunos.length === 1 ? "" : "s"} ·
              salva automaticamente
            </p>
          </div>
          <NotasBimestraisGrid
            alunos={grid.alunos}
            turmaId={turmaSel!}
            disciplinaId={disciplinaSel!}
            anoLetivo={ano}
            valorMaximo={grid.valorMaximo}
          />
        </Panel>
      )}
    </div>
  );
}
