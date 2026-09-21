"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, KeyRound, UserX, UserCheck, Users } from "lucide-react";
import {
  deactivateUserAction,
  reactivateUserAction,
  resetPasswordAction,
  type CredencialGerada,
} from "@/lib/actions/users";
import { RowActionButton } from "@/components/ui/row-action-button";
import { DataTableShell } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";
import { CredencialModal } from "@/components/usuarios/credencial-modal";

const PERFIL_LABEL: Record<string, string> = {
  admin: "Admin",
  secretaria: "Secretaria",
  financeiro: "Financeiro",
  professor: "Professor",
};

type Perfil = {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  ativo: boolean;
};

export function UsuariosGrid({ rows }: { rows: Perfil[] }) {
  const [credencial, setCredencial] = useState<CredencialGerada | null>(null);

  return (
    <>
      <DataTableShell>
        <table className="ds-dt min-w-[720px]">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Email</th>
              <th>Perfil</th>
              <th>Status</th>
              <th className="w-[140px] text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12">
                  <div className="flex flex-col items-center justify-center gap-2 text-ink/60">
                    <Users size={28} />
                    <p className="text-sm font-medium">Nenhum usuário encontrado.</p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr key={p.id}>
                  <td className="font-semibold text-ink">{p.nome}</td>
                  <td className="text-ink/75">{p.email}</td>
                  <td>
                    <span className="rounded-pill bg-muted px-2 py-0.5 text-xs font-semibold text-ink/70">
                      {PERFIL_LABEL[p.perfil] ?? p.perfil}
                    </span>
                  </td>
                  <td>
                    <StatusPill tone={p.ativo ? "success" : "danger"}>
                      {p.ativo ? "Ativo" : "Inativo"}
                    </StatusPill>
                  </td>
                  <td className="text-center">
                    <div className="inline-flex items-center justify-center gap-1">
                      <Link
                        href={`/usuarios/${p.id}/editar`}
                        title="Editar"
                        aria-label="Editar"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-brand hover:bg-brand/10"
                      >
                        <Pencil size={15} />
                      </Link>
                      <RowActionButton
                        action={resetPasswordAction}
                        args={{ perfilId: p.id }}
                        icon={KeyRound}
                        label="Resetar senha"
                        tone="warning"
                        confirm={{
                          title: "Resetar senha",
                          message: `Resetar a senha de "${p.nome}"? O usuário receberá uma senha nova.`,
                          confirmLabel: "Resetar",
                          variant: "warning",
                        }}
                        error="Falha ao resetar a senha."
                        onSuccess={(data) => setCredencial((data as CredencialGerada) ?? null)}
                      />
                      {p.ativo ? (
                        <RowActionButton
                          action={deactivateUserAction}
                          args={{ perfilId: p.id }}
                          icon={UserX}
                          label="Desativar"
                          tone="danger"
                          confirm={{
                            title: "Desativar usuário",
                            message: `Desativar "${p.nome}"? Ele perde o acesso ao sistema.`,
                            confirmLabel: "Desativar",
                            variant: "danger",
                          }}
                          success="Usuário desativado."
                          error="Falha ao desativar o usuário."
                        />
                      ) : (
                        <RowActionButton
                          action={reactivateUserAction}
                          args={{ perfilId: p.id }}
                          icon={UserCheck}
                          label="Reativar"
                          tone="success"
                          success="Usuário reativado."
                          error="Falha ao reativar o usuário."
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </DataTableShell>
      <CredencialModal credencial={credencial} onClose={() => setCredencial(null)} />
    </>
  );
}
