import { PageHeader } from "@/components/ui/page-header";
import { EscalasManager } from "@/components/questionario/escalas-manager";
import { requirePermission } from "@/lib/auth/session";
import { listarEscalas } from "@/lib/data/questionario";
import { podeAcao } from "@/lib/questionario/acesso";

export default async function EscalasPage() {
  const session = await requirePermission("questionario.escala", "read");
  const escalas = await listarEscalas();

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Acadêmico" }, { label: "Questionário" }, { label: "Cadastro de escala" }]}
        title="Cadastro de Escala"
        counter={String(escalas.length)}
        description="Conjuntos de opções (ex.: Não observado / Em desenvolvimento / Desenvolvido) usados em questões com escala."
      />
      <EscalasManager
        escalas={escalas}
        podeCriar={podeAcao(session, "questionario.escala", "create")}
        podeEditar={podeAcao(session, "questionario.escala", "update")}
      />
    </div>
  );
}
