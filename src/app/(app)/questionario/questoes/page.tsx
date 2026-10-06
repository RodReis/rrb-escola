import { PageHeader } from "@/components/ui/page-header";
import { ButtonLink } from "@/components/ui/button";
import { QuestoesLista } from "@/components/questionario/questoes-lista";
import { requirePermission } from "@/lib/auth/session";
import { listarQuestoes } from "@/lib/data/questionario";
import { podeAcao } from "@/lib/questionario/acesso";

export default async function QuestoesPage() {
  const session = await requirePermission("questionario.questao", "read");
  const questoes = await listarQuestoes();

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Acadêmico" }, { label: "Questionário" }, { label: "Cadastro de questão" }]}
        title="Cadastro de Questão"
        counter={String(questoes.length)}
        actions={
          podeAcao(session, "questionario.questao", "create") ? (
            <ButtonLink href="/questionario/questoes/nova" variant="primary">+ Cadastrar</ButtonLink>
          ) : undefined
        }
      />
      <QuestoesLista questoes={questoes} podeEditar={podeAcao(session, "questionario.questao", "update")} />
    </div>
  );
}
