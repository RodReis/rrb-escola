"use client";

import { useState } from "react";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";

// Campos interativos do login (ícone + toggle de senha). Client component —
// o <form action={loginAction}> permanece no Server Component da página.
// Conversão visual: nenhuma lógica de auth nova; names "email"/"password"
// continuam sendo lidos pela Server Action.
export function LoginFields() {
  const [show, setShow] = useState(false);

  return (
    <>
      <label className="rb-field">
        <span className="rb-label">E-mail</span>
        <span className="relative block">
          <Mail
            size={17}
            strokeWidth={1.8}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-faint)" }}
            aria-hidden="true"
          />
          <input
            name="email"
            type="email"
            required
            className="rb-input has-icon"
            autoComplete="email"
          />
        </span>
      </label>

      <label className="rb-field">
        <span className="flex items-baseline justify-between">
          <span className="rb-label">Senha</span>
          {/* Placeholder visual: fluxo de recuperação ainda não existe (sem rota). */}
          <a
            href="#"
            className="text-xs font-medium"
            style={{ color: "var(--brand-600)" }}
          >
            Esqueci a senha
          </a>
        </span>
        <span className="relative block">
          <Lock
            size={17}
            strokeWidth={1.8}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-faint)" }}
            aria-hidden="true"
          />
          <input
            name="password"
            type={show ? "text" : "password"}
            required
            className="rb-input has-icon"
            style={{ paddingRight: 44 }}
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Ocultar senha" : "Mostrar senha"}
            className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md"
            style={{ color: "var(--text-muted)", background: "transparent" }}
          >
            {show ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </span>
      </label>
    </>
  );
}
