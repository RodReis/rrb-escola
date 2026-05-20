import { ExportStudentStatementButton } from "@/components/pdf/export-student-statement-button";
import { Panel } from "@/components/ui/card";
import { getStudentStatement } from "@/lib/data/finance";
import { displayStatus } from "@/lib/finance/charge-status";

export async function StudentStatementSection({ alunoId, searchParams }: {
  alunoId: string;
  searchParams: { ext_de?: string; ext_ate?: string };
}) {
  const today = new Date().toISOString().slice(0, 10);
  const firstDayOfMonth = `${today.slice(0, 7)}-01`;
  const de = searchParams.ext_de || firstDayOfMonth;
  const ate = searchParams.ext_ate || today;
  const statement = await getStudentStatement(alunoId, de, ate);

  return (
    <Panel className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="ds-kicker">Financeiro</p>
          <h2 className="mt-2 font-serif text-2xl text-ink">Extrato</h2>
        </div>
        <form method="GET" className="flex flex-wrap items-end gap-2">
          <label className="text-xs">De<input name="ext_de" type="date" defaultValue={de} /></label>
          <label className="text-xs">Ate<input name="ext_ate" type="date" defaultValue={ate} /></label>
          <button className="ds-button ds-button-secondary text-xs" type="submit">Atualizar</button>
          <ExportStudentStatementButton aluno={statement.aluno} de={de} ate={ate} charges={statement.charges} />
        </form>
      </div>

      <div className="grid gap-2 text-sm">
        {statement.charges.length === 0 ? (
          <p className="text-muted">Nenhuma cobrança no período.</p>
        ) : statement.charges.map((c) => (
          <div key={c.id} className="grid gap-2 border-b border-line py-2 md:grid-cols-[1fr_120px_120px_120px]">
            <strong className="text-ink">{c.descricao}</strong>
            <span>Vence {new Date(`${c.data_vencimento}T00:00:00`).toLocaleDateString("pt-BR")}</span>
            <span className="font-bold">{Number(c.valor_final).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
            <span className="text-muted">{displayStatus(c.status, c.data_vencimento)}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
