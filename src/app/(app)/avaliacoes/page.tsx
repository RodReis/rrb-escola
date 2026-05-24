import Link from "next/link";
import { ClipboardEdit, ClipboardList, Plus, Users, GraduationCap } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { listAvaliacoes } from "@/lib/data/pedagogico";
import { requirePermission } from "@/lib/auth/session";

const TIPO_LABEL: Record<string, string> = {
  prova: "Prova",
  trabalho: "Trabalho",
  participacao: "Particip.",
  simulado: "Simulado",
  outro: "Bim.",
};

const TIPO_COLOR: Record<string, string> = {
  prova: "border-brand/40 bg-brand/5 text-brand",
  trabalho: "border-accent/40 bg-accent/5 text-accent",
  participacao: "border-moss/40 bg-moss/5 text-moss",
  simulado: "border-warning/40 bg-warning/5 text-warning",
  outro: "border-line bg-muted text-ink/60",
};

function isValidBim(v: string | undefined): v is "1" | "2" | "3" | "4" {
  return v === "1" || v === "2" || v === "3" || v === "4";
}

export default async function AvaliacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ bim?: string }>;
}) {
  await requirePermission("avaliacoes", "read");
  const sp = await searchParams;
  const avaliacoes = await listAvaliacoes();

  // Agrupa: bimestre → série → turma → avaliações
  type AvalRow = (typeof avaliacoes)[number];
  const arvore = new Map<number, Map<string, Map<string, AvalRow[]>>>();
  for (const a of avaliacoes) {
    let porSerie = arvore.get(a.bimestre);
    if (!porSerie) {
      porSerie = new Map();
      arvore.set(a.bimestre, porSerie);
    }
    let porTurma = porSerie.get(a.serie);
    if (!porTurma) {
      porTurma = new Map();
      porSerie.set(a.serie, porTurma);
    }
    const arr = porTurma.get(a.turma) ?? [];
    arr.push(a);
    porTurma.set(a.turma, arr);
  }

  const bimsExistentes = Array.from(arvore.keys()).sort();
  const todosBims = [1, 2, 3, 4] as const;
  const bimAtivo = isValidBim(sp.bim)
    ? Number(sp.bim)
    : (bimsExistentes[0] ?? 1);

  const porSerie = arvore.get(bimAtivo) ?? new Map<string, Map<string, AvalRow[]>>();
  const seriesDoBim = Array.from(porSerie.keys()).sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );

  // Contagens por bim pros tabs
  const countPorBim = new Map<number, number>();
  for (const b of todosBims) {
    const ps = arvore.get(b);
    if (!ps) {
      countPorBim.set(b, 0);
      continue;
    }
    let total = 0;
    ps.forEach((pt) => pt.forEach((arr) => (total += arr.length)));
    countPorBim.set(b, total);
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "Pedagógico" }, { label: "Avaliações" }]}
        title="Avaliações"
        counter={avaliacoes.length.toString()}
        description="Provas, trabalhos e notas bimestrais por série e turma."
        actions={
          <>
            <ButtonLink href="/avaliacoes/lancamento" variant="primary">
              <ClipboardEdit size={14} /> Lançar notas
            </ButtonLink>
            <ButtonLink href="/avaliacoes/nova" variant="secondary">
              <Plus size={14} /> Nova avaliação
            </ButtonLink>
          </>
        }
      />

      {avaliacoes.length === 0 ? (
        <Panel>
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-ink/40">
            <ClipboardList size={28} />
            <p className="text-sm font-medium">Nenhuma avaliação cadastrada.</p>
            <ButtonLink href="/avaliacoes/lancamento" variant="ghost" className="mt-2">
              <ClipboardEdit size={14} /> Começar lançamento
            </ButtonLink>
          </div>
        </Panel>
      ) : (
        <>
          {/* Tabs Bimestre */}
          <nav className="flex gap-1 border-b border-line">
            {todosBims.map((b) => {
              const ativo = b === bimAtivo;
              const total = countPorBim.get(b) ?? 0;
              return (
                <Link
                  key={b}
                  href={`/avaliacoes?bim=${b}`}
                  className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition ${
                    ativo ? "text-brand" : "text-ink/55 hover:text-ink"
                  }`}
                >
                  {b}º Bimestre
                  <span
                    className={`inline-flex min-w-[1.75rem] justify-center rounded-pill px-1.5 py-0.5 text-[0.66rem] font-bold ${
                      ativo ? "bg-brand text-paper" : "bg-muted text-ink/60"
                    }`}
                  >
                    {total}
                  </span>
                  {ativo && (
                    <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand" />
                  )}
                </Link>
              );
            })}
          </nav>

          {seriesDoBim.length === 0 ? (
            <div className="rounded-ui bg-muted/30 p-10 text-center text-ink/40">
              <ClipboardList className="mx-auto mb-2" size={24} />
              <p className="text-sm">Nenhuma avaliação neste bimestre.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {seriesDoBim.map((serie) => {
                const porTurma = porSerie.get(serie)!;
                const turmas = Array.from(porTurma.keys()).sort((a, b) =>
                  a.localeCompare(b, "pt-BR"),
                );
                const totalSerie = turmas.reduce(
                  (s, t) => s + (porTurma.get(t)?.length ?? 0),
                  0,
                );
                return (
                  <Panel key={serie} className="grid gap-3 p-4">
                    <header className="flex items-center justify-between gap-3 border-b border-line/60 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="grid h-7 w-7 place-items-center rounded-ui bg-brand/10 text-brand">
                          <GraduationCap size={14} />
                        </span>
                        <h3 className="text-sm font-bold text-ink">{serie}</h3>
                      </div>
                      <span className="text-[0.66rem] font-semibold uppercase tracking-kicker text-ink/45">
                        {totalSerie} avaliaç{totalSerie === 1 ? "ão" : "ões"}
                      </span>
                    </header>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {turmas.map((turma) => {
                        const lista = porTurma.get(turma)!;
                        return (
                          <div
                            key={turma}
                            className="grid gap-2 rounded-ui bg-muted/30 p-3"
                          >
                            <div className="flex items-center gap-1.5 text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">
                              <Users size={11} /> Turma {turma}
                              <span className="ml-auto rounded-pill bg-surface px-1.5 text-[0.6rem] text-ink/60">
                                {lista.length}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {lista.map((a) => {
                                const pct =
                                  a.totalAlunos > 0
                                    ? (a.notasLancadas / a.totalAlunos) * 100
                                    : 0;
                                const tone =
                                  pct === 100
                                    ? "text-success"
                                    : pct > 0
                                      ? "text-warning"
                                      : "text-ink/40";
                                return (
                                  <Link
                                    key={a.id}
                                    href={`/avaliacoes/${a.id}`}
                                    title={`${a.titulo} · ${a.disciplina}`}
                                    className={`group inline-flex max-w-full items-center gap-1.5 rounded-pill border px-2.5 py-1 text-xs transition hover:shadow-soft ${
                                      TIPO_COLOR[a.tipo] ?? TIPO_COLOR.outro
                                    }`}
                                  >
                                    <span className="truncate font-bold">
                                      {a.disciplina}
                                    </span>
                                    <span className={`text-[0.66rem] font-bold ${tone}`}>
                                      {a.notasLancadas}/{a.totalAlunos}
                                    </span>
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Panel>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
