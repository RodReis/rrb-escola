import { PageHeader } from "@/components/ui/page-header";
import { GruposManager } from "@/components/questionario/grupos-manager";
import { requirePermission } from "@/lib/auth/session";
import { listarGrupos } from "@/lib/data/questionario";
import { podeAcao } from "@/lib/questionario/acesso";

export default async function GruposPage() {
  const session = await requirePermission("questionario.grupo", "read");
  const grupos = await listarGrupos();

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Acadêmico" }, { label: "Questionário" }, { label: "Cadastro de grupo de questão" }]}
        title="Cadastro de Grupo de Questão"
        counter={String(grupos.length)}
      />
      <GruposManager
        grupos={grupos}
        podeCriar={podeAcao(session, "questionario.grupo", "create")}
        podeEditar={podeAcao(session, "questionario.grupo", "update")}
      />
    </div>
  );
}
