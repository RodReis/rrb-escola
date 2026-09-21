"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { createUserAction, type CredencialGerada } from "@/lib/actions/users";
import { useAction } from "@/lib/hooks/use-action";
import { Button } from "@/components/ui/button";
import { CredencialModal } from "@/components/usuarios/credencial-modal";
import type { Role } from "@/lib/data/permissoes";

export function NovoUsuarioForm({ roles }: { roles: Array<Role & { usuarios: number }> }) {
  const router = useRouter();
  const [credencial, setCredencial] = useState<CredencialGerada | null>(null);
  const { run, pending } = useAction(createUserAction, {
    error: "Falha ao criar o usuário.",
    // A navegacao para /usuarios so acontece quando o modal fecha — antes
    // disso o usuario precisa ver e copiar a senha gerada.
    onSuccess: (data) => setCredencial((data as CredencialGerada) ?? null),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    run(new FormData(e.currentTarget));
  }

  function handleCloseModal() {
    setCredencial(null);
    router.push("/usuarios");
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="grid gap-4">
        <label>
          Nome
          <input name="nome" type="text" required />
        </label>
        <label>
          Email
          <input name="email" type="email" required />
        </label>
        <label>
          Perfil
          <select name="perfil" defaultValue="admin" required>
            {roles.map((r) => (
              <option key={r.codigo} value={r.codigo}>
                {r.codigo === "admin" ? "Administrador" : r.nome}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-3">
          <Button type="submit" loading={pending}>Criar</Button>
          <Link href="/usuarios" className="ds-button ds-button-secondary">Cancelar</Link>
        </div>
      </form>
      <CredencialModal credencial={credencial} onClose={handleCloseModal} />
    </>
  );
}
