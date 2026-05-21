import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { NovoComunicadoForm } from "@/components/comunicados/novo-comunicado-form";

export const dynamic = "force-dynamic";

export default async function NovoComunicadoPage() {
  const session = await requirePermission("comunicados", "create");
  const supabase = await createServerClient();

  const { data: alunosData } = await supabase
    .from("alunos")
    .select("id, nome, matriculas!inner(status)")
    .eq("escola_id", session.profile.escola_id)
    .eq("matriculas.status", "ativa")
    .order("nome");

  // Dedup — o join com matriculas pode repetir o aluno.
  const vistos = new Set<string>();
  const alunos: Array<{ id: string; nome: string }> = [];
  for (const a of (alunosData ?? []) as Array<{ id: string; nome: string }>) {
    if (vistos.has(a.id)) continue;
    vistos.add(a.id);
    alunos.push({ id: a.id, nome: a.nome });
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[
          { label: "RH" },
          { label: "Comunicados", href: "/comunicados" },
          { label: "Novo" },
        ]}
        title="Novo comunicado"
        description="Envie um aviso aos responsáveis via WhatsApp."
      />
      <NovoComunicadoForm alunos={alunos} />
    </div>
  );
}
