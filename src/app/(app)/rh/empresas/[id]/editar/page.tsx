import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { CompanyForm } from "@/components/rh/company-form";
import { updateCompanyAction } from "@/lib/actions/rh";
import { getCompanyById } from "@/lib/data/rh";
import { requirePermission } from "@/lib/auth/session";

export default async function EditarEmpresaPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  await requirePermission("rh.empresas", "update");
  const { id } = await params;
  const sp = await searchParams;

  const company = await getCompanyById(id);
  if (!company) notFound();

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "RH" },
          { label: "Empresas", href: "/rh/empresas" },
          { label: company.name }
        ]}
        title="Editar empresa"
        counter={company.cnpj}
      />

      {sp.erro ? (
        <div className="rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">{sp.erro}</div>
      ) : null}

      <Panel className="p-6">
        <CompanyForm action={updateCompanyAction} company={company} submitLabel="Salvar alterações" />
      </Panel>
    </div>
  );
}
