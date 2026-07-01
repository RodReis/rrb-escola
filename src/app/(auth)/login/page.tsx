import { loginAction } from "@/lib/actions/auth";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LoginFields } from "./login-fields";
import { ArrowRight, FileText, BarChart3, Sparkles, AlertCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const dynamic = "force-dynamic";

const trustItems: Array<{ icon: LucideIcon; label: string; hint: string }> = [
  { icon: FileText, label: "Matrículas", hint: "fluxo completo" },
  { icon: BarChart3, label: "Cobranças", hint: "boletos e PIX" },
  { icon: Sparkles, label: "Claro e escuro", hint: "do seu jeito" }
];

function BrandMark() {
  return (
    <span
      className="grid h-[52px] w-[52px] place-items-center font-display text-[15px] font-bold tracking-tight text-white"
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

export default async function LoginPage({ searchParams }: { searchParams: { erro?: string } }) {
  const error = searchParams.erro;

  return (
    <main className="relative min-h-screen bg-surface px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="absolute right-6 top-6 z-10 lg:right-10 lg:top-8">
        <ThemeToggle />
      </div>
      <section className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl items-center gap-10 lg:grid-cols-[1fr_440px]">
        <div
          className="login-aurora relative overflow-hidden p-8 lg:p-10"
          style={{ borderRadius: "var(--r-xl)" }}
        >
          {/* Camada aurora (claro) / spotlight (escuro) — ref login.jsx */}
          <div className="login-aurora-bg" aria-hidden="true">
            <span className="login-blob login-blob-a" />
            <span className="login-blob login-blob-b" />
            <span className="login-blob login-blob-c" />
          </div>
          <div className="relative z-10 max-w-3xl">
            <BrandMark />
            <p className="mt-8 ds-kicker">Gestão escolar local</p>
            <h1
              className="mt-3.5 font-display font-bold leading-[0.96] text-ink"
              style={{ fontSize: "clamp(2.75rem, 1.5rem + 4vw, 3.5rem)", letterSpacing: "-0.03em", textWrap: "balance" }}
            >
              RRB Escola
            </h1>
            <p className="mt-5 max-w-md text-[19px] font-semibold leading-7 tracking-[-0.01em] text-ink">
              Secretaria, matrículas e cobranças em uma só base.
            </p>
            <p className="mt-3 max-w-md text-[14.5px] leading-relaxed" style={{ color: "var(--text-soft)" }}>
              Frequência, portaria, relatórios em PDF e a operação diária do dia a dia da escola — em um sistema rápido e organizado.
            </p>

            <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
              {trustItems.map(({ icon: Icon, label, hint }) => (
                <div key={label} className="ds-card flex items-center gap-3 p-3.5">
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-r-md"
                    style={{
                      borderRadius: "var(--r-md)",
                      background: "color-mix(in oklab, var(--c-blue) 14%, var(--surface))",
                      color: "var(--c-blue)"
                    }}
                  >
                    <Icon size={17} strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="block text-[12.5px] font-semibold text-ink">{label}</span>
                    <span className="block text-[10.5px]" style={{ color: "var(--text-muted)" }}>{hint}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="ds-panel p-7" style={{ boxShadow: "var(--shadow-lg)" }}>
          <div className="mb-6">
            <p className="ds-kicker">Acesso administrativo</p>
            <h2 className="mt-2 font-display text-[30px] font-bold leading-tight text-ink">Entrar no sistema</h2>
            <p className="mt-1 text-[13px]" style={{ color: "var(--text-muted)" }}>Use suas credenciais administrativas.</p>
          </div>
          {error ? (
            <p className="mb-4 flex items-center gap-2 rounded-ui bg-clay/10 p-3 text-sm font-bold text-clay">
              <AlertCircle size={16} />
              {error === "perfil"
                ? "Sem perfil ativo. Solicite acesso ao administrador."
                : error === "credenciais"
                  ? "Informe email e senha."
                  : "Credenciais invalidas."}
            </p>
          ) : null}
          <form action={loginAction} className="grid gap-4">
            <LoginFields />

            <label className="flex cursor-pointer items-center gap-2 text-[12.5px]" style={{ color: "var(--text-soft)" }}>
              <input
                name="manter_conectado"
                type="checkbox"
                defaultChecked
                className="h-4 w-4"
                style={{ accentColor: "var(--brand-600)" }}
              />
              Manter conectado neste dispositivo
            </label>

            <button className="rb-btn rb-btn-primary lg mt-1 w-full">
              Entrar <ArrowRight size={17} />
            </button>
          </form>

          <p
            className="mt-6 border-t pt-4 text-center text-[12px]"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            Ao acessar, você concorda com os{" "}
            <a href="/termos" className="font-semibold underline underline-offset-2" style={{ color: "var(--brand-600)" }}>
              Termos de Uso
            </a>{" "}
            e a{" "}
            <a
              href="/privacidade"
              className="font-semibold underline underline-offset-2"
              style={{ color: "var(--brand-600)" }}
            >
              Política de Privacidade
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
