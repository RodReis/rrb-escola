import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, Panel } from "@/components/ui/card";
import { ExportGateDailyStatusButton } from "@/components/pdf/export-gate-daily-status-button";
import { getGateDailyStatus } from "@/lib/data/gate";

function statusTone(status: string): "green" | "red" | "gray" {
  if (status === "dentro") return "green";
  if (status === "saiu") return "red";
  return "gray";
}

function statusLabel(status: string) {
  if (status === "dentro") return "Dentro";
  if (status === "saiu") return "Saiu";
  return "Nao chegou";
}

function formatTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date(value))
    : "-";
}

export default async function GateDailyPanelPage({ searchParams }: { searchParams: { data?: string } }) {
  const panel = await getGateDailyStatus(searchParams.data);

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line bg-paper px-6 py-7">
        <div>
          <p className="ds-kicker">Portaria</p>
          <h1 className="mt-7 font-serif text-4xl text-ink">Painel diario</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted">
            Visao do dia com alunos dentro da escola, saidas, atrasos de chegada e eventos registrados.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportGateDailyStatusButton rows={panel.rows} date={panel.date} />
          <ButtonLink href="/portaria" variant="secondary">Voltar para portaria</ButtonLink>
        </div>
      </header>

      <Panel>
        <form action="/portaria/painel" className="grid gap-4 md:grid-cols-[220px_140px]">
          <label>Data<input type="date" name="data" defaultValue={panel.date} /></label>
          <Button className="self-end" variant="accent">Filtrar</Button>
        </form>
      </Panel>

      <section className="grid gap-3 md:grid-cols-5">
        {[
          ["Alunos ativos", panel.totals.alunos, "ink"],
          ["Dentro", panel.totals.dentro, "moss"],
          ["Sairam", panel.totals.sairam, "clay"],
          ["Nao chegaram", panel.totals.naoChegaram, "ink"],
          ["Eventos", panel.totals.eventos, "ink"]
        ].map(([label, value, tone]) => (
          <Card key={label} className="min-h-[112px]">
            <p className="ds-kicker">{label}</p>
            <strong className={tone === "moss" ? "mt-4 block text-3xl text-moss" : tone === "clay" ? "mt-4 block text-3xl text-clay" : "mt-4 block text-3xl text-ink"}>{value}</strong>
          </Card>
        ))}
      </section>

      <section className="overflow-hidden rounded-panel border border-line bg-surface shadow-soft">
        <div className="grid grid-cols-[0.7fr_1.6fr_0.7fr_0.8fr_0.8fr_0.8fr_0.6fr] border-b border-line bg-muted px-4 py-3 text-xs font-bold uppercase text-muted max-xl:hidden">
          <span>Matricula</span>
          <span>Aluno</span>
          <span>Status</span>
          <span>Entrada</span>
          <span>Saida</span>
          <span>Ultimo</span>
          <span>Eventos</span>
        </div>

        <div className="grid bg-paper/70">
          {panel.rows.map((row) => (
            <div key={row.aluno_id} className="grid gap-3 border-b border-line px-4 py-4 last:border-b-0 xl:grid-cols-[0.7fr_1.6fr_0.7fr_0.8fr_0.8fr_0.8fr_0.6fr]">
              <span className="font-bold">{row.matricula_codigo}</span>
              <div>
                <strong>{row.nome}</strong>
                <span className="block text-sm text-muted">
                  {row.origem ?? "sem evento"} {row.confianca ? `- ${row.confianca}%` : ""}
                </span>
              </div>
              <div><Badge tone={statusTone(row.status)}>{statusLabel(row.status)}</Badge></div>
              <span className="text-sm">{formatTime(row.primeira_entrada)}</span>
              <span className="text-sm">{formatTime(row.ultima_saida)}</span>
              <span className="text-sm">{formatTime(row.ultimo_evento)}</span>
              <span className="text-sm font-bold">{row.total_eventos}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
