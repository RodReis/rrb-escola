import { AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { NovoComunicadoForm } from "@/components/comunicados/novo-comunicado-form";
import { listTurmasESeries } from "@/lib/data/comunicados";

export const dynamic = "force-dynamic";

const ERRO_LABEL: Record<string, string> = {
  campos_obrigatorios: "Preencha o título e a mensagem.",
  alcance_invalido: "Selecione um alcance válido.",
  aluno_obrigatorio: "Selecione o aluno para o comunicado individual.",
  alvos_obrigatorios: "Selecione ao menos uma turma ou série.",
  imagem_tipo: "A imagem deve ser PNG, JPG ou WEBP.",
  imagem_grande: "A imagem excede o limite de 5MB.",
};

function mensagemErro(codigo: string | undefined): string | null {
  if (!codigo) return null;
  return ERRO_LABEL[codigo] ?? `Erro ao enviar o comunicado: ${codigo}`;
}

export default async function NovoComunicadoPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const session = await requirePermission("comunicados", "create");
  const { erro } = await searchParams;
  const erroMsg = mensagemErro(erro);

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

  const { turmas, series } = await listTurmasESeries(session.profile.escola_id);

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

      {erroMsg && (
        <div className="flex items-center gap-2 rounded-ui border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          <AlertCircle size={16} />
          {erroMsg}
        </div>
      )}

      <NovoComunicadoForm alunos={alunos} turmas={turmas} series={series} />
    </div>
  );
}
