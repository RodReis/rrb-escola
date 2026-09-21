"use client";

import { ArrowRight } from "lucide-react";
import { loginAction } from "@/lib/actions/auth";
import { useAction } from "@/lib/hooks/use-action";
import { Spinner } from "@/components/ui/spinner";
import { LoginFields } from "./login-fields";

export function LoginForm() {
  const { run, pending } = useAction(loginAction, {
    error: "Credenciais inválidas.",
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    run(new FormData(e.currentTarget));
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
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

      <button className="rb-btn rb-btn-primary lg mt-1 w-full" disabled={pending} aria-busy={pending || undefined}>
        {pending ? <Spinner size={16} className="text-white" /> : null}
        {pending ? "Entrando…" : "Entrar"}
        {!pending && <ArrowRight size={17} />}
      </button>
    </form>
  );
}
