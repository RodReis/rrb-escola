import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { UsuariosGrid } from "@/components/usuarios/usuarios-grid";

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

      <Panel>
        <form className="grid gap-3 md:grid-cols-[1fr_180px_160px_auto] items-end">
          <label className="relative">
            <span className="text-xs font-semibold text-ink/60">Buscar</span>
            <Search size={14} className="absolute left-3 bottom-3 text-ink/40" />
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Nome ou email"
              className="pl-9"
            />
          </label>
          <label>
            <span className="text-xs font-semibold text-ink/60">Perfil</span>
            <select name="perfil" defaultValue={sp.perfil ?? ""}>
              <option value="">Todos</option>
              <option value="admin">Admin</option>
              <option value="secretaria">Secretaria</option>
              <option value="financeiro">Financeiro</option>
              <option value="professor">Professor</option>
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold text-ink/60">Status</span>
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

      <UsuariosGrid rows={rows} />
    </div>
  );
}
