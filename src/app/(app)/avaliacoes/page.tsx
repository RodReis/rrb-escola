import Link from "next/link";
import { ArrowRight, ClipboardList, Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { listAvaliacoes } from "@/lib/data/pedagogico";
import { requirePermission } from "@/lib/auth/session";

const TIPO_LABEL: Record<string, string> = {
  prova: "Prova",
  trabalho: "Trabalho",
  participacao: "Participação",
  simulado: "Simulado",
  outro: "Outro",
};

const TIPO_COLOR: Record<string, string> = {
  prova: "bg-brand/10 text-brand",
  trabalho: "bg-accent/10 text-accent",
  participacao: "bg-moss/10 text-moss",
  simulado: "bg-warning/10 text-warning",
  outro: "bg-muted text-ink/60",
};

export default async function AvaliacoesPage() {
  await requirePermission("avaliacoes", "read");
  const avaliacoes = await listAvaliacoes();

  // Agrupa por bimestre
  const porBim = new Map<number, typeof avaliacoes>();
  for (const a of avaliacoes) {
    const arr = porBim.get(a.bimestre) ?? [];
    arr.push(a);
    porBim.set(a.bimestre, arr);
  }
  const bims = Array.from(porBim.keys()).sort();

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "Pedagógico" }, { label: "Avaliações" }]}
        title="Avaliações"
        counter={avaliacoes.length.toString()}
        description="Provas, trabalhos e atividades por bimestre."
        actions={
          <ButtonLink href="/avaliacoes/nova" variant="primary">
            <Plus size={14} /> Nova avaliação
          </ButtonLink>
        }
      />

      {avaliacoes.length === 0 && (
        <Panel>
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-ink/40">
            <ClipboardList size={28} />
            <p className="text-sm font-medium">Nenhuma avaliação cadastrada.</p>
            <ButtonLink href="/avaliacoes/nova" variant="ghost" className="mt-2">
              <Plus size={14} /> Cadastrar primeira
            </ButtonLink>
          </div>
        </Panel>
      )}

      {bims.map((bim) => {
        const lista = porBim.get(bim) ?? [];
        return (
          <Panel key={bim} className="grid gap-3">
            <div className="flex items-center gap-2">
              <ClipboardList size={16} className="text-brand" />
              <h2 className="font-bold text-ink">{bim}º Bimestre</h2>
              <span className="ml-auto text-xs text-ink/55">{lista.length} avaliações</span>
            </div>
            <ul className="grid gap-2">
              {lista.map((a) => {
                const pct = a.totalAlunos > 0 ? (a.notasLancadas / a.totalAlunos) * 100 : 0;
                return (
                  <li key={a.id}>
                    <Link
                      href={`/avaliacoes/${a.id}`}
                      className="grid gap-2 rounded-ui border border-line p-3 hover:bg-muted/40 md:grid-cols-[2fr_1fr_1fr_1fr_auto] md:items-center"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{a.titulo}</p>
                        <p className="text-xs text-ink/55">{a.serie} {a.turma} · {a.disciplina}</p>
                      </div>
                      <span className={`inline-flex w-fit items-center rounded-pill px-2 py-0.5 text-[0.66rem] font-semibold uppercase ${TIPO_COLOR[a.tipo] ?? "bg-muted"}`}>
                        {TIPO_LABEL[a.tipo] ?? a.tipo}
                      </span>
                      <span className="text-xs text-ink/60">
                        Peso {a.peso} · max {a.valorMaximo}
                      </span>
                      <span className="text-xs">
                        <span className={`font-bold ${pct === 100 ? "text-success" : pct > 0 ? "text-warning" : "text-ink/40"}`}>
                          {a.notasLancadas}/{a.totalAlunos}
                        </span>
                        <span className="text-ink/55"> notas</span>
                      </span>
                      <ArrowRight size={14} className="text-ink/40 justify-self-end" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Panel>
        );
      })}
    </div>
  );
}
