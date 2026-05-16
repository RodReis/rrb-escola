import { CreditCard, Plus } from "lucide-react";
import { createPlanAction, togglePlanAction, updatePlanAction } from "@/lib/actions/academics";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { money } from "@/lib/constants";
import { getAcademicData } from "@/lib/data/lookups";

export default async function PlanosPage() {
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
          <h2 className="mt-2 text-xl font-black text-ink">Cadastrar condicao financeira</h2>
        </div>
        <form action={createPlanAction} className="grid gap-4 md:grid-cols-6">
          <label className="md:col-span-2">
            Nome
            <input name="nome" required />
          </label>
          <label>
            Matricula
            <input name="valor_matricula" inputMode="decimal" />
          </label>
          <label>
            Mensalidade
            <input name="valor_mensalidade" inputMode="decimal" />
          </label>
          <label>
            Parcelas
            <input name="quantidade_parcelas" type="number" defaultValue={12} />
          </label>
          <label>
            Vencimento
            <input name="dia_vencimento" type="number" defaultValue={10} />
          </label>
          <label className="md:col-span-5">
            Descricao
            <input name="descricao" />
          </label>
          <button className="ds-button ds-button-primary self-end">
            <Plus size={14} /> Adicionar
          </button>
        </form>
      </Panel>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {planos.length === 0 ? (
          <Panel>
            <p className="text-sm font-medium text-ink/60">Nenhum plano cadastrado.</p>
          </Panel>
        ) : null}
        {planos.map((item) => (
          <Panel key={item.id} className="grid gap-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-ink">{item.nome}</h2>
                <p className="mt-1 text-sm text-ink/65">{item.descricao || "Sem descricao"}</p>
              </div>
              <StatusPill tone={item.ativo ? "success" : "danger"}>{item.ativo ? "Ativo" : "Inativo"}</StatusPill>
            </div>

            <form action={updatePlanAction} className="grid gap-3">
              <input type="hidden" name="id" value={item.id} />
              <div className="grid gap-3 md:grid-cols-2">
                <label>
                  Nome
                  <input name="nome" defaultValue={item.nome} required />
                </label>
                <label>
                  Vencimento
                  <input name="dia_vencimento" type="number" defaultValue={item.dia_vencimento} />
                </label>
                <label>
                  Matricula
                  <input name="valor_matricula" inputMode="decimal" defaultValue={Number(item.valor_matricula ?? 0)} />
                </label>
                <label>
                  Mensalidade
                  <input name="valor_mensalidade" inputMode="decimal" defaultValue={Number(item.valor_mensalidade ?? 0)} />
                </label>
                <label>
                  Parcelas
                  <input name="quantidade_parcelas" type="number" defaultValue={item.quantidade_parcelas} />
                </label>
                <label className="flex grid-cols-none items-center gap-2 self-end pb-3">
                  <input name="ativo" type="checkbox" className="h-4 w-4" defaultChecked={item.ativo} />
                  Ativo
                </label>
              </div>
              <label>
                Descricao
                <input name="descricao" defaultValue={item.descricao ?? ""} />
              </label>
              <button className="ds-button ds-button-primary justify-self-start">Salvar plano</button>
            </form>

            <div className="grid grid-cols-2 gap-3 border-y border-line py-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-ink/50">Mensalidade</p>
                <strong className="mt-2 block text-xl text-brand">{money.format(Number(item.valor_mensalidade))}</strong>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-ink/50">Matricula</p>
                <strong className="mt-2 block text-xl text-brand">{money.format(Number(item.valor_matricula))}</strong>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-ink/50">Parcelas</p>
                <strong className="mt-2 block text-xl text-ink">{item.quantidade_parcelas}</strong>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-ink/50">Vencimento</p>
                <strong className="mt-2 block text-xl text-ink">Dia {item.dia_vencimento}</strong>
              </div>
            </div>

            <form action={togglePlanAction}>
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="ativo" value={item.ativo ? "" : "on"} />
              <button className="text-xs font-black text-clay">{item.ativo ? "Desativar plano" : "Ativar plano"}</button>
            </form>
          </Panel>
        ))}
      </section>
    </div>
  );
}
