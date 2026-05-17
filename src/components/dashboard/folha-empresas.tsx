import { money } from "@/lib/constants";
import type { FolhaEmpresaRow } from "@/lib/data/dashboard-executive";

export function FolhaEmpresas({ items }: { items: FolhaEmpresaRow[] }) {
  const totalBruto = items.reduce((s, r) => s + r.bruto, 0);

  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">Folha por empresa</p>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-ink/60">Sem folha processada neste mês.</p>
      ) : (
        <ul className="mt-4 grid gap-4">
          {items.map((r) => {
            const pct = totalBruto > 0 ? (r.bruto / totalBruto) * 100 : 0;
            return (
              <li key={r.empresaId}>
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-semibold text-ink">{r.empresa}</p>
                  <span className="text-xs text-ink/55">{r.headcount} func · {pct.toFixed(1)}%</span>
                </div>
                <div className="mt-2 h-2 w-full rounded-pill bg-muted">
                  <div className="h-2 rounded-pill bg-brand" style={{ width: `${pct}%` }} />
                </div>
                <dl className="mt-2 grid grid-cols-4 gap-2 text-xs">
                  <div><dt className="text-ink/55">Bruto</dt><dd className="font-semibold">{money.format(r.bruto)}</dd></div>
                  <div><dt className="text-ink/55">INSS</dt><dd className="font-semibold">{money.format(r.inss)}</dd></div>
                  <div><dt className="text-ink/55">IRRF</dt><dd className="font-semibold">{money.format(r.irrf)}</dd></div>
                  <div><dt className="text-ink/55">Líquido</dt><dd className="font-semibold">{money.format(r.liquido)}</dd></div>
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
