import Link from "next/link";
import Image from "next/image";
import { Cake, PartyPopper } from "lucide-react";
import type { AniversarioSemanaRow } from "@/lib/data/dashboard-executive";

function iniciais(nome: string): string {
  const parts = nome.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase();
}

function Avatar({
  fotoUrl,
  nome,
  size,
}: {
  fotoUrl: string | null;
  nome: string;
  size: number;
}) {
  const sizeClass = size === 48 ? "size-12" : size === 40 ? "size-10" : "size-8";
  if (fotoUrl) {
    return (
      <Image
        src={fotoUrl}
        alt={nome}
        width={size}
        height={size}
        className={`${sizeClass} shrink-0 rounded-full object-cover ring-2 ring-gold/30`}
      />
    );
  }
  return (
    <span
      className={`${sizeClass} shrink-0 grid place-items-center rounded-full bg-gold/15 text-gold text-xs font-bold ring-2 ring-gold/20`}
      aria-hidden="true"
    >
      {iniciais(nome)}
    </span>
  );
}

export function AniversariantesSemanaCard({
  items,
}: {
  items: AniversarioSemanaRow[];
}) {
  const hoje = items.filter((i) => i.hoje);
  const proximos = items.filter((i) => !i.hoje);

  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-bold text-ink">
            Aniversariantes da Semana
            {items.length > 0 && (
              <span className="ml-2 text-base font-semibold italic text-ink/40">
                · {items.length}
              </span>
            )}
          </h2>
          <p className="mt-1 text-xs text-ink/55">
            Próximos 7 dias. Comemorações em destaque.
          </p>
        </div>
      </div>

      {items.length === 0 && (
        <div className="mt-6 flex flex-col items-center justify-center gap-2 rounded-ui bg-muted/40 py-10 text-ink/40">
          <Cake size={28} />
          <p className="text-sm">Sem aniversariantes nesta semana.</p>
        </div>
      )}

      {hoje.length > 0 && (
        <div className="mt-5 rounded-ui border border-gold/30 bg-gradient-to-br from-gold/20 to-gold/5 p-5">
          <div className="flex items-center gap-2">
            <PartyPopper size={16} className="text-gold" />
            <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-gold">
              Aniversário hoje
            </p>
          </div>
          <p className="mt-1 text-2xl font-bold text-ink">Parabéns!</p>
          <ul className="mt-4 grid gap-2">
            {hoje.map((a) => (
              <li key={a.alunoId}>
                <Link
                  href={`/alunos/${a.alunoId}`}
                  aria-label={`Ver ficha de ${a.nome}`}
                  title={`${a.nome} · faz ${a.idade} anos hoje`}
                  className="flex items-center gap-3 rounded-ui bg-surface p-3 ring-1 ring-gold/40 transition hover:bg-gold/5"
                >
                  <Avatar fotoUrl={a.fotoUrl} nome={a.nome} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{a.nome}</p>
                    <p className="mt-0.5 inline-flex items-center gap-1 rounded-pill bg-gold/20 px-2 py-0.5 text-[0.66rem] font-semibold uppercase tracking-kicker text-gold">
                      <Cake size={11} /> Aniversário hoje
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-gold">
                    {a.idade}a
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {proximos.length > 0 && (
        <div className="mt-5">
          <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">
            Próximos dias
          </p>
          <ul className="mt-2 grid gap-1.5">
            {proximos.map((a) => (
              <li key={a.alunoId}>
                <Link
                  href={`/alunos/${a.alunoId}`}
                  aria-label={`Ver ficha de ${a.nome}`}
                  title={`${a.nome} · faz ${a.idade} anos`}
                  className="flex items-center gap-3 rounded-ui border border-line p-2 transition hover:bg-muted/60"
                >
                  <Avatar fotoUrl={a.fotoUrl} nome={a.nome} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      {a.nome}
                    </p>
                    <p className="text-xs text-ink/55">{a.dataLabel}</p>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-ink/60">
                    {a.idade}a
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
