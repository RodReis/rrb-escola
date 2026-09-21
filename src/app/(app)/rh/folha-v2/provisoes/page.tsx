import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { DataTableShell } from "@/components/ui/data-table";
import { getProvisoesSaldo } from "@/lib/data/folha";
import { requirePermission } from "@/lib/auth/session";
import { money } from "@/lib/constants";

export const dynamic = "force-dynamic";

const TIPO_LABEL: Record<string, string> = {
  decimo_terceiro: "13º Salário",
  ferias: "Férias",
  fgts: "FGTS",
  inss_patronal: "INSS Patronal",
};

function fmtDate(iso: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

type Provisao = {
  id: string;
  contrato_id: string;
  competencia: string;
  tipo: string;
  valor_mes: number;
  saldo_acumulado: number;
  baixada_em: string | null;
  run_id: string | null;
  folha_contratos: { employees: { name: string } | null } | null;
};

export default async function ProvisoesPage() {
  await requirePermission("rh.folha-v2", "read");
  const rawData = await getProvisoesSaldo();
  const provisoes = rawData as unknown as Provisao[];

  const byFuncionario = new Map<string, {
    nome: string;
    saldos: Record<string, number>;
    baixada_em: string | null;
    run_id: string | null;
  }>();
  for (const p of provisoes) {
    const nome = p.folha_contratos?.employees?.name ?? "—";
    if (!byFuncionario.has(p.contrato_id)) {
      byFuncionario.set(p.contrato_id, { nome, saldos: {}, baixada_em: null, run_id: null });
    }
    const entry = byFuncionario.get(p.contrato_id)!;
    const prev = entry.saldos[p.tipo] ?? 0;
    if (p.saldo_acumulado > prev) entry.saldos[p.tipo] = p.saldo_acumulado;
    if (p.baixada_em && (!entry.baixada_em || p.baixada_em > entry.baixada_em)) {
      entry.baixada_em = p.baixada_em;
      entry.run_id = p.run_id;
    }
  }

  const tipos = ["decimo_terceiro", "ferias", "fgts", "inss_patronal"];

  const allEntries = Array.from(byFuncionario.entries());
  const allValues = Array.from(byFuncionario.values());

  const totalGeral = allValues.reduce((sum, f) => {
    return sum + Object.values(f.saldos).reduce((s: number, v: number) => s + v, 0);
  }, 0);

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "RH", href: "/rh/funcionarios" },
          { label: "Folha v2", href: "/rh/folha-v2" },
          { label: "Provisões" },
        ]}
        title="Provisões"
        description="Saldo acumulado de provisões por funcionário (não baixadas)."
      />

      <Card>
        <p className="text-xs font-bold uppercase tracking-kicker text-ink/60 mb-1">Total provisionado</p>
        <p className="text-2xl font-bold tabular-nums text-ink">{money.format(totalGeral)}</p>
      </Card>

      <DataTableShell
        footer={
          byFuncionario.size > 0 ? (
            <span><strong className="text-ink">{byFuncionario.size}</strong> funcionário(s)</span>
          ) : undefined
        }
      >
        <table className="ds-dt min-w-[820px]">
          <thead>
            <tr>
              <th>Funcionário</th>
              {tipos.map((t) => (
                <th key={t} className="text-right">{TIPO_LABEL[t]}</th>
              ))}
              <th className="text-right">Total</th>
              <th className="text-right">Baixado em</th>
            </tr>
          </thead>
          <tbody>
            {byFuncionario.size === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-sm text-ink/60">
                  Nenhuma provisão registrada.
                </td>
              </tr>
            ) : null}
            {allEntries.map(([contratoId, f]) => {
              const total = Object.values(f.saldos).reduce((s: number, v: number) => s + v, 0);
              const baixadaLabel = fmtDate(f.baixada_em);
              return (
                <tr key={contratoId}>
                  <td className="font-medium">{f.nome}</td>
                  {tipos.map((t) => (
                    <td key={t} className="text-right tabular-nums text-sm">
                      {f.saldos[t] != null ? money.format(f.saldos[t]) : "—"}
                    </td>
                  ))}
                  <td className="text-right tabular-nums font-semibold">{money.format(total)}</td>
                  <td className="text-right tabular-nums text-sm text-ink/60">
                    {baixadaLabel ? (
                      f.run_id ? (
                        <Link
                          href={`/rh/folha-v2/${f.run_id}`}
                          className="text-brand hover:underline"
                        >
                          {baixadaLabel}
                        </Link>
                      ) : (
                        baixadaLabel
                      )
                    ) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t font-semibold">
              <td>Totais</td>
              {tipos.map((t) => {
                const soma = allValues.reduce((s: number, f) => s + (f.saldos[t] ?? 0), 0);
                return (
                  <td key={t} className="text-right tabular-nums">{money.format(soma)}</td>
                );
              })}
              <td className="text-right tabular-nums">{money.format(totalGeral)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </DataTableShell>
    </div>
  );
}
