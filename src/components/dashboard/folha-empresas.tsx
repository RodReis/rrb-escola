import { Building2 } from "lucide-react";
import { money } from "@/lib/constants";
import type { FolhaEmpresaRow } from "@/lib/data/dashboard-executive";

const COLORS = ["bg-brand", "bg-accent", "bg-moss", "bg-gold", "bg-clay"];
const ACCENT = ["text-brand", "text-accent", "text-moss", "text-gold", "text-clay"];

export function FolhaEmpresas({ items }: { items: FolhaEmpresaRow[] }) {
  const totalBruto = items.reduce((s, r) => s + r.bruto, 0);

  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-ui bg-brand/10 text-brand">
            <Building2 size={16} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-ink">Folha por empresa</h3>
            <p className="text-[0.66rem] text-ink/60">distribuição por CNPJ</p>
          </div>
        </div>
        {items.length > 0 && (
          <div className="text-right">
            <strong className="block text-lg font-bold text-ink leading-none">{money.format(totalBruto)}</strong>
            <p className="mt-0.5 text-[0.6rem] font-semibold uppercase tracking-kicker text-ink/60">bruto total</p>
          </div>
        )}
      </div>
      {items.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-2 rounded-ui bg-muted/30 py-8 text-ink/60">
          <Building2 size={24} />
          <p className="text-sm">Sem folha processada neste mês.</p>
        </div>
      ) : (
        <ul className="mt-5 grid gap-5">
          {items.map((r, i) => {
            const pct = totalBruto > 0 ? (r.bruto / totalBruto) * 100 : 0;
            const barColor = COLORS[i % COLORS.length];
            const txt = ACCENT[i % ACCENT.length];
            return (
              <li key={r.empresaId}>
                <div className="flex items-baseline justify-between">
                  <p className={`text-sm font-bold ${txt}`}>{r.empresa}</p>
                  <span className="text-xs font-semibold text-ink/60">{r.headcount} func · {pct.toFixed(1)}%</span>
                </div>
                <div className="mt-2 h-2.5 w-full rounded-pill bg-muted overflow-hidden">
                  <div className={`h-2.5 rounded-pill ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
                <dl className="mt-3 grid grid-cols-4 gap-2 text-xs">
                  <div className="rounded-ui bg-muted/40 p-2">
                    <dt className="text-[0.66rem] uppercase tracking-kicker text-ink/60">Bruto</dt>
                    <dd className="mt-1 font-bold text-ink">{money.format(r.bruto)}</dd>
                  </div>
                  <div className="rounded-ui bg-muted/40 p-2">
                    <dt className="text-[0.66rem] uppercase tracking-kicker text-ink/60">INSS</dt>
                    <dd className="mt-1 font-bold text-ink">{money.format(r.inss)}</dd>
                  </div>
                  <div className="rounded-ui bg-muted/40 p-2">
                    <dt className="text-[0.66rem] uppercase tracking-kicker text-ink/60">IRRF</dt>
                    <dd className="mt-1 font-bold text-ink">{money.format(r.irrf)}</dd>
                  </div>
                  <div className="rounded-ui bg-success/10 p-2">
                    <dt className="text-[0.66rem] uppercase tracking-kicker text-success/80">Líquido</dt>
                    <dd className="mt-1 font-bold text-success">{money.format(r.liquido)}</dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
