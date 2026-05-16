import { Suspense } from "react";
import { OrganogramaSidebar } from "@/components/organograma/sidebar";
import { OrganogramaDrillPanel } from "@/components/organograma/drill-panel";
import { getOrganogramaTree, getOrganogramaDrill } from "@/lib/data/organograma";

export default async function OrganogramaPage({
  searchParams
}: {
  searchParams: Promise<{ turma?: string }>;
}) {
  const params = await searchParams;
  const turmaId = params.turma ?? null;

  const [{ tree, totalAlunos }, drillData] = await Promise.all([
    getOrganogramaTree(),
    turmaId ? getOrganogramaDrill(turmaId) : Promise.resolve({ turma: null, alunos: [], somaSala: 0, ticketMedio: 0, competencia: "" })
  ]);

  return (
    <div className="grid gap-6">
      <section className="-mx-4 -mt-6 border-b border-line bg-surface px-4 py-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="flex items-center gap-3 text-[0.66rem] font-black uppercase tracking-[0.16em] text-ink/58">
            <span>Secretaria</span>
            <span className="text-line">/</span>
            <span className="text-brand">Organograma</span>
          </p>
          <h1 className="mt-4 text-4xl font-black leading-none text-brand md:text-5xl">
            Organograma <span className="font-serif italic text-ink/42">de alunos</span>
          </h1>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-7xl gap-8">
        <Suspense fallback={<div className="w-[280px]" />}>
          <OrganogramaSidebar
            tree={tree}
            totalAlunos={totalAlunos}
            escolaNome="Colégio RRB"
            turmaAtiva={params.turma ?? null}
          />
        </Suspense>
        <OrganogramaDrillPanel data={drillData} />
      </div>
    </div>
  );
}
