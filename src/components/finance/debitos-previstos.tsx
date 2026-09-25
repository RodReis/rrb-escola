import { money } from "@/lib/constants";
import { BaixarPrevistoForm } from "@/components/finance/baixar-previsto-form";
import type { DebitosData, MovimentoExtrato } from "@/lib/data/debitos";

function dateText(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function Debito({ mov }: { mov: MovimentoExtrato }) {
  return (
    <div className="text-sm">
      <div className="font-semibold">{mov.descricao}</div>
      <div className="text-xs text-ink/60 tabular-nums">
        {dateText(mov.data)} — {money.format(mov.valor)}
      </div>
    </div>
  );
}

export function DebitosPrevistos({ data }: { data: DebitosData }) {
  const { baixasUnicas, baixasAmbiguas } = data;

  if (baixasUnicas.length === 0 && baixasAmbiguas.length === 0) {
    return <p className="text-sm text-ink/60">Nenhum débito casa com um título a pagar em aberto.</p>;
  }

  return (
    <div className="grid gap-6">
      {baixasUnicas.length > 0 ? (
        <section className="grid gap-3">
          <h3 className="text-xs font-bold uppercase tracking-kicker text-ink/60">
            Casados com um título (o sync baixa sozinho; você pode adiantar)
          </h3>
          {baixasUnicas.map((b) => (
            <div key={b.debito.id} className="grid gap-2 rounded-lg border border-line p-3">
              <Debito mov={b.debito} />
              <BaixarPrevistoForm extratoId={b.debito.id} candidatos={[b.previsto]} />
            </div>
          ))}
        </section>
      ) : null}

      {baixasAmbiguas.length > 0 ? (
        <section className="grid gap-3">
          <h3 className="text-xs font-bold uppercase tracking-kicker text-ink/60">
            Mais de um título possível (escolha qual)
          </h3>
          {baixasAmbiguas.map((b) => (
            <div key={b.debito.id} className="grid gap-2 rounded-lg border border-line p-3">
              <Debito mov={b.debito} />
              <BaixarPrevistoForm extratoId={b.debito.id} candidatos={b.candidatos} />
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
