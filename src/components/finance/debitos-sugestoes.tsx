import { Panel } from "@/components/ui/card";
import { money } from "@/lib/constants";
import { ClassificarDebitoForm } from "@/components/finance/classificar-debito-form";
import type { DebitosData } from "@/lib/data/debitos";

function dateText(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function competenciaDe(data: string) {
  return data.slice(0, 7);
}

/** O que a regra de contraparte já reconheceu. Confirmar cria o lançamento; a sugestão nunca lança sozinha (D1). */
export function DebitosSugestoes({ data }: { data: DebitosData }) {
  const contaCompanyPor = new Map(data.contas.map((c) => [c.id, c.companyId]));

  if (data.sugestoes.length === 0) {
    return (
      <Panel>
        <p className="py-8 text-center text-sm text-ink/60">Nenhuma sugestão no momento.</p>
      </Panel>
    );
  }

  return (
    <section className="grid gap-3">
      {data.sugestoes.map((s) => (
        <Panel key={s.id} className="grid gap-3">
          <div className="grid gap-3 lg:grid-cols-[130px_120px_1fr_180px] lg:items-center">
            <span className="text-sm text-ink/60">{dateText(s.data)}</span>
            <strong className="tabular-nums text-clay">{money.format(s.valor)}</strong>
            <div>
              <p className="font-semibold text-ink">{s.descricao}</p>
              <p className="text-xs text-ink/60">{s.documento ?? "sem documento"}</p>
            </div>
            <span className="text-xs font-semibold text-brand lg:text-right">Sugestão: {s.categoriaNome}</span>
          </div>

          <ClassificarDebitoForm
            extratoId={s.id}
            documento={s.documento}
            contaCompanyId={contaCompanyPor.get(s.contaId) ?? null}
            competenciaPadrao={competenciaDe(s.data)}
            categorias={data.categorias}
            companies={data.companies}
            categoriaSugerida={s.categoriaId}
            companySugerida={s.companyId}
            classeSugerida={s.classeDespesa}
          />
        </Panel>
      ))}
    </section>
  );
}
