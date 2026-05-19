import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { CompanyForm } from "@/components/rh/company-form";
import { createCompanyAction } from "@/lib/actions/rh";
import { requirePermission } from "@/lib/auth/session";

export default async function NovaEmpresaPage({
  searchParams
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  await requirePermission("rh.empresas", "create");
  const params = await searchParams;

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "RH" }, { label: "Empresas", href: "/rh/empresas" }, { label: "Nova" }]}
        title="Nova empresa"
        description="Cadastre uma pessoa jurídica para vincular funcionários."
      />

      {params.erro ? (
        <div className="rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">{params.erro}</div>
      ) : null}

      <Panel className="p-6">
        <CompanyForm action={createCompanyAction} submitLabel="Criar empresa" />
      </Panel>
    </div>
  );
}
