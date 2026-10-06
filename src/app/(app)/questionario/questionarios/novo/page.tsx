import { PageHeader } from "@/components/ui/page-header";
import { QuestionarioForm } from "@/components/questionario/questionario-form";
import { requirePermission } from "@/lib/auth/session";
import { listarEscalas, listarGrupos, listarQuestoes } from "@/lib/data/questionario";

export default async function NovoQuestionarioPage() {
  await requirePermission("questionario.questionario", "create");
  const [grupos, questoes, escalas] = await Promise.all([listarGrupos(), listarQuestoes(), listarEscalas()]);

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "Acadêmico" },
          { label: "Questionário" },
          { label: "Cadastro de questionário", href: "/questionario/questionarios" },
          { label: "Novo" },
        ]}
        title="Cadastro de Questionário"
      />
      <QuestionarioForm grupos={grupos} questoes={questoes} escalas={escalas} />
    </div>
  );
}
