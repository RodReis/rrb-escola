import { money } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import type { getOrganogramaDrill } from "@/lib/data/organograma";

type DrillData = Awaited<ReturnType<typeof getOrganogramaDrill>>;

export function OrganogramaDrillPanel({ data }: { data: DrillData }) {
  if (!data.turma) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-ink/60">
        Selecione uma turma na sidebar para ver o detalhamento.
      </div>
    );
  }

  const { turma, alunos, somaSala, ticketMedio, competencia } = data;

  return (
    <div className="flex flex-1 flex-col gap-6 min-w-0">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <p className="text-sm font-black text-ink/60">Detalhamento da turma</p>
            <span className="rounded bg-accent/15 px-2 py-0.5 text-[0.65rem] font-black uppercase tracking-wider text-accent">
              DRILL
            </span>
          </div>
          <h2 className="mt-1 text-2xl font-black text-ink">{turma.serieNome} - {turma.nome}</h2>
          <p className="text-sm text-ink/60">{turma.segmentoNome}</p>
        </div>
        <p className="text-xs text-ink/60 text-right">
          {competencia}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="ds-kicker">Alunos</p>
          <strong className="mt-2 block text-3xl font-black text-ink">{alunos.length}</strong>
        </Card>
        <Card className="p-5">
          <p className="ds-kicker">Soma da Sala</p>
          <strong className="mt-2 block text-2xl font-black text-green-600">
            {money.format(somaSala)}
          </strong>
        </Card>
        <Card className="p-5">
          <p className="ds-kicker">Ticket Médio</p>
          <strong className="mt-2 block text-2xl font-black text-yellow-600">
            {money.format(ticketMedio)}
          </strong>
        </Card>
      </div>

      <div className="overflow-x-auto rounded-ui border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-muted">
              <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-ink/60">#</th>
              <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-ink/60">Aluno</th>
              <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-ink/60">Resp. Financ.</th>
              <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wider text-ink/60">Mensalidade</th>
            </tr>
          </thead>
          <tbody>
            {alunos.map((aluno, idx) => (
              <tr key={aluno.id} className="border-b border-line last:border-0 hover:bg-muted/50">
                <td className="px-4 py-3 text-ink/60">{idx + 1}</td>
                <td className="px-4 py-3 font-medium text-ink">{aluno.nome}</td>
                <td className="px-4 py-3 text-brand">{aluno.respFinanceiro ?? "-"}</td>
                <td className="px-4 py-3 text-right font-medium text-ink">
                  {aluno.mensalidade != null ? money.format(aluno.mensalidade) : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
