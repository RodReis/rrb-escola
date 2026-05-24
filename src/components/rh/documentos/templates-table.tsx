import Link from "next/link";
import { Download, Edit3, Power, PowerOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { toggleTemplateAtivoAction } from "@/lib/actions/templates";
import { DeleteTemplateButton } from "@/components/rh/documentos/delete-template-button";
import type { TemplateRow } from "@/lib/data/templates";

const catLabel: Record<TemplateRow["categoria"], string> = {
  declaracao: "Declaração",
  termo: "Termo",
  contrato: "Contrato",
  outro: "Outro",
};

export function TemplatesTable({ templates }: { templates: TemplateRow[] }) {
  if (templates.length === 0) {
    return (
      <p className="rounded-ui border border-line bg-surface p-6 text-sm text-muted">
        Nenhum template cadastrado. Clique em &quot;Novo template&quot; para começar.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-ui border border-line bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-paper text-left text-xs uppercase tracking-kicker text-ink/55">
          <tr>
            <th className="px-4 py-3">Nome</th>
            <th className="px-4 py-3">Categoria</th>
            <th className="px-4 py-3 text-right">Gerados</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((t) => {
            const rascunho = (t.mappings ?? []).length === 0;
            return (
              <tr key={t.id} className="border-t border-line align-middle">
                <td className="px-4 py-3">
                  <Link href={`/rh/documentos/${t.id}`} className="font-semibold text-ink hover:underline">
                    {t.nome}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted">{catLabel[t.categoria]}</td>
                <td className="px-4 py-3 text-right tabular-nums">{t.gerado_count.toLocaleString("pt-BR")}</td>
                <td className="px-4 py-3">
                  {rascunho ? (
                    <Badge tone="gold">Rascunho</Badge>
                  ) : t.ativo ? (
                    <Badge tone="green">Ativo</Badge>
                  ) : (
                    <Badge tone="gray">Inativo</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <a
                      href={`/api/rh/documentos/${t.id}/download`}
                      className="inline-flex items-center gap-1 rounded-ui border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink hover:bg-muted/60"
                      title="Baixar .docx original"
                    >
                      <Download size={12} /> .docx
                    </a>
                    <Link
                      href={`/rh/documentos/${t.id}`}
                      className="inline-flex items-center gap-1 rounded-ui border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink hover:bg-muted/60"
                    >
                      <Edit3 size={12} /> Editar
                    </Link>
                    <form action={toggleTemplateAtivoAction}>
                      <input type="hidden" name="template_id" value={t.id} />
                      <input type="hidden" name="ativo" value={t.ativo ? "0" : "1"} />
                      <ConfirmButton
                        message={`Tem certeza que quer ${t.ativo ? "desativar" : "ativar"} o template "${t.nome}"?`}
                        className="inline-flex items-center gap-1 rounded-ui border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink hover:bg-muted/60"
                      >
                        {t.ativo ? <><PowerOff size={12} /> Desativar</> : <><Power size={12} /> Ativar</>}
                      </ConfirmButton>
                    </form>
                    {t.gerado_count === 0 && (
                      <DeleteTemplateButton templateId={t.id} nome={t.nome} />
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
