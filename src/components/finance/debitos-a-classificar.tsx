import { Panel } from "@/components/ui/card";
import { money } from "@/lib/constants";
import { ClassificarDebitoForm } from "@/components/finance/classificar-debito-form";
import { IgnorarDebitoForm } from "@/components/finance/ignorar-debito-form";
import type { DebitosData } from "@/lib/data/debitos";

function dateText(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

/**
 * Fila "A classificar", agrupada por contraparte. Classificar o grupo inteiro
 * de uma vez é o que torna 157 contrapartes um trabalho de uma tarde em vez
 * de 1.169 cliques — mas cada movimento do grupo pode ser desmarcado no
 * formulário antes de confirmar (C3: grupo não é tudo-ou-nada).
 *
 * "Ignorar" fica por movimento avulso, fora do formulário de classificação —
 * é uma decisão diferente ("isto não é despesa") de "classificar como X".
 */
export function DebitosAClassificar({ data }: { data: DebitosData }) {
  const contaCompanyPor = new Map(data.contas.map((c) => [c.id, c.companyId]));

  if (data.aClassificar.length === 0) {
    return (
      <Panel>
        <p className="py-8 text-center text-sm text-ink/60">Nenhum movimento pendente de classificação.</p>
      </Panel>
    );
  }

  return (
    <section className="grid gap-3">
      {data.aClassificar.map((grupo) => {
        const primeiro = grupo.movimentos[0];
        const ultimo = grupo.movimentos[grupo.movimentos.length - 1];
        return (
          <Panel key={grupo.chave} className="grid gap-3">
            <div className="grid gap-3 lg:grid-cols-[1fr_140px_140px] lg:items-center">
              <div>
                <p className="font-semibold text-ink">{grupo.documento ?? grupo.descricao}</p>
                <p className="text-xs text-ink/60">
                  {grupo.movimentos.length} movimento(s) · {dateText(primeiro.data)}
                  {grupo.movimentos.length > 1 ? ` — ${dateText(ultimo.data)}` : ""}
                </p>
              </div>
              <strong className="tabular-nums text-clay lg:text-right">{money.format(grupo.total)}</strong>
              {grupo.movimentos.length === 1 ? (
                <div className="lg:justify-self-end">
                  <IgnorarDebitoForm extratoId={primeiro.id} />
                </div>
              ) : (
                <span className="text-xs text-ink/50 lg:text-right">
                  {grupo.movimentos.length} lançamento(s)
                </span>
              )}
            </div>

            <ClassificarDebitoForm
              movimentos={grupo.movimentos}
              documento={grupo.documento}
              contaCompanyId={contaCompanyPor.get(primeiro.contaId) ?? null}
              categorias={data.categorias}
              companies={data.companies}
            />
          </Panel>
        );
      })}
    </section>
  );
}
