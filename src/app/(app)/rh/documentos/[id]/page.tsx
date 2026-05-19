import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { getTemplate } from "@/lib/data/templates";
import { extractPlaceholders } from "@/lib/documents/placeholders";
import { updateTemplateAction, toggleTemplateAtivoAction } from "@/lib/actions/templates";
import { MappingForm } from "@/components/rh/documentos/mapping-form";
import { DeleteTemplateButton } from "@/components/rh/documentos/delete-template-button";

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
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
          { label: tpl.nome },
        ]}
        title={tpl.nome}
        description={`Categoria: ${tpl.categoria} · Gerados: ${tpl.gerado_count.toLocaleString("pt-BR")}`}
      />

      <Panel className="grid max-w-2xl gap-4">
        <h2 className="font-serif text-xl text-ink">Metadados</h2>
        <form action={updateTemplateAction} className="grid gap-3">
          <input type="hidden" name="template_id" value={tpl.id} />
          <label className="grid gap-1 text-sm">
            Nome
            <input name="nome" defaultValue={tpl.nome} required minLength={3} maxLength={120} />
          </label>
          <label className="grid gap-1 text-sm">
            Categoria
            <select name="categoria" defaultValue={tpl.categoria}>
              <option value="declaracao">Declaração</option>
              <option value="termo">Termo</option>
              <option value="contrato">Contrato</option>
              <option value="outro">Outro</option>
            </select>
          </label>
          <div className="flex justify-end">
            <button className="ds-button ds-button-primary">Salvar metadados</button>
          </div>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
          <form action={toggleTemplateAtivoAction}>
            <input type="hidden" name="template_id" value={tpl.id} />
            <input type="hidden" name="ativo" value={tpl.ativo ? "0" : "1"} />
            <button className="ds-button ds-button-secondary">
              {tpl.ativo ? "Desativar" : "Ativar"}
            </button>
          </form>
          {tpl.gerado_count === 0 && <DeleteTemplateButton templateId={tpl.id} nome={tpl.nome} />}
          <Link href={`/rh/documentos/${tpl.id}/mapeamento`} className="ds-button ds-button-secondary">
            Editar mappings
          </Link>
        </div>
      </Panel>

      <Panel className="grid gap-3">
        <h2 className="font-serif text-xl text-ink">Mappings</h2>
        <MappingForm
          templateId={tpl.id}
          initial={tpl.mappings}
          placeholders={placeholders}
          activate={false}
        />
      </Panel>
    </div>
  );
}
