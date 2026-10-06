import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { QuestionarioForm } from "@/components/questionario/questionario-form";
import { requirePermission } from "@/lib/auth/session";
import { getQuestionario, listarEscalas, listarGrupos, listarQuestoes } from "@/lib/data/questionario";
import { IdSchema } from "@/lib/validation/questionario";

export default async function EditarQuestionarioPage({ params }: { params: { id: string } }) {
  await requirePermission("questionario.questionario", "update");
  if (!IdSchema.safeParse(params.id).success) notFound();

  const [questionario, grupos, questoes, escalas] = await Promise.all([
    getQuestionario(params.id),
    listarGrupos(),
    listarQuestoes(),
    listarEscalas(),
  ]);
  if (!questionario) notFound();

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "Acadêmico" },
          { label: "Questionário" },
          { label: "Cadastro de questionário", href: "/questionario/questionarios" },
          { label: "Editar" },
        ]}
        title="Cadastro de Questionário"
      />
      <QuestionarioForm grupos={grupos} questoes={questoes} escalas={escalas} questionario={questionario} />
    </div>
  );
}
