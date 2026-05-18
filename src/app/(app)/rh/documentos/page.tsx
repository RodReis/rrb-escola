import { Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth/session";
import { listTemplates, type TemplateRow } from "@/lib/data/templates";
import { TemplatesTable } from "@/components/rh/documentos/templates-table";

const CATEGORIAS = ["declaracao", "termo", "contrato", "outro"] as const;

export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; status?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const categoria = (CATEGORIAS as readonly string[]).includes(params.categoria ?? "")
    ? (params.categoria as TemplateRow["categoria"])
    : undefined;
  const status = params.status === "ativo" || params.status === "inativo" ? params.status : "todos";

  const templates = await listTemplates(session.profile.escola_id, { categoria, status });

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "RH", href: "/rh" }, { label: "Documentos" }]}
        title="Templates de documentos"
        counter={templates.length.toLocaleString("pt-BR")}
        description="Gerencie modelos .docx parametrizáveis usados na ficha do aluno."
        actions={
          <ButtonLink href="/rh/documentos/novo" variant="primary">
            <Plus size={14} /> Novo template
          </ButtonLink>
        }
      />

      <form className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          Categoria
          <select name="categoria" defaultValue={categoria ?? ""} className="rounded-ui border border-line bg-surface px-3 py-1.5 text-sm">
            <option value="">Todas</option>
            <option value="declaracao">Declaração</option>
            <option value="termo">Termo</option>
            <option value="contrato">Contrato</option>
            <option value="outro">Outro</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          Status
          <select name="status" defaultValue={status} className="rounded-ui border border-line bg-surface px-3 py-1.5 text-sm">
            <option value="todos">Todos</option>
            <option value="ativo">Ativos</option>
            <option value="inativo">Inativos</option>
          </select>
        </label>
        <button className="ds-button ds-button-secondary">Filtrar</button>
      </form>

      <TemplatesTable templates={templates} />
    </div>
  );
}
