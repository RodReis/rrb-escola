import { PageHeader } from "@/components/ui/page-header";
import { QuestaoForm } from "@/components/questionario/questao-form";
import { requirePermission } from "@/lib/auth/session";
import { listarGrupos } from "@/lib/data/questionario";

export default async function NovaQuestaoPage() {
  await requirePermission("questionario.questao", "create");
  const grupos = await listarGrupos();

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "Acadêmico" },
          { label: "Questionário" },
          { label: "Cadastro de questão", href: "/questionario/questoes" },
          { label: "Nova" },
        ]}
        title="Cadastro de Questão"
      />
      <QuestaoForm grupos={grupos} />
    </div>
  );
}
