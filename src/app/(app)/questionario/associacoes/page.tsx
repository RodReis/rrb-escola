import { PageHeader } from "@/components/ui/page-header";
import { AssociacoesManager } from "@/components/questionario/associacoes-manager";
import { requirePermission } from "@/lib/auth/session";
import { listProfessores } from "@/lib/data/pedagogico";
import { listarAssociacoes, listarQuestionarios, listarTurmasOpcoes } from "@/lib/data/questionario";
import { podeAcao } from "@/lib/questionario/acesso";

export default async function AssociacoesPage() {
  const session = await requirePermission("questionario.associacao", "read");
  const [associacoes, questionarios, turmas, professores] = await Promise.all([
    listarAssociacoes(),
    listarQuestionarios(),
    listarTurmasOpcoes(),
    listProfessores(),
  ]);

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Acadêmico" }, { label: "Questionário" }, { label: "Associação da série ao questionário" }]}
        title="Associação da Série ao Questionário"
        counter={String(associacoes.length)}
        description="Define qual questionário cada professor preenche, por turma e etapa."
      />
      <AssociacoesManager
        associacoes={associacoes}
        questionarios={questionarios}
        turmas={turmas}
        professores={professores}
        podeCriar={podeAcao(session, "questionario.associacao", "create")}
        podeEditar={podeAcao(session, "questionario.associacao", "update")}
      />
    </div>
  );
}
