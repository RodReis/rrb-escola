import { Cake, PartyPopper, Calendar } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { ExportAniversariantesCsvButton } from "@/components/mural/export-aniversariantes-csv";
import { getAniversariantesMes } from "@/lib/data/dashboard-executive";
import { requirePermission } from "@/lib/auth/session";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default async function MuralAniversariantesPage() {
  await requirePermission("mural", "read");
  const items = await getAniversariantesMes();

  const hoje = items.filter((i) => i.hoje);
  const doMes = items.filter((i) => !i.hoje);
  const nomeMes = MESES[new Date().getMonth()];

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "Mural" }, { label: "Aniversariantes do mês" }]}
        title="Aniversariantes do Mês"
        counter={items.length.toString()}
        description={`Todos os aniversariantes de ${nomeMes}. Comemorações do dia em destaque.`}
      />

      {hoje.length > 0 && (
        <section className="rounded-panel bg-gradient-to-br from-gold/30 via-gold/15 to-surface p-8 shadow-soft ring-2 ring-gold/40">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <PartyPopper size={28} className="text-gold" />
              <div>
                <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-gold">Aniversário hoje</p>
                <h2 className="text-3xl font-bold text-ink">Parabéns!</h2>
              </div>
            </div>
            <ExportAniversariantesCsvButton items={hoje} label="Baixar CSV de hoje" filenamePrefix="aniversariantes-hoje" />
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {hoje.map((a) => (
              <article
                key={a.alunoId}
                className="flex items-center gap-4 rounded-panel bg-surface p-5 shadow-soft ring-1 ring-gold/30"
              >
                <Avatar src={a.fotoUrl} name={a.nome} size={72} />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold leading-snug text-ink" title={a.nome}>{a.nome}</p>
                  {(a.serie || a.turma) && (
                    <p className="mt-0.5 truncate text-xs font-medium text-ink/60">
                      {[a.serie, a.turma].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <p className="mt-1.5 inline-flex items-center gap-1 rounded-pill bg-gold px-3 py-1 text-xs font-bold text-paper">
                    <Cake size={12} /> Aniversário hoje
                  </p>
                </div>
                <span className="shrink-0 text-2xl font-bold text-gold">{a.idade}</span>
              </article>
            ))}
          </div>
        </section>
      )}

      {doMes.length > 0 && (
        <section className="rounded-panel bg-surface p-6 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-ui bg-brand/10 text-brand">
                <Calendar size={16} />
              </span>
              <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/60">
                Demais aniversariantes de {nomeMes}
              </p>
            </div>
            <ExportAniversariantesCsvButton items={items} label="Baixar CSV do mês" filenamePrefix="aniversariantes-mes" />
          </div>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {doMes.map((a) => (
              <li
                key={a.alunoId}
                className="flex items-center gap-3 rounded-ui border border-line p-3 hover:bg-muted/40"
              >
                <Avatar src={a.fotoUrl} name={a.nome} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="leading-snug font-semibold text-ink" title={a.nome}>{a.nome}</p>
                  {(a.serie || a.turma) && (
                    <p className="truncate text-xs text-ink/60">
                      {[a.serie, a.turma].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <p className="text-xs text-ink/50">
                    {a.diaSemana} · {String(a.dia).padStart(2, "0")}/{String(a.mes).padStart(2, "0")} · faz {a.idade} anos
                  </p>
                </div>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-pill bg-gold/15 text-sm font-bold text-gold">
                  {String(a.dia).padStart(2, "0")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {items.length === 0 && (
        <section className="rounded-panel bg-surface p-12 text-center shadow-soft">
          <Cake size={48} className="mx-auto text-ink/20" />
          <p className="mt-4 text-lg font-semibold text-ink/60">Nenhum aniversário em {nomeMes}.</p>
        </section>
      )}
    </div>
  );
}
