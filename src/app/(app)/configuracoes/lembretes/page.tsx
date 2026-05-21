import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/session";
import { getConfigLembretes, listarLembretesPendentes } from "@/lib/data/lembretes";
import { ConfigLembretesForm } from "@/components/lembretes/config-lembretes-form";

export const dynamic = "force-dynamic";

export default async function LembretesConfigPage() {
  const session = await requirePermission("financeiro.cobrancas", "read");

  const config = await getConfigLembretes(session.profile.escola_id);
  const pendentes = await listarLembretesPendentes(session.profile.escola_id);

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "Configurações" }, { label: "Lembretes" }]}
        title="Lembretes de inadimplência"
        description="Avisa o responsável financeiro por WhatsApp quando uma cobrança vence."
      />
      <ConfigLembretesForm
        autoAtivo={config.autoAtivo}
        pendentes={pendentes}
      />
    </div>
  );
}
