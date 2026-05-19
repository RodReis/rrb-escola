import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/session";
import { TemplateMetaForm } from "@/components/rh/documentos/template-meta-form";

export default async function NovoTemplatePage() {
  await requirePermission("rh.templates", "create");
  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "RH", href: "/rh" }, { label: "Documentos", href: "/rh/documentos" }, { label: "Novo" }]}
        title="Novo template"
        description="Faça upload do .docx e informe metadados. O próximo passo é mapear os placeholders."
      />
      <TemplateMetaForm />
    </div>
  );
}
