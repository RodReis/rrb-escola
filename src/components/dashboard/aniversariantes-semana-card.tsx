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
  hero = false,
}: {
  fotoUrl: string | null;
  nome: string;
  size: number;
  hero?: boolean;
}) {
  const sizeClass = hero
    ? "size-16"
    : size === 48
    ? "size-12"
    : size === 40
    ? "size-10"
    : "size-8";
  const ringClass = hero
    ? "ring-4 ring-gold/50 ring-offset-2 ring-offset-gold/10"
    : "ring-2 ring-gold/30";

  if (fotoUrl) {
    return (
      <Image
        src={fotoUrl}
        alt={nome}
        width={hero ? 64 : size}
        height={hero ? 64 : size}
        className={`${sizeClass} shrink-0 rounded-full object-cover ${ringClass}`}
      />
    );
  }
  const textClass = hero ? "text-xl" : "text-xs";
  return (
    <span
      className={`${sizeClass} shrink-0 grid place-items-center rounded-full bg-gold/20 text-gold ${textClass} font-bold ${ringClass}`}
      aria-hidden="true"
    >
      {iniciais(nome)}
    </span>
  );
}

/**
 * Card dos aniversariantes de HOJE.
 * - padrão: coluna compacta (lateral do dashboard)
 * - destaque: banner full-width no topo, com os cards em grid horizontal
 */
