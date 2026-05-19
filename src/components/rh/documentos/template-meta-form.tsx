import { uploadTemplateAction } from "@/lib/actions/templates";

export function TemplateMetaForm() {
  return (
    <form
      action={uploadTemplateAction}
      encType="multipart/form-data"
      className="grid max-w-2xl gap-4 rounded-ui border border-line bg-surface p-6"
    >
      <label className="grid gap-1 text-sm">
        <span className="font-semibold text-ink">Arquivo .docx</span>
        <input
          type="file"
          name="arquivo"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          required
        />
        <span className="text-xs text-muted">Máx. 5 MB. Use placeholders no formato {`{NOME_ALUNO}`}.</span>
      </label>

      <label className="grid gap-1 text-sm">
        <span className="font-semibold text-ink">Nome</span>
        <input name="nome" required minLength={3} maxLength={120} placeholder="Ex.: Declaração de Matrícula 2027" />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="font-semibold text-ink">Categoria</span>
        <select name="categoria" required defaultValue="declaracao">
          <option value="declaracao">Declaração</option>
          <option value="termo">Termo</option>
          <option value="contrato">Contrato</option>
          <option value="outro">Outro</option>
        </select>
      </label>

      <div className="flex justify-end gap-2">
        <a href="/rh/documentos" className="ds-button ds-button-secondary">Cancelar</a>
        <button type="submit" className="ds-button ds-button-primary">Próximo</button>
      </div>
    </form>
  );
}
