import { loginAction } from "@/lib/actions/auth";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ArrowRight, Database, School, ShieldCheck, Sparkles, AlertCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const dynamic = "force-dynamic";

const trustItems: Array<{ icon: LucideIcon; label: string }> = [
  { icon: Database, label: "Supabase local" },
  { icon: ShieldCheck, label: "Auth integrado" },
  { icon: Sparkles, label: "Claro e escuro" }
];

function BrandMark() {
  return (
    <span className="relative grid h-14 w-14 place-items-center overflow-hidden rounded-ui bg-brand text-paper shadow-soft">
      <span className="absolute -right-2 top-0 h-20 w-9 rotate-[34deg] bg-accent" />
      <School className="relative z-10" size={28} />
    </span>
  );
}

export default async function LoginPage({ searchParams }: { searchParams: { erro?: string } }) {
  const error = searchParams.erro;

  return (
    <main className="min-h-screen bg-surface px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl justify-end">
        <ThemeToggle />
      </div>
      <section className="mx-auto grid min-h-[calc(100vh-6rem)] max-w-7xl items-center gap-10 lg:grid-cols-[1fr_440px]">
        <div className="max-w-3xl">
          <BrandMark />
          <p className="mt-8 ds-kicker">Gestão escolar local</p>
          <h1 className="mt-4 font-serif text-5xl leading-none text-brand md:text-7xl">Lectiva</h1>
          <p className="mt-5 max-w-2xl text-xl font-semibold leading-8 text-ink">
            Secretaria, matrículas e cobranças em uma base local.
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
            Frequência, portaria, relatórios em PDF e operação diária conectados exclusivamente ao Supabase local via Docker.
          </p>

          <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
            {trustItems.map(({ icon: Icon, label }) => (
              <div key={label} className="ds-card flex items-center gap-3 p-4 text-sm font-bold">
                <Icon className="text-accent" size={18} />
                {label}
              </div>
            ))}
          </div>
        </div>

        <div className="ds-panel p-6">
          <div className="mb-7">
            <p className="ds-kicker">Acesso administrativo</p>
            <h2 className="mt-2 font-serif text-3xl text-ink">Entrar no sistema</h2>
            <p className="mt-2 text-sm font-medium text-muted">Login validado pelo Supabase Auth local.</p>
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
            <label>
              Email
              <input name="email" type="email" defaultValue="admin@rrbescola.local" required />
            </label>
            <label>
              Senha
              <input name="password" type="password" defaultValue="rrb123456" required />
            </label>
            <button className="ds-button ds-button-primary mt-2 w-full">
              Entrar <ArrowRight size={17} />
            </button>
          </form>

          <div className="mt-7 rounded-panel border border-line bg-muted p-4">
            <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase text-muted">
              <span>Hoje</span>
              <span>Financeiro</span>
            </div>
            <div className="grid gap-2">
              {["Matriculas ativas", "Mensalidades pagas", "Presencas registradas"].map((item, index) => (
                <div key={item} className="flex items-center justify-between rounded-ui bg-surface px-3 py-2 text-sm font-bold">
                  <span>{item}</span>
                  <span className={index === 1 ? "text-[rgb(var(--color-success))]" : "text-brand"}>
                    {index === 0 ? "136" : index === 1 ? "82%" : "Hoje"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
