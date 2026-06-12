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

type Provisao = {
  id: string;
  contrato_id: string;
  competencia: string;
  tipo: string;
  valor_mes: number;
  saldo_acumulado: number;
  folha_contratos: { employees: { name: string } | null } | null;
};

export default async function ProvisoesPage() {
  await requirePermission("rh.folha-v2", "read");
  const rawData = await getProvisoesSaldo();
  const provisoes = rawData as unknown as Provisao[];

  const byFuncionario = new Map<string, { nome: string; saldos: Record<string, number> }>();
  for (const p of provisoes) {
    const nome = p.folha_contratos?.employees?.name ?? "—";
    if (!byFuncionario.has(p.contrato_id)) {
      byFuncionario.set(p.contrato_id, { nome, saldos: {} });
    }
    const entry = byFuncionario.get(p.contrato_id)!;
    const prev = entry.saldos[p.tipo] ?? 0;
    if (p.saldo_acumulado > prev) entry.saldos[p.tipo] = p.saldo_acumulado;
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
        <p className="text-xs font-bold uppercase tracking-kicker text-ink/55 mb-1">Total provisionado</p>
        <p className="text-2xl font-bold tabular-nums text-ink">{money.format(totalGeral)}</p>
      </Card>

      <DataTableShell
        footer={
          byFuncionario.size > 0 ? (
            <span><strong className="text-ink">{byFuncionario.size}</strong> funcionário(s)</span>
          ) : undefined
        }
      >
        <table className="ds-dt min-w-[720px]">
          <thead>
            <tr>
              <th>Funcionário</th>
              {tipos.map((t) => (
                <th key={t} className="text-right">{TIPO_LABEL[t]}</th>
              ))}
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {byFuncionario.size === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-ink/40">
                  Nenhuma provisão registrada.
                </td>
              </tr>
            ) : null}
            {allEntries.map(([contratoId, f]) => {
              const total = Object.values(f.saldos).reduce((s: number, v: number) => s + v, 0);
              return (
                <tr key={contratoId}>
                  <td className="font-medium">{f.nome}</td>
                  {tipos.map((t) => (
                    <td key={t} className="text-right tabular-nums text-sm">
                      {f.saldos[t] != null ? money.format(f.saldos[t]) : "—"}
                    </td>
                  ))}
                  <td className="text-right tabular-nums font-semibold">{money.format(total)}</td>
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
            </tr>
          </tfoot>
        </table>
      </DataTableShell>
    </div>
  );
}
