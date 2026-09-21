"use client";

import Link from "next/link";
import { updateUserAction } from "@/lib/actions/users";
import { useAction } from "@/lib/hooks/use-action";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/data/permissoes";

type Perfil = { id: string; nome: string; email: string; perfil: string };

export function EditarUsuarioForm({
  perfil,
  roles,
}: {
  perfil: Perfil;
  roles: Array<Role & { usuarios: number }>;
}) {
  const { run, pending } = useAction(updateUserAction, {
    success: "Usuário atualizado.",
    error: "Falha ao salvar o perfil.",
    // updateUserAction devolve redirectTo: "/usuarios" — o toast aparece e
    // useAction navega em seguida.
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    run(new FormData(e.currentTarget));
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <input type="hidden" name="perfilId" value={perfil.id} />
      <label>
        Nome
        <input name="nome" type="text" defaultValue={perfil.nome} required />
      </label>
      <label>
        Email (somente leitura)
        <input type="email" value={perfil.email} readOnly disabled />
      </label>
      <label>
        Perfil
        <select name="perfil" defaultValue={perfil.perfil} required>
          {roles.map((r) => (
            <option key={r.codigo} value={r.codigo}>
              {r.codigo === "admin" ? "Administrador" : r.nome}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-3">
        <Button type="submit" loading={pending}>Salvar</Button>
        <Link href="/usuarios" className="ds-button ds-button-secondary">Cancelar</Link>
      </div>
    </form>
  );
}
