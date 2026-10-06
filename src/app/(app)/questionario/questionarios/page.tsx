import { PageHeader } from "@/components/ui/page-header";
import { ButtonLink } from "@/components/ui/button";
import { QuestionariosLista } from "@/components/questionario/questionarios-lista";
import { requirePermission } from "@/lib/auth/session";
import { listarQuestionarios } from "@/lib/data/questionario";
import { podeAcao } from "@/lib/questionario/acesso";

export default async function QuestionariosPage() {
  const session = await requirePermission("questionario.questionario", "read");
  const questionarios = await listarQuestionarios();
  const podeCriar = podeAcao(session, "questionario.questionario", "create");

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Acadêmico" }, { label: "Questionário" }, { label: "Cadastro de questionário" }]}
        title="Cadastro de Questionário"
        counter={String(questionarios.length)}
        actions={
          podeCriar ? (
            <ButtonLink href="/questionario/questionarios/novo" variant="primary">+ Cadastrar</ButtonLink>
          ) : undefined
        }
      />
      <QuestionariosLista
        questionarios={questionarios}
        podeCriar={podeCriar}
        podeEditar={podeAcao(session, "questionario.questionario", "update")}
      />
    </div>
  );
}
