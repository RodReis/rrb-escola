import { AlertTriangle, ArrowLeftRight, Landmark } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { money } from "@/lib/constants";
import { DesfazerTransferenciaButton } from "@/components/finance/desfazer-transferencia-button";
import { ConfirmarContaPropriaButton } from "@/components/finance/confirmar-conta-propria-button";
import { ResolverAmbiguoForm } from "@/components/finance/resolver-ambiguo-form";
import { IgnorarDebitoForm } from "@/components/finance/ignorar-debito-form";
import type { DebitosData } from "@/lib/data/debitos";

function dateText(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

/** Pares automáticos (com "desfazer") e ambíguos (candidatos empatados, escolha manual). */
export function DebitosTransferencias({ data }: { data: DebitosData }) {
  return (
    <div className="grid gap-6">
      <section className="grid gap-3">
        <h3 className="text-xs font-bold uppercase tracking-kicker text-ink/60">Pares automáticos</h3>
        {data.transferenciasAuto.length === 0 ? (
          <Panel>
            <p className="py-6 text-center text-sm text-ink/60">Nenhuma transferência interna detectada.</p>
          </Panel>
        ) : (
          data.transferenciasAuto.map((par) => (
            <Panel key={par.id} className="grid gap-3 lg:grid-cols-[130px_1fr_1fr_auto] lg:items-center">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-ink/60">
                <ArrowLeftRight size={13} /> {dateText(par.debito.data)}
              </span>
              <div>
                <p className="text-xs text-ink/50">Débito</p>
                <p className="font-semibold tabular-nums text-clay">{money.format(par.debito.valor)}</p>
              </div>
              <div>
                <p className="text-xs text-ink/50">Crédito</p>
                <p className="font-semibold tabular-nums text-moss">
                  {par.credito ? money.format(par.credito.valor) : "—"}
                </p>
              </div>
              <DesfazerTransferenciaButton id={par.id} />
            </Panel>
          ))
        )}
      </section>

      <section className="grid gap-3">
        <h3 className="text-xs font-bold uppercase tracking-kicker text-ink/60">Ambíguos — escolha manual</h3>
        {data.transferenciasAmbiguas.length === 0 ? (
          <Panel>
            <p className="py-6 text-center text-sm text-ink/60">Nenhum caso ambíguo.</p>
          </Panel>
        ) : (
          data.transferenciasAmbiguas.map((amb) => (
            <Panel key={amb.debito.id} className="grid gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-warning">
                <AlertTriangle size={13} />
                Mais de um crédito candidato no mesmo valor e janela — escolha o certo ou ignore com motivo
              </div>
              <div className="grid gap-1 text-sm">
                <p>
                  <span className="text-ink/50">Débito </span>
                  {dateText(amb.debito.data)} — <strong className="tabular-nums">{money.format(amb.debito.valor)}</strong>
                </p>
              </div>
              <ResolverAmbiguoForm debitoId={amb.debito.id} candidatos={amb.candidatos} />
              <div className="flex justify-end">
                <IgnorarDebitoForm extratoId={amb.debito.id} />
              </div>
            </Panel>
          ))
        )}
      </section>

      <section className="grid gap-3">
        <h3 className="text-xs font-bold uppercase tracking-kicker text-ink/60">
          Conta própria sem par (D2)
        </h3>
        {data.contaPropriaSemPar.length === 0 ? (
          <Panel>
            <p className="py-6 text-center text-sm text-ink/60">Nenhum caso no momento.</p>
          </Panel>
        ) : (
          data.contaPropriaSemPar.map((mov) => (
            <Panel key={mov.id} className="grid gap-3 lg:grid-cols-[130px_1fr_auto_auto] lg:items-center">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-ink/60">
                <Landmark size={13} /> {dateText(mov.data)}
              </span>
              <p className="text-sm text-ink/70">{mov.descricao}</p>
              <strong className="tabular-nums text-clay lg:text-right">{money.format(mov.valor)}</strong>
              <ConfirmarContaPropriaButton extratoId={mov.id} />
            </Panel>
          ))
        )}
      </section>
    </div>
  );
}
