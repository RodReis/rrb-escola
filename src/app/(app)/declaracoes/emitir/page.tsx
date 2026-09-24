import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { DeclaracaoEmissaoForm } from "@/components/declaracoes/declaracao-emissao-form";
import { listarAlunosParaDeclaracao } from "@/lib/data/declaracao-emissao";
import { listarDeclaracaoModelos } from "@/lib/data/declaracoes";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { createServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";

export default async function EmitirDeclaracaoPage({
  searchParams
}: {
  searchParams: Promise<{ serie?: string; turma?: string; aluno?: string; modelo?: string }>;
}) {
  await requirePermission("historico", "read");
  const sp = await searchParams;
  const anoLetivo = new Date().getFullYear();

  const supabase = await createServerClient();
  const [{ data: series }, { data: turmas }, modelos, alunosElegiveis] = await Promise.all([
    supabase.from("series").select("id, nome").eq("escola_id", DEFAULT_SCHOOL_ID).eq("ativo", true).order("ordem"),
    supabase.from("turmas").select("id, nome, serie_id").eq("escola_id", DEFAULT_SCHOOL_ID).eq("ano_letivo", anoLetivo),
    listarDeclaracaoModelos(),
    listarAlunosParaDeclaracao({
      anoLetivo,
      serieId: sp.serie || undefined,
      turmaId: sp.turma || undefined,
      alunoId: sp.aluno || undefined
    })
  ]);

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Acadêmico" }, { label: "Declarações", href: "/declaracoes" }, { label: "Emitir" }]}
        title="Emissão de declaração pedagógica"
      />
      <Panel className="p-6">
        <DeclaracaoEmissaoForm
          anoLetivo={anoLetivo}
          series={(series ?? []).map((s) => ({ id: s.id as string, nome: s.nome as string }))}
          turmas={(turmas ?? []).map((t) => ({ id: t.id as string, nome: t.nome as string, serieId: t.serie_id as string }))}
          alunosElegiveis={alunosElegiveis}
          modelos={modelos}
        />
      </Panel>
    </div>
  );
}
