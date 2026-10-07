import { PageHeader } from "@/components/ui/page-header";
import { SecoesManager } from "@/components/questionario/secoes-manager";
import { requirePermission } from "@/lib/auth/session";
import { listarSecoes } from "@/lib/data/questionario";
import { podeAcao } from "@/lib/questionario/acesso";

export default async function SecoesPage() {
  const session = await requirePermission("questionario.secao", "read");
  const secoes = await listarSecoes();

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Acadêmico" }, { label: "Questionário" }, { label: "Seções da ficha avaliativa" }]}
        title="Seções da Ficha Avaliativa"
        counter={String(secoes.length)}
      />
      <SecoesManager
        secoes={secoes}
        podeCriar={podeAcao(session, "questionario.secao", "create")}
        podeEditar={podeAcao(session, "questionario.secao", "update")}
      />
    </div>
  );
}
