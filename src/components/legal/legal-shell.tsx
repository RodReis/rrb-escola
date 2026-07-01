import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export type LegalTocItem = { id: string; label: string };

function BrandMark() {
  return (
    <span
      className="grid h-10 w-10 place-items-center font-display text-[12px] font-bold tracking-tight text-white"
      style={{
        borderRadius: "var(--r-md)",
        background: "linear-gradient(150deg, var(--brand-500), var(--brand-700))",
        boxShadow: "0 8px 22px -8px rgba(35,72,201,.5), inset 0 1px 0 rgba(255,255,255,.18)"
      }}
    >
      EPG
    </span>
  );
}

export function LegalShell({
  title,
  kicker,
  updatedAt,
  toc,
  otherDoc,
  children
}: {
  title: string;
  kicker: string;
  updatedAt: string;
  toc: LegalTocItem[];
  otherDoc: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <main className="relative min-h-screen bg-surface px-4 py-6 text-ink sm:px-6 lg:px-8">
      {/* Barra superior */}
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-[13px] font-semibold"
          style={{ color: "var(--text-soft)" }}
        >
          <ArrowLeft size={16} />
          Voltar ao acesso
        </Link>
        <ThemeToggle />
      </header>

      <section className="mx-auto mt-8 max-w-5xl">
        {/* Cabeçalho do documento */}
        <div className="ds-panel p-7 sm:p-9" style={{ boxShadow: "var(--shadow-lg)" }}>
          <div className="flex items-start gap-4">
            <BrandMark />
            <div className="min-w-0">
              <p className="ds-kicker">{kicker}</p>
              <h1 className="mt-2 font-display text-[30px] font-bold leading-tight text-ink sm:text-[36px]">
                {title}
              </h1>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
                <ShieldCheck size={14} />
                Última atualização: {updatedAt}
                <span aria-hidden>·</span>
                RRB Trading Ltda. — CNPJ 60.347.383/0001-09
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
          {/* Índice */}
          <nav className="legal-toc hidden lg:block" aria-label="Índice do documento">
            <div className="ds-card sticky top-6 p-4">
              <p className="ds-kicker mb-3">Nesta página</p>
              <ol className="grid gap-1.5 text-[12.5px]">
                {toc.map((item, i) => (
                  <li key={item.id}>
                    <a href={`#${item.id}`} className="flex gap-2">
                      <span style={{ color: "var(--text-faint)" }}>{String(i + 1).padStart(2, "0")}</span>
                      <span>{item.label}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>

          {/* Conteúdo */}
          <article className="ds-panel legal-prose p-7 sm:p-9">{children}</article>
        </div>

        {/* Rodapé */}
        <footer className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
            © {new Date().getFullYear()} RRB Trading Ltda. Todos os direitos reservados.
          </p>
          <Link
            href={otherDoc.href}
            className="inline-flex items-center gap-2 text-[13px] font-semibold"
            style={{ color: "var(--brand-600)" }}
          >
            {otherDoc.label}
            <ArrowLeft size={15} className="rotate-180" />
          </Link>
        </footer>
      </section>
    </main>
  );
}
