import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { getTemplate } from "@/lib/data/templates";
import { extractPlaceholders } from "@/lib/documents/placeholders";
import { MappingForm } from "@/components/rh/documentos/mapping-form";

export default async function MapeamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("rh.templates", "update");
  const { id } = await params;
  const tpl = await getTemplate(id, session.profile.escola_id);
  if (!tpl) notFound();

  const supabase = await createServerClient();
  const { data: dl } = await supabase.storage.from("templates-documentos").download(tpl.storage_path);
  let placeholders: string[] = [];
  if (dl) {
    const buf = Buffer.from(await dl.arrayBuffer());
    placeholders = extractPlaceholders(buf);
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[
          { label: "RH", href: "/rh" },
          { label: "Documentos", href: "/rh/documentos" },
          { label: tpl.nome, href: `/rh/documentos/${tpl.id}` },
          { label: "Mapeamento" },
        ]}
        title={`Mapear placeholders — ${tpl.nome}`}
        description="Diga ao sistema de onde vem cada valor do template."
      />
      <MappingForm
        templateId={tpl.id}
        initial={tpl.mappings}
        placeholders={placeholders}
        activate={true}
      />
    </div>
  );
}