export function AniversariantesHojeCard({
  items,
  destaque = false,
}: {
  items: AniversarioSemanaRow[];
  destaque?: boolean;
}) {
  const hoje = items.filter((i) => i.hoje);
  if (hoje.length === 0) return null;

  // Modo destaque com mais de 1 aniversariante: grid horizontal full-width.
  if (destaque && hoje.length > 1) {
    return (
      <article className="w-full overflow-hidden rounded-panel border border-gold/40 bg-gradient-to-br from-[color-mix(in_oklab,var(--c-amber)_22%,var(--surface))] via-[color-mix(in_oklab,var(--c-amber)_10%,var(--surface))] to-surface shadow-[0_4px_24px_rgba(201,151,54,0.14)]">
        <div className="h-1 w-full bg-gradient-to-r from-gold/50 via-gold to-gold/50" />
        <div className="px-5 pb-5 pt-4">
          <div className="flex items-center gap-1.5">
            <PartyPopper size={15} className="text-gold" />
            <span className="text-xs font-black uppercase tracking-[0.16em] text-gold">
              Aniversário hoje
            </span>
            <span className="text-xs font-bold text-gold/70">· {hoje.length}</span>
            <PartyPopper size={15} className="text-gold -scale-x-100" />
          </div>
          <ul className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {hoje.map((a) => (
              <li key={a.alunoId}>
                <Link
                  href={`/alunos/${a.alunoId}`}
                  className="flex w-full min-w-0 items-center gap-3 rounded-ui bg-white/70 p-2.5 ring-1 ring-gold/25 transition hover:bg-gold/10 dark:bg-surface/60"
                >
                  <div className="relative">
                    <Avatar fotoUrl={a.fotoUrl} nome={a.nome} size={48} />
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-gold text-[0.55rem] font-black text-white">
                      {a.idade}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <p className="truncate text-sm font-bold leading-tight text-ink">{a.nome}</p>
                    <p className="text-xs font-semibold text-gold">🎂 {a.idade} anos</p>
                    {(a.serie || a.turma) && (
                      <p className="truncate text-[0.65rem] text-ink/55">
                        {[a.serie, a.turma].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </article>
    );
  }

  return (
    <article className="w-full h-full overflow-hidden rounded-panel border border-gold/40 bg-gradient-to-br from-[color-mix(in_oklab,var(--c-amber)_22%,var(--surface))] via-[color-mix(in_oklab,var(--c-amber)_10%,var(--surface))] to-surface shadow-[0_4px_24px_rgba(201,151,54,0.14)]">
      {/* Top strip */}
      <div className="h-1 w-full bg-gradient-to-r from-gold/50 via-gold to-gold/50" />

      <div className="px-4 pb-4 pt-3">
        <div className="flex items-center gap-1.5">
          <PartyPopper size={13} className="text-gold" />
          <span className="text-[0.6rem] font-black uppercase tracking-[0.16em] text-gold">
            Aniversário hoje
          </span>
          <PartyPopper size={13} className="text-gold -scale-x-100" />
        </div>

        <ul className="mt-3 grid gap-2">
          {hoje.map((a) => (
            <li key={a.alunoId}>
              {hoje.length === 1 ? (
                /* Hero layout for single birthday */
                <Link
                  href={`/alunos/${a.alunoId}`}
                  className="flex flex-col items-center gap-2 py-1 text-center transition hover:opacity-80"
                >
                  <div className="relative">
                    <Avatar fotoUrl={a.fotoUrl} nome={a.nome} size={64} hero />
                    <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-gold text-[0.6rem] font-black text-white">
                      {a.idade}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-black leading-tight text-ink">{a.nome}</p>
                    <p className="mt-0.5 text-xs font-semibold text-gold">🎂 {a.idade} anos!</p>
                  </div>
                </Link>
              ) : (
                /* Row layout for multiple */
                <Link
                  href={`/alunos/${a.alunoId}`}
                  className="flex w-full min-w-0 items-center gap-2.5 rounded-ui bg-white/60 p-2 ring-1 ring-gold/25 transition hover:bg-gold/10 dark:bg-surface/60"
                >
                  <Avatar fotoUrl={a.fotoUrl} nome={a.nome} size={36} />
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <p className="text-xs font-bold text-ink leading-tight">{a.nome}</p>
                    <p className="text-[0.65rem] font-semibold text-gold">🎂 {a.idade} anos</p>
                  </div>
                </Link>
              )}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

/** Faixa horizontal de próximos aniversariantes — para linha abaixo da tabela */
export function AniversariantesProximosRow({
  items,
}: {
  items: AniversarioSemanaRow[];
}) {
  const proximos = items.filter((i) => !i.hoje);
  if (proximos.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-[0.66rem] font-bold uppercase tracking-kicker text-ink/50">
        Próximos aniversários
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {proximos.map((a) => (
          <Link
            key={a.alunoId}
            href={`/alunos/${a.alunoId}`}
            title={`${a.nome} · ${a.dataLabel}`}
            className="flex shrink-0 items-center gap-2 rounded-ui border border-line bg-surface px-3 py-2 transition hover:bg-muted/60"
          >
            <div className="relative">
              {a.fotoUrl ? (
                <Image
                  src={a.fotoUrl}
                  alt={a.nome}
                  width={32}
                  height={32}
                  className="size-8 rounded-full object-cover ring-1 ring-line"
                />
              ) : (
                <span className="size-8 grid place-items-center rounded-full bg-muted text-[0.6rem] font-bold text-ink/60 ring-1 ring-line">
                  {iniciais(a.nome)}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="max-w-[100px] truncate text-xs font-semibold text-ink">{a.nome}</p>
              <p className="text-[0.65rem] text-ink/50">{a.dataLabel} · {a.idade}a</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** @deprecated use AniversariantesHojeCard + AniversariantesProximosRow */
export function AniversariantesSemanaCard({
  items,
}: {
  items: AniversarioSemanaRow[];
}) {
  const hoje = items.filter((i) => i.hoje);
  const proximos = items.filter((i) => !i.hoje);

  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <h2 className="text-lg font-bold text-ink">
        Aniversariantes da Semana
        {items.length > 0 && (
          <span className="ml-2 text-base font-semibold italic text-ink/40">· {items.length}</span>
        )}
      </h2>

      {items.length === 0 && (
        <div className="mt-6 flex flex-col items-center justify-center gap-2 rounded-ui bg-muted/40 py-10 text-ink/40">
          <Cake size={28} />
          <p className="text-sm">Sem aniversariantes nesta semana.</p>
        </div>
      )}

      {hoje.length > 0 && <AniversariantesHojeCard items={items} />}

      {proximos.length > 0 && (
        <div className="mt-4">
          <AniversariantesProximosRow items={items} />
        </div>
      )}
    </article>
  );
}
