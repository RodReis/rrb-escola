import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { RequerimentoEmissaoForm } from "@/components/matriculas/requerimento-emissao-form";
import { listarAlunosParaRequerimento } from "@/lib/data/requerimento-matricula";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { createServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { getAnoReferenciaAtual } from "@/lib/escola/ano-referencia";

export default async function EmitirRequerimentoPage({
  searchParams
}: {
  searchParams: Promise<{ ano?: string; serie?: string; turma?: string; aluno?: string }>;
}) {
  const session = await requirePermission("historico", "read");
  const sp = await searchParams;

  const supabase = await createServerClient();
  const anoReferencia = await getAnoReferenciaAtual(supabase, session.profile.escola_id);
  const anoLetivo = sp.ano ? Number(sp.ano) : anoReferencia;

  const [{ data: series }, { data: turmas }, alunosElegiveis] = await Promise.all([
    supabase.from("series").select("id, nome").eq("escola_id", DEFAULT_SCHOOL_ID).eq("ativo", true).order("ordem"),
    supabase.from("turmas").select("id, nome, serie_id, turno").eq("escola_id", DEFAULT_SCHOOL_ID).eq("ano_letivo", anoLetivo).order("turno"),
    listarAlunosParaRequerimento({
      anoLetivo,
      serieId: sp.serie || undefined,
      turmaId: sp.turma || undefined,
      alunoId: sp.aluno || undefined
    })
  ]);

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Secretaria" }, { label: "Histórico Escolar" }, { label: "Requerimento de Matrícula" }]}
        title="Emissão de Requerimento de Matrícula"
      />
      <Panel className="p-6">
        <RequerimentoEmissaoForm
          anoLetivo={anoLetivo}
          series={(series ?? []).map((s) => ({ id: s.id as string, nome: s.nome as string }))}
          turmas={(turmas ?? []).map((t) => ({ id: t.id as string, nome: t.nome as string, serieId: t.serie_id as string, turno: String(t.turno) }))}
          alunosElegiveis={alunosElegiveis}
        />
      </Panel>
    </div>
  );
}
