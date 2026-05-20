import { Trash2, ReceiptText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ValorPraticadoInput } from "@/components/valores/valor-praticado-input";
import { CriarAnoForm } from "@/components/valores/criar-ano-form";
import { listValoresPraticados, SEGMENTOS, type SegmentoSerie, type ValorPraticado } from "@/lib/data/valores-praticados";
import { removerAnoLetivoAction } from "@/lib/actions/valores-praticados";
import { requirePermission } from "@/lib/auth/session";

const SEG_LABEL: Record<SegmentoSerie, string> = {
  INFANTIL: "Educação Infantil",
  FUNDAMENTAL1: "Fundamental I",
  FUNDAMENTAL2: "Fundamental II",
  MEDIO: "Ensino Médio",
};

const SEG_COLOR: Record<SegmentoSerie, string> = {
  INFANTIL: "bg-gold/15 text-gold",
  FUNDAMENTAL1: "bg-brand/15 text-brand",
  FUNDAMENTAL2: "bg-clay/15 text-clay",
  MEDIO: "bg-moss/15 text-moss",
};

const ORDEM_LABEL: Record<1 | 2 | 3, string> = {
  1: "1 Aluno",
  2: "2º Irmão",
  3: "3º Irmão",
};

function buildMatrix(valores: ValorPraticado[]): Map<number, Map<SegmentoSerie, Map<1 | 2 | 3, ValorPraticado>>> {
  const out = new Map<number, Map<SegmentoSerie, Map<1 | 2 | 3, ValorPraticado>>>();
  for (const v of valores) {
    if (!out.has(v.anoLetivo)) out.set(v.anoLetivo, new Map());
    const byAno = out.get(v.anoLetivo)!;
    if (!byAno.has(v.segmento)) byAno.set(v.segmento, new Map());
    byAno.get(v.segmento)!.set(v.ordemFilho, v);
  }
  return out;
}

export default async function ValoresPraticadosPage() {
  await requirePermission("valores-praticados", "read");
  const valores = await listValoresPraticados();
  const matrix = buildMatrix(valores);
  const anos = Array.from(matrix.keys()).sort((a, b) => b - a);

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "Financeiro" }, { label: "Valores praticados" }]}
        title="Valores praticados"
        counter={`${anos.length}`}
        description="Tabela de referência. Não vincula matrícula nem gera cobrança."
        actions={<CriarAnoForm />}
      />

      {anos.length === 0 && (
        <article className="rounded-panel bg-surface p-8 shadow-soft">
          <div className="flex flex-col items-center justify-center gap-2 text-ink/40">
            <ReceiptText size={28} />
            <p className="text-sm font-medium">Nenhum ano cadastrado. Crie um novo ano acima.</p>
          </div>
        </article>
      )}

      {anos.map((ano) => {
        const porSegmento = matrix.get(ano)!;
        return (
          <article key={ano} className="rounded-panel bg-surface p-6 shadow-soft">
            <header className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-ink">Ano letivo {ano}</h2>
                <p className="text-sm text-ink/60">Valores em R$. Edite e clique fora para salvar.</p>
              </div>
              <form action={removerAnoLetivoAction}>
                <input type="hidden" name="ano_letivo" value={ano} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-ui border border-danger/20 bg-danger/5 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/10"
                >
                  <Trash2 size={12} /> Remover ano
                </button>
              </form>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[0.66rem] uppercase tracking-kicker text-ink/55">
                    <th className="px-3 py-2 text-left">Segmento</th>
                    {([1, 2, 3] as const).map((o) => (
                      <th key={o} colSpan={2} className="px-3 py-2 text-center border-l border-line">
                        {ORDEM_LABEL[o]}
                      </th>
                    ))}
                  </tr>
                  <tr className="text-[0.66rem] uppercase tracking-kicker text-ink/40">
                    <th />
                    {([1, 2, 3] as const).flatMap((o) => [
                      <th key={`m${o}`} className="px-3 py-1 text-right border-l border-line">Matrícula</th>,
                      <th key={`s${o}`} className="px-3 py-1 text-right">Mensalidade</th>,
                    ])}
                  </tr>
                </thead>
                <tbody>
                  {SEGMENTOS.map((seg) => {
                    const porOrdem = porSegmento.get(seg);
                    return (
                      <tr key={seg} className="border-t border-line">
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${SEG_COLOR[seg]}`}>
                            {SEG_LABEL[seg]}
                          </span>
                        </td>
                        {([1, 2, 3] as const).map((o) => {
                          const v = porOrdem?.get(o);
                          if (!v) {
                            return (
                              <td key={o} colSpan={2} className="px-3 py-3 text-center text-ink/40 border-l border-line">
                                —
                              </td>
                            );
                          }
                          return [
                            <td key={`m${o}`} className="px-3 py-3 border-l border-line">
                              <ValorPraticadoInput
                                anoLetivo={ano}
                                segmento={seg}
                                ordemFilho={o}
                                campo="valor_matricula"
                                initialValue={v.valorMatricula}
                                outroCampo={{ campo: "valor_mensalidade", valor: v.valorMensalidade }}
                              />
                            </td>,
                            <td key={`s${o}`} className="px-3 py-3">
                              <ValorPraticadoInput
                                anoLetivo={ano}
                                segmento={seg}
                                ordemFilho={o}
                                campo="valor_mensalidade"
                                initialValue={v.valorMensalidade}
                                outroCampo={{ campo: "valor_matricula", valor: v.valorMatricula }}
                              />
                            </td>,
                          ];
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </article>
        );
      })}
    </div>
  );
}
