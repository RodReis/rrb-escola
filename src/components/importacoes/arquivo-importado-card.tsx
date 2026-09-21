"use client";

import { ExternalLink } from "lucide-react";
import { markImportProcessedAction } from "@/lib/actions/imports";
import { useAction } from "@/lib/hooks/use-action";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import type { ImportedFile } from "@/lib/data/imports";

function tone(status: string) {
  if (status === "processado") return "green";
  if (status === "erro") return "red";
  return "gold";
}

function dateText(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

export function ArquivoImportadoCard({ file }: { file: ImportedFile }) {
  const { run, pending } = useAction(markImportProcessedAction, {
    success: "Status atualizado.",
    error: "Falha ao atualizar o status.",
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    run(new FormData(e.currentTarget));
  }

  return (
    <Panel className="grid gap-4 lg:grid-cols-[1fr_220px_270px] lg:items-center">
      <div>
        <h2 className="font-black text-ink">{file.nome_arquivo}</h2>
        <p className="mt-1 text-sm text-ink/65">{file.observacao || file.storage_path}</p>
        <p className="mt-1 text-xs font-medium text-ink/60">{dateText(file.created_at)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <ButtonLink href={`/importacoes/${file.id}`} variant="primary">Revisar lote</ButtonLink>
          {file.signed_url ? (
            <a href={file.signed_url} target="_blank" className="ds-button ds-button-secondary">
              <ExternalLink size={14} /> Abrir arquivo
            </a>
          ) : null}
        </div>
      </div>
      <div className="grid gap-2 self-center text-sm">
        <Badge tone={tone(file.status)}>{file.status}</Badge>
        <span className="text-muted">
          {file.total_linhas} linhas / {file.prontas} prontas / {file.importadas} importadas
        </span>
        {file.pendentes || file.duplicadas || file.erros ? (
          <span className="text-xs font-bold text-clay">
            {file.pendentes} pendentes / {file.duplicadas} duplicadas / {file.erros} erros
          </span>
        ) : null}
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-[1fr_90px] gap-2 self-center">
        <input type="hidden" name="id" value={file.id} />
        <select name="status" defaultValue={file.status}>
          <option value="pendente">Pendente</option>
          <option value="processado">Processado</option>
          <option value="erro">Erro</option>
        </select>
        <Button type="submit" loading={pending} className="min-h-0 px-3 py-2 text-xs">Salvar</Button>
      </form>
    </Panel>
  );
}
