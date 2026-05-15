import { CreditCard, Plus } from "lucide-react";
import { createPlanAction, togglePlanAction, updatePlanAction } from "@/lib/actions/academics";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, Panel } from "@/components/ui/card";
import { money } from "@/lib/constants";
import { getAcademicData } from "@/lib/data/lookups";

export default async function PlanosPage() {
  const { planos } = await getAcademicData();
  const activePlans = planos.filter((item) => item.ativo).length;
  const monthlyAverage = planos.length
    ? planos.reduce((sum, item) => sum + Number(item.valor_mensalidade ?? 0), 0) / planos.length
    : 0;

  const summary = [
    ["Total", String(planos.length)],
    ["Ativos", String(activePlans)],
    ["Inativos", String(planos.length - activePlans)],
    ["Media mensal", money.format(monthlyAverage)]
  ];

  return (
    <div className="grid gap-6">
      <section className="-mx-4 -mt-6 border-b border-line bg-surface px-4 py-8 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="flex items-center gap-3 text-[0.66rem] font-black uppercase tracking-[0.16em] text-ink/58">
              <span>Financeiro</span>
              <span className="text-line">/</span>
              <span className="text-brand">Planos</span>
            </p>
            <h1 className="mt-8 text-4xl font-black leading-none text-brand md:text-5xl">
              Planos <span className="font-serif italic text-ink/42">{planos.length}</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-ink/68">
              Regras de matricula, mensalidade, parcelas e vencimento usadas na geracao de cobrancas.
            </p>
          </div>

          <div className="grid gap-7">
            <div className="flex flex-wrap gap-2 xl:justify-end">
              <ButtonLink href="/financeiro" variant="secondary">
                <CreditCard size={16} /> Financeiro
              </ButtonLink>
            </div>
            <dl className="grid gap-0 sm:grid-cols-4">
              {summary.map(([label, value]) => (
                <div key={label} className="border-line py-1 sm:border-l sm:px-6 first:sm:border-l-0">
                  <dt className="text-xs font-medium text-ink/62">{label}</dt>
                  <dd className="mt-1 font-serif text-2xl italic leading-none text-brand">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {summary.map(([label, value]) => (
          <Card key={label} className="p-5">
            <p className="ds-kicker">{label}</p>
            <strong className="mt-3 block text-3xl font-black text-ink">{value}</strong>
          </Card>
        ))}
      </section>

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
          <button className="ds-button ds-button-accent self-end">
            <Plus size={16} /> Adicionar
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
              <Badge tone={item.ativo ? "green" : "red"}>{item.ativo ? "Ativo" : "Inativo"}</Badge>
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
