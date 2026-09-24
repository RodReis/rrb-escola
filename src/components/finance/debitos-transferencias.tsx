import { AlertTriangle, ArrowLeftRight } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/constants";
import { desfazerTransferenciaAction } from "@/lib/actions/debitos";
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
              <form action={desfazerTransferenciaAction}>
                <input type="hidden" name="id" value={par.id} />
                <Button type="submit" variant="ghost" className="text-xs">
                  Desfazer
                </Button>
              </form>
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
                Mais de um crédito candidato no mesmo valor e janela — confirme em &quot;A classificar&quot;
              </div>
              <div className="grid gap-1 text-sm">
                <p>
                  <span className="text-ink/50">Débito </span>
                  {dateText(amb.debito.data)} — <strong className="tabular-nums">{money.format(amb.debito.valor)}</strong>
                </p>
                <p className="text-xs text-ink/60">Candidatos a crédito:</p>
                <ul className="grid gap-0.5 pl-4 text-xs text-ink/70">
                  {amb.candidatos.map((c) => (
                    <li key={c.id} className="tabular-nums">
                      {dateText(c.data)} — {money.format(c.valor)}
                    </li>
                  ))}
                </ul>
              </div>
            </Panel>
          ))
        )}
      </section>
    </div>
  );
}
