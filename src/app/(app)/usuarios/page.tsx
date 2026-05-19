import Link from "next/link";
import { Plus, Search, Pencil, KeyRound, UserX, UserCheck } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import {
  deactivateUserAction,
  reactivateUserAction,
  resetPasswordAction,
} from "@/lib/actions/users";
import { readUserCreatedFlash } from "@/lib/actions/user-flash";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { DataTableShell } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";

export const dynamic = "force-dynamic";

const PERFIL_LABEL: Record<string, string> = {
  admin: "Admin",
  secretaria: "Secretaria",
  financeiro: "Financeiro",
  professor: "Professor",
};

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{
    criado?: string;
    desativado?: string;
    reativado?: string;
    senha?: string;
    email?: string;
    atualizado?: string;
    erro?: string;
    q?: string;
    perfil?: string;
    status?: string;
  }>;
}) {
  await requirePermission("usuarios", "read");
  const sp = await searchParams;

  const supabase = await createServerClient();
  let query = supabase
    .from("perfis")
    .select("id, nome, email, perfil, ativo, created_at")
    .order("created_at", { ascending: false });

  if (sp.perfil && PERFIL_LABEL[sp.perfil]) {
    query = query.eq("perfil", sp.perfil);
  }
  if (sp.status === "ativo") query = query.eq("ativo", true);
  if (sp.status === "inativo") query = query.eq("ativo", false);
  if (sp.q && sp.q.trim()) {
    const q = sp.q.trim();
    query = query.or(`nome.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const { data: perfis } = await query;
  const flash = (sp.criado || sp.senha) ? readUserCreatedFlash() : null;
  const rows = perfis ?? [];
  const ativos = rows.filter((p) => p.ativo).length;

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "Administração" }, { label: "Usuários" }]}
        title="Usuários"
        counter={rows.length.toLocaleString("pt-BR")}
        description="Gerencie acesso, perfis e status dos usuários."
        actions={
          <ButtonLink href="/usuarios/novo" variant="primary">
            <Plus size={14} /> Novo usuário
          </ButtonLink>
        }
        kpis={[
          { label: "Total", value: rows.length.toLocaleString("pt-BR") },
          { label: "Ativos", value: ativos.toLocaleString("pt-BR"), tone: "success" },
          { label: "Inativos", value: (rows.length - ativos).toLocaleString("pt-BR"), tone: "danger" },
        ]}
      />

      {flash && (
        <div className="rounded-ui bg-success/10 p-4 text-sm font-semibold text-success">
          {sp.senha ? "Nova senha gerada" : "Usuário criado"} para <strong>{flash.email}</strong>. Senha: <code className="font-mono">{flash.password}</code>
          <p className="mt-1 text-xs font-medium text-ink/55">
            {sp.email
              ? "Email enviado com as credenciais. Senha não será exibida novamente."
              : "Email NÃO enviado (Resend não configurado). Anote agora — não será exibida novamente."}
          </p>
        </div>
      )}
      {sp.desativado && <div className="rounded-ui bg-success/10 p-4 text-sm font-semibold text-success">Usuário desativado.</div>}
      {sp.reativado && <div className="rounded-ui bg-success/10 p-4 text-sm font-semibold text-success">Usuário reativado.</div>}
      {sp.atualizado && <div className="rounded-ui bg-success/10 p-4 text-sm font-semibold text-success">Usuário atualizado.</div>}
      {sp.erro && (
        <div className="rounded-ui bg-danger/10 p-4 text-sm font-semibold text-danger">
          {sp.erro === "self" ? "Você não pode desativar a própria conta." : `Falha: ${decodeURIComponent(sp.erro)}`}
        </div>
      )}

      <Panel>
        <form className="grid gap-3 md:grid-cols-[1fr_180px_160px_auto] items-end">
          <label className="relative">
            <span className="text-xs font-semibold text-ink/55">Buscar</span>
            <Search size={14} className="absolute left-3 bottom-3 text-ink/40" />
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Nome ou email"
              className="pl-9"
            />
          </label>
          <label>
            <span className="text-xs font-semibold text-ink/55">Perfil</span>
            <select name="perfil" defaultValue={sp.perfil ?? ""}>
              <option value="">Todos</option>
              <option value="admin">Admin</option>
              <option value="secretaria">Secretaria</option>
              <option value="financeiro">Financeiro</option>
              <option value="professor">Professor</option>
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold text-ink/55">Status</span>
            <select name="status" defaultValue={sp.status ?? ""}>
              <option value="">Todos</option>
              <option value="ativo">Ativos</option>
              <option value="inativo">Inativos</option>
            </select>
          </label>
          <div className="flex gap-2">
            <button className="ds-button ds-button-primary">Filtrar</button>
            <Link href="/usuarios" className="ds-button ds-button-secondary">Limpar</Link>
          </div>
        </form>
      </Panel>

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
                <td colSpan={5} className="py-8 text-center text-ink/55">Nenhum usuário encontrado.</td>
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
                      <form action={resetPasswordAction} className="inline">
                        <input type="hidden" name="perfilId" value={p.id} />
                        <button
                          title="Resetar senha"
                          aria-label="Resetar senha"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-warning hover:bg-warning/10"
                        >
                          <KeyRound size={15} />
                        </button>
                      </form>
                      {p.ativo ? (
                        <form action={deactivateUserAction} className="inline">
                          <input type="hidden" name="perfilId" value={p.id} />
                          <button
                            title="Desativar"
                            aria-label="Desativar"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-danger hover:bg-danger/10"
                          >
                            <UserX size={15} />
                          </button>
                        </form>
                      ) : (
                        <form action={reactivateUserAction} className="inline">
                          <input type="hidden" name="perfilId" value={p.id} />
                          <button
                            title="Reativar"
                            aria-label="Reativar"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-success hover:bg-success/10"
                          >
                            <UserCheck size={15} />
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </DataTableShell>
    </div>
  );
}
