"use client";

import { UploadCloud } from "lucide-react";
import { uploadStudentImportAction } from "@/lib/actions/imports";
import { useAction } from "@/lib/hooks/use-action";
import { Button } from "@/components/ui/button";

export function NovoArquivoForm() {
  const { run, pending } = useAction(uploadStudentImportAction, {
    success: "Arquivo processado.",
    error: "Falha ao processar o arquivo.",
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    run(new FormData(e.currentTarget));
    e.currentTarget.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-[1fr_1fr_190px]">
      <label>
        Arquivo PDF ou planilha
        <input name="arquivo" type="file" accept="application/pdf,.pdf,.xlsx,.xls,.csv,text/csv" required />
      </label>
      <label>
        Observação
        <input name="observacao" placeholder="Ex.: fichas ou planilha 2026" />
      </label>
      <Button type="submit" variant="accent" loading={pending} className="self-end">
        <UploadCloud size={17} />
        Processar arquivo
      </Button>
    </form>
  );
}
