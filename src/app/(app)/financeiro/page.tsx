import { ChevronLeft, ChevronRight, CreditCard, Plus } from "lucide-react";
import { ExportFinanceButton } from "@/components/pdf/export-finance-button";
import { ChargeEditForm } from "@/components/finance/charge-edit-form";
import { PaymentRow } from "@/components/finance/payment-row";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { cancelChargeAction, createChargeAction, payChargeAction } from "@/lib/actions/finance";
import { money } from "@/lib/constants";
import { getFinanceData } from "@/lib/data/finance";
import { getAcademicData } from "@/lib/data/lookups";
import { displayStatus, isUnpaid } from "@/lib/finance/charge-status";
import { saldoDevedor, totalPago } from "@/lib/finance/charge-totals";
import { requirePermission } from "@/lib/auth/session";

const statusTone: Record<string, StatusTone> = {
  aberta: "warning",
  vencida: "danger",
  parcial: "warning",
  paga: "success",
  cancelada: "neutral"
};

const formasPagamento = ["pix", "dinheiro", "cartao", "boleto", "transferencia"];

function dateText(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function mesLabel(competencia: string) {
  const [y, m] = competencia.split("-");
  const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${meses[Number(m) - 1]} ${y}`;
}

function adjacentMes(competencia: string, delta: number) {
  const [y, m] = competencia.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  await requirePermission("financeiro.cobrancas", "read");
  const params = await searchParams;
  const now = new Date();
  const defaultMes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const competencia = params.mes ?? defaultMes;

  const [{ alunos }, cobrancas] = await Promise.all([getAcademicData(), getFinanceData(competencia)]);
  const today = new Date().toISOString().slice(0, 10);

  let aVencer = 0;
  let vencido = 0;
  let pago = 0;
  let cancelado = 0;

  for (const item of cobrancas) {
    const pagamentos = (item.pagamentos ?? []) as Array<{ valor_pago: number | string; cancelado_em: string | null }>;
    const valorFinal = Number(item.valor_final ?? 0);
    const display = displayStatus(String(item.status), item.data_vencimento, today);

    if (display === "paga") {
      pago += totalPago(pagamentos);
    } else if (display === "cancelada") {
      cancelado += valorFinal;
    } else if (display === "vencida") {
      vencido += saldoDevedor(valorFinal, pagamentos);
    } else {
      aVencer += saldoDevedor(valorFinal, pagamentos);
    }
  }

  const emAbertoTotal = aVencer + vencido;

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Gestão", href: "/" }, { label: "Financeiro" }]}
        title="Cobranças"
        counter={mesLabel(competencia)}
        description="Lançamento, baixa parcial, estorno e exportação de cobranças escolares."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href={`/financeiro?mes=${adjacentMes(competencia, -1)}`} variant="secondary" className="px-2">
              <ChevronLeft size={14} />
            </ButtonLink>
            <span className="min-w-[140px] text-center text-sm font-semibold text-ink">{mesLabel(competencia)}</span>
            <ButtonLink href={`/financeiro?mes=${adjacentMes(competencia, 1)}`} variant="secondary" className="px-2">
              <ChevronRight size={14} />
            </ButtonLink>
            <span className="mx-2 h-5 w-px bg-line" />
            <ExportFinanceButton rows={cobrancas} />
            <ButtonLink href="/planos" variant="secondary">
              <CreditCard size={14} /> Planos
            </ButtonLink>
          </div>
        }
        kpis={[
          { label: "Cobranças", value: cobrancas.length.toLocaleString("pt-BR") },
          { label: "A vencer",  value: money.format(aVencer) },
          { label: "Vencido",   value: money.format(vencido), tone: "danger" },
          { label: "Em aberto", value: money.format(emAbertoTotal), tone: "warning" },
          { label: "Pago",      value: money.format(pago), tone: "success" },
          { label: "Cancelado", value: money.format(cancelado) }
        ]}
      />

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
          <label className="md:col-span-2">Descricao<input name="descricao" required /></label>
          <label>Competencia<input name="competencia" placeholder="2026-05" /></label>
          <label>Parcela<input name="numero_parcela" type="number" /></label>
          <label>Valor<input name="valor_original" inputMode="decimal" /></label>
          <label>Desconto<input name="valor_desconto" inputMode="decimal" /></label>
          <label>Acrescimo<input name="valor_acrescimo" inputMode="decimal" /></label>
          <label>Vencimento<input name="data_vencimento" type="date" /></label>
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
          const pagamentos = (item.pagamentos ?? []) as Array<{
            id: string;
            valor_pago: number | string;
            data_pagamento: string;
            forma_pagamento: string;
            observacao: string | null;
            cancelado_em: string | null;
            cancelado_por: string | null;
            motivo_cancelamento: string | null;
            registrado_por: string | null;
            perfis: { nome: string } | null;
          }>;
          const display = displayStatus(String(item.status), item.data_vencimento, today);
          const settled = display === "paga" || display === "cancelada";
          const tone = statusTone[display];
          const valorFinal = Number(item.valor_final ?? 0);
          const saldo = saldoDevedor(valorFinal, pagamentos);
          const alunoInfo = item.alunos ?? { nome: "Sem aluno", matricula_codigo: "" };

          return (
            <Panel key={item.id} className="grid gap-3">
              <div className="grid gap-4 lg:grid-cols-[1fr_170px_360px] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-ink">{item.descricao}</strong>
                    <StatusPill tone={tone}>{display}</StatusPill>
                  </div>
                  <p className="mt-1 text-sm text-ink/65">
                    {alunoInfo.nome} - vence em {dateText(item.data_vencimento)} - {item.competencia}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-ink/50">Saldo</p>
                  <strong className="mt-1 block text-2xl text-brand">{money.format(saldo)}</strong>
                  <span className="text-xs text-muted">de {money.format(valorFinal)}</span>
                </div>

                {settled ? (
                  <div className="justify-self-start lg:justify-self-end">
                    <StatusPill tone={display === "paga" ? "success" : "neutral"}>
                      {display === "paga" ? "Pago" : "Cancelada"}
                    </StatusPill>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    <form action={payChargeAction} className="grid gap-2">
                      <input type="hidden" name="cobranca_id" value={item.id} />
                      <input type="hidden" name="aluno_id" value={item.aluno_id} />
                      <div className="grid grid-cols-[1fr_110px] gap-2">
                        <input name="valor_pago" defaultValue={saldo.toFixed(2)} inputMode="decimal" placeholder="Valor" />
                        <select name="forma_pagamento" defaultValue="pix">
                          {formasPagamento.map((f) => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-[140px_1fr_96px] gap-2">
                        <input name="data_pagamento" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
                        <input name="observacao" placeholder="Observacao" />
                        <button className="ds-button ds-button-primary min-h-0 px-3 py-2 text-xs" type="submit">Pagar</button>
                      </div>
                    </form>
                    <details className="text-xs">
                      <summary className="cursor-pointer text-ink/60">Editar valores</summary>
                      <div className="mt-2">
                        <ChargeEditForm charge={{
                          id: item.id,
                          descricao: item.descricao,
                          data_vencimento: item.data_vencimento,
                          valor_desconto: item.valor_desconto ?? 0,
                          valor_acrescimo: item.valor_acrescimo ?? 0
                        }} />
                      </div>
                    </details>
                    <form action={cancelChargeAction} className="text-right">
                      <input type="hidden" name="cobranca_id" value={item.id} />
                      <button className="text-xs font-black text-clay" type="submit">Cancelar cobranca</button>
                    </form>
                  </div>
                )}
              </div>

              {pagamentos.length > 0 ? (
                <details className="rounded-ui border border-line">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-ink/60">
                    Pagamentos ({pagamentos.filter((p) => !p.cancelado_em).length}/{pagamentos.length})
                  </summary>
                  <div className="grid gap-1 px-3 pb-3">
                    {pagamentos.map((p, idx) => {
                      // Saldo após este pagamento, considerando ordem cronológica e ignorando cancelados.
                      const acumulado = pagamentos
                        .slice(0, idx + 1)
                        .filter((pp) => !pp.cancelado_em)
                        .reduce((sum, pp) => sum + Number(pp.valor_pago), 0);
                      const saldoApos = Math.max(valorFinal - acumulado, 0);
                      return (
                        <PaymentRow
                          key={p.id}
                          pagamento={p}
                          cobranca={{
                            id: item.id,
                            descricao: item.descricao,
                            competencia: item.competencia,
                            numero_parcela: item.numero_parcela,
                            valor_final: valorFinal,
                            valor_original: item.valor_original,
                            valor_desconto: item.valor_desconto ?? 0,
                            valor_acrescimo: item.valor_acrescimo ?? 0
                          }}
                          aluno={alunoInfo}
                          saldoApos={saldoApos}
                        />
                      );
                    })}
                  </div>
                </details>
              ) : null}
            </Panel>
          );
        })}
      </section>
    </div>
  );
}
