import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";
import { NovaRubricaForm } from "@/components/rh/folha-v2/nova-rubrica-form";

export const dynamic = "force-dynamic";

export default async function NovaRubricaPage() {
  await requirePermission("rh.folha-v2", "create");

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "RH", href: "/rh/funcionarios" },
          { label: "Folha v2", href: "/rh/folha-v2" },
          { label: "Rubricas", href: "/rh/folha-v2/rubricas" },
          { label: "Nova" },
        ]}
        title="Nova rubrica"
        description="Cadastre uma verba do motor de rubricas."
      />

      <Panel className="p-6">
        <NovaRubricaForm />
      </Panel>
    </div>
  );
}
