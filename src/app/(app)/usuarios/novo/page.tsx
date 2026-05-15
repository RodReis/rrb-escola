import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { createUserAction } from "@/lib/actions/users";

export const dynamic = "force-dynamic";

export default async function NovoUsuarioPage({ searchParams }: { searchParams: { erro?: string } }) {
  await requireAdmin();

  return (
    <section className="ds-section max-w-lg">
      <header className="mb-6">
        <p className="ds-kicker">Administracao</p>
        <h1 className="font-serif text-3xl text-ink">Novo usuario</h1>
        <p className="mt-2 text-sm text-muted">Senha aleatoria sera gerada e exibida apos criar.</p>
      </header>

      {searchParams.erro ? (
        <div className="mb-4 rounded-ui bg-clay/10 p-3 text-sm font-bold text-clay">
          {searchParams.erro === "campos"
            ? "Informe nome e email."
            : searchParams.erro === "auth"
              ? "Falha ao criar usuario no Supabase."
              : searchParams.erro === "perfil"
                ? "Falha ao criar perfil."
                : "Falha desconhecida."}
        </div>
      ) : null}

      <form action={createUserAction} className="grid gap-4">
        <label>
          Nome
          <input name="nome" type="text" required />
        </label>
        <label>
          Email
          <input name="email" type="email" required />
        </label>
        <div className="flex gap-3">
          <button className="ds-button ds-button-primary">Criar</button>
          <Link href="/usuarios" className="ds-button ds-button-secondary">Cancelar</Link>
        </div>
      </form>
    </section>
  );
}
