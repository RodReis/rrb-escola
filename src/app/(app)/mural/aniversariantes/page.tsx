import { Cake, PartyPopper, Calendar } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { getAniversariantesSemana } from "@/lib/data/dashboard-executive";
import { getSignedFotoUrls } from "@/lib/storage/photos";
import { requirePermission } from "@/lib/auth/session";

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export default async function MuralAniversariantesPage() {
  await requirePermission("mural", "read");
  const items = await getAniversariantesSemana();
  const signed = await getSignedFotoUrls(items.map((i) => i.fotoUrl));

  const hoje = items.filter((i) => i.hoje);
  const proximos = items.filter((i) => !i.hoje);

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "Mural" }, { label: "Aniversariantes da semana" }]}
        title="Aniversariantes da Semana"
        counter={items.length.toString()}
        description="Próximos 7 dias. Comemorações em destaque."
      />

      {hoje.length > 0 && (
        <section className="rounded-panel bg-gradient-to-br from-gold/30 via-gold/15 to-surface p-8 shadow-soft ring-2 ring-gold/40">
          <div className="flex items-center gap-3 mb-6">
            <PartyPopper size={28} className="text-gold" />
            <div>
              <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-gold">Aniversário hoje</p>
              <h2 className="text-3xl font-bold text-ink">Parabéns!</h2>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {hoje.map((a) => {
              const foto = a.fotoUrl ? signed.get(a.fotoUrl) ?? null : null;
              return (
                <article
                  key={a.alunoId}
                  className="flex items-center gap-4 rounded-panel bg-surface p-5 shadow-soft ring-1 ring-gold/30"
                >
                  <Avatar src={foto} name={a.nome} size={72} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xl font-bold text-ink">{a.nome}</p>
                    <p className="mt-1 inline-flex items-center gap-1 rounded-pill bg-gold px-3 py-1 text-xs font-bold text-paper">
                      <Cake size={12} /> Aniversário hoje
                    </p>
                  </div>
                  <span className="shrink-0 text-2xl font-bold text-gold">{a.idade}</span>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {proximos.length > 0 && (
        <section className="rounded-panel bg-surface p-6 shadow-soft">
          <div className="flex items-center gap-2 mb-5">
            <span className="grid h-9 w-9 place-items-center rounded-ui bg-brand/10 text-brand">
              <Calendar size={16} />
            </span>
            <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/60">
              Próximos da semana
            </p>
          </div>
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {proximos.map((a) => {
              const idxOnSigned = items.findIndex((x) => x.alunoId === a.alunoId);
              const fotoPath = items[idxOnSigned]?.fotoUrl ?? null;
              const foto = fotoPath ? signed.get(fotoPath) ?? null : null;
              return (
                <li
                  key={a.alunoId}
                  className="flex items-center gap-3 rounded-ui border border-line p-3 hover:bg-muted/40"
                >
                  <Avatar src={foto} name={a.nome} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{a.nome}</p>
                    <p className="text-xs text-ink/60">
                      {a.diaSemana} · {String(a.dia).padStart(2, "0")}/{MESES[a.mes - 1]} · faz {a.idade}a
                    </p>
                  </div>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-pill bg-gold/15 text-sm font-bold text-gold">
                    {String(a.dia).padStart(2, "0")}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {items.length === 0 && (
        <section className="rounded-panel bg-surface p-12 text-center shadow-soft">
          <Cake size={48} className="mx-auto text-ink/20" />
          <p className="mt-4 text-lg font-semibold text-ink/60">Nenhum aniversário nos próximos 7 dias.</p>
        </section>
      )}
    </div>
  );
}
