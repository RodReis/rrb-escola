import { Suspense } from "react";
import { OrganogramaSidebar } from "@/components/organograma/sidebar";
import { OrganogramaDrillPanel } from "@/components/organograma/drill-panel";
import { PageHeader } from "@/components/ui/page-header";
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
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Secretaria" }, { label: "Organograma" }]}
        title="Organograma"
        counter="de alunos"
        description="Visualização hierárquica por segmento, série e turma."
      />

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
