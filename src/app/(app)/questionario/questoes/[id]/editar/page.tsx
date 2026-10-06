import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { QuestaoForm } from "@/components/questionario/questao-form";
import { requirePermission } from "@/lib/auth/session";
import { getQuestao, listarGrupos } from "@/lib/data/questionario";
import { IdSchema } from "@/lib/validation/questionario";

export default async function EditarQuestaoPage({ params }: { params: { id: string } }) {
  await requirePermission("questionario.questao", "update");
  if (!IdSchema.safeParse(params.id).success) notFound();

  const [questao, grupos] = await Promise.all([getQuestao(params.id), listarGrupos()]);
  if (!questao) notFound();

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "Acadêmico" },
          { label: "Questionário" },
          { label: "Cadastro de questão", href: "/questionario/questoes" },
          { label: "Editar" },
        ]}
        title="Cadastro de Questão"
      />
      <QuestaoForm grupos={grupos} questao={questao} />
    </div>
  );
}
