import { CreditCard, Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { money } from "@/lib/constants";
import { getAcademicData } from "@/lib/data/lookups";
import { requirePermission } from "@/lib/auth/session";
import { NovoPlanoForm } from "@/components/pedagogico/novo-plano-form";
import { PlanoCard } from "@/components/pedagogico/plano-card";

export default async function PlanosPage() {
  await requirePermission("planos", "read");
  const { planos } = await getAcademicData();
  const activePlans = planos.filter((item) => item.ativo).length;
  const monthlyAverage = planos.length
    ? planos.reduce((sum, item) => sum + Number(item.valor_mensalidade ?? 0), 0) / planos.length
    : 0;

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Financeiro" }, { label: "Planos" }]}
        title="Planos"
        counter={planos.length.toLocaleString("pt-BR")}
        description="Regras de matrícula, mensalidade, parcelas e vencimento."
        actions={
          <ButtonLink href="/financeiro" variant="secondary">
            <CreditCard size={14} /> Financeiro
          </ButtonLink>
        }
        kpis={[
          { label: "Total",        value: planos.length.toLocaleString("pt-BR") },
          { label: "Ativos",       value: activePlans.toLocaleString("pt-BR"), tone: "success" },
          { label: "Inativos",     value: (planos.length - activePlans).toLocaleString("pt-BR"), tone: "danger" },
          { label: "Média mensal", value: money.format(monthlyAverage) }
        ]}
      />

      <Panel className="grid gap-5">
        <div>
          <p className="ds-kicker">Novo plano</p>
          <h2 className="mt-2 flex items-center gap-2 text-xl font-black text-ink">
            <Plus size={20} className="text-brand" />
            Cadastrar condicao financeira
          </h2>
        </div>
        <NovoPlanoForm />
      </Panel>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {planos.length === 0 ? (
          <Panel className="md:col-span-2 xl:col-span-3">
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-ink/60">
              <CreditCard size={28} />
              <p className="text-sm font-medium">Nenhum plano cadastrado.</p>
            </div>
          </Panel>
        ) : null}
        {planos.map((item) => (
          <PlanoCard key={item.id} item={item} />
        ))}
      </section>
    </div>
  );
}
