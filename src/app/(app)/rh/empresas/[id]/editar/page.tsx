import { notFound } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { CompanyForm } from "@/components/rh/company-form";
import { updateCompanyAction } from "@/lib/actions/rh";
import { getCompanyById } from "@/lib/data/rh";
import { requirePermission } from "@/lib/auth/session";

// Mesmo padrão de `configuracoes/escola/page.tsx`: os códigos de erro vêm
// crus de `uploadCompanyLogoAction`/`removeCompanyLogoAction` (rh.ts) e sem
// esse mapa apareciam na tela como "arquivo_grande", "tipo_invalido" etc.
const ERROS: Record<string, string> = {
  sem_arquivo: "Selecione um arquivo.",
  arquivo_grande: "Arquivo maior que 2MB.",
  tipo_invalido: "Tipo de arquivo não suportado (JPG/PNG/WEBP)."
};

const SUCESSOS: Record<string, string> = {
  logo_atualizada: "Logo atualizada.",
  logo_removida: "Logo removida."
};

export default async function EditarEmpresaPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  await requirePermission("rh.empresas", "update");
  const { id } = await params;
  const sp = await searchParams;

  const company = await getCompanyById(id);
  if (!company) notFound();

  const errMsg = sp.erro ? (ERROS[sp.erro] ?? decodeURIComponent(sp.erro)) : null;
  const sucessoKey = Object.keys(SUCESSOS).find((k) => sp[k]);
  const sucMsg = sucessoKey ? SUCESSOS[sucessoKey] : null;

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

      {sucMsg ? (
        <div className="flex items-center gap-2 rounded-ui bg-success/10 p-3 text-sm font-semibold text-success">
          <CheckCircle2 size={16} />
          {sucMsg}
        </div>
      ) : null}

      {errMsg ? (
        <div className="flex items-center gap-2 rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">
          <AlertCircle size={16} />
          {errMsg}
        </div>
      ) : null}

      <Panel className="p-6">
        <CompanyForm action={updateCompanyAction} company={company} submitLabel="Salvar alterações" />
      </Panel>
    </div>
  );
}
