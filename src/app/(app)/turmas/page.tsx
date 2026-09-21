import { GraduationCap, Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getAcademicData } from "@/lib/data/lookups";
import { requirePermission } from "@/lib/auth/session";
import { TurmaCard } from "@/components/pedagogico/turma-card";
import { NovaTurmaForm } from "@/components/pedagogico/nova-turma-form";

export default async function TurmasPage() {
  await requirePermission("turmas", "read");
  const { series, turmas } = await getAcademicData();
  const activeClasses = turmas.filter((item) => item.ativo).length;
  const currentYear = new Date().getFullYear();
  const currentYearClasses = turmas.filter((item) => Number(item.ano_letivo) === currentYear).length;

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Acadêmico" }, { label: "Turmas" }]}
        title="Turmas"
        counter={turmas.length.toLocaleString("pt-BR")}
        description="Organização das salas por série, turno, capacidade e ano letivo."
        actions={
          <ButtonLink href="/series" variant="secondary">
            <GraduationCap size={14} /> Ver séries
          </ButtonLink>
        }
        kpis={[
          { label: "Total",     value: turmas.length.toLocaleString("pt-BR") },
          { label: "Ativas",    value: activeClasses.toLocaleString("pt-BR"), tone: "success" },
          { label: "Ano atual", value: currentYearClasses.toLocaleString("pt-BR") },
          { label: "Séries",    value: series.length.toLocaleString("pt-BR") }
        ]}
      />

      <Panel className="grid gap-5">
        <div>
          <p className="ds-kicker">Nova turma</p>
          <h2 className="mt-2 flex items-center gap-2 text-xl font-black text-ink">
            <Plus size={20} className="text-brand" />
            Cadastrar sala e turno
          </h2>
        </div>
        <NovaTurmaForm series={series} currentYear={currentYear} />
      </Panel>

      <section className="grid gap-3">
        {turmas.length === 0 ? (
          <Panel>
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-ink/60">
              <GraduationCap size={28} />
              <p className="text-sm font-medium">Nenhuma turma cadastrada.</p>
            </div>
          </Panel>
        ) : null}
        {turmas.map((item) => (
          <TurmaCard key={item.id} item={item} series={series} />
        ))}
      </section>
    </div>
  );
}
