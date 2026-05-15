import { CreditCard, Plus } from "lucide-react";
import { ExportFinanceButton } from "@/components/pdf/export-finance-button";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, Panel } from "@/components/ui/card";
import { cancelChargeAction, createChargeAction, payChargeAction } from "@/lib/actions/finance";
import { money } from "@/lib/constants";
import { getFinanceData } from "@/lib/data/finance";
import { getAcademicData } from "@/lib/data/lookups";

const statusTone = {
  aberta: "gold",
  vencida: "red",
  parcial: "gold",
  paga: "green",
  cancelada: "gray"
} as const;

function dateText(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

export default async function FinanceiroPage() {
  const [{ alunos }, cobrancas] = await Promise.all([getAcademicData(), getFinanceData()]);

  const totalAberto = cobrancas
    .filter((item) => !["paga", "cancelada"].includes(String(item.status)))
    .reduce((sum, item) => sum + Number(item.valor_final ?? 0), 0);
  const totalPago = cobrancas
    .filter((item) => item.status === "paga")
    .reduce((sum, item) => sum + Number(item.valor_final ?? 0), 0);
  const totalCancelado = cobrancas
    .filter((item) => item.status === "cancelada")
    .reduce((sum, item) => sum + Number(item.valor_final ?? 0), 0);

  const summary = [
    ["Cobrancas", String(cobrancas.length)],
    ["Em aberto", money.format(totalAberto)],
    ["Pago", money.format(totalPago)],
    ["Cancelado", money.format(totalCancelado)]
  ];

  return (
    <div className="grid gap-6">
      <section className="-mx-4 -mt-6 border-b border-line bg-surface px-4 py-8 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="flex items-center gap-3 text-[0.66rem] font-black uppercase tracking-[0.16em] text-ink/58">
              <span>Gestao</span>
              <span className="text-line">/</span>
              <span className="text-brand">Financeiro</span>
            </p>
            <h1 className="mt-8 text-4xl font-black leading-none text-brand md:text-5xl">
              Cobrancas <span className="font-serif italic text-ink/42">{cobrancas.length}</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-ink/68">
              Lancamento, baixa, cancelamento e exportacao de cobrancas escolares.
            </p>
          </div>

          <div className="grid gap-7">
            <div className="flex flex-wrap gap-2 xl:justify-end">
              <ExportFinanceButton rows={cobrancas} />
              <ButtonLink href="/planos" variant="secondary">
                <CreditCard size={16} /> Planos
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
          <p className="ds-kicker">Nova cobranca</p>
          <h2 className="mt-2 text-xl font-black text-ink">Gerar lancamento avulso</h2>
        </div>
        <form action={createChargeAction} className="grid gap-4 md:grid-cols-6">
          <label className="md:col-span-2">
            Aluno
            <select name="aluno_id" required>
              {alunos.map((item) => (
                <option key={item.id} value={item.id}>{item.nome}</option>
              ))}
            </select>
          </label>
          <label className="md:col-span-2">
            Descricao
            <input name="descricao" required />
          </label>
          <label>
            Competencia
            <input name="competencia" placeholder="2026-05" />
          </label>
          <label>
            Parcela
            <input name="numero_parcela" type="number" />
          </label>
          <label>
            Valor
            <input name="valor_original" inputMode="decimal" />
          </label>
          <label>
            Desconto
            <input name="valor_desconto" inputMode="decimal" />
          </label>
          <label>
            Acrescimo
            <input name="valor_acrescimo" inputMode="decimal" />
          </label>
          <label>
            Vencimento
            <input name="data_vencimento" type="date" />
          </label>
          <button className="ds-button ds-button-accent self-end">
            <Plus size={16} /> Gerar
          </button>
        </form>
      </Panel>

      <section className="grid gap-3">
        {cobrancas.length === 0 ? (
          <Panel>
            <p className="text-sm font-medium text-ink/60">Nenhuma cobranca cadastrada.</p>
          </Panel>
        ) : null}
        {cobrancas.map((item) => {
          const settled = item.status === "paga" || item.status === "cancelada";
          const tone = statusTone[item.status as keyof typeof statusTone] ?? "gray";

          return (
            <Panel key={item.id} className="grid gap-4 lg:grid-cols-[1fr_170px_360px] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-ink">{item.descricao}</strong>
                  <Badge tone={tone}>{item.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-ink/65">
                  {item.alunos?.nome ?? "Sem aluno"} - vence em {dateText(item.data_vencimento)} - {item.competencia}
                </p>
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-ink/50">Valor</p>
                <strong className="mt-1 block text-2xl text-brand">{money.format(Number(item.valor_final))}</strong>
              </div>

              {settled ? (
                <div className="justify-self-start lg:justify-self-end">
                  <Badge tone={item.status === "paga" ? "green" : "gray"}>
                    {item.status === "paga" ? "Pago" : "Cancelada"}
                  </Badge>
                </div>
              ) : (
                <div className="grid gap-2">
                  <form action={payChargeAction} className="grid grid-cols-[1fr_96px] gap-2">
                    <input type="hidden" name="cobranca_id" value={item.id} />
                    <input type="hidden" name="aluno_id" value={item.aluno_id} />
                    <input name="valor_pago" defaultValue={Number(item.valor_final).toFixed(2)} inputMode="decimal" />
                    <button className="ds-button ds-button-primary min-h-0 px-3 py-2 text-xs">Pagar</button>
                  </form>
                  <form action={cancelChargeAction} className="text-right">
                    <input type="hidden" name="cobranca_id" value={item.id} />
                    <button className="text-xs font-black text-clay">Cancelar cobranca</button>
                  </form>
                </div>
              )}
            </Panel>
          );
        })}
      </section>
    </div>
  );
}
