"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { removeComprovanteAction, uploadComprovanteAction } from "@/lib/actions/despesas";

export function UploadComprovante({
  despesaId,
  currentPath
}: {
  despesaId: string;
  currentPath: string | null;
}) {
  const [pending, setPending] = useState(false);

  return (
    <div className="grid gap-3">
      {currentPath ? (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted">Anexo: {currentPath.split("/").pop()}</span>
          <form action={removeComprovanteAction}>
            <input type="hidden" name="id" value={despesaId} />
            <input type="hidden" name="path" value={currentPath} />
            <Button type="submit" variant="ghost">Remover</Button>
          </form>
        </div>
      ) : null}

      <form
        action={uploadComprovanteAction}
        encType="multipart/form-data"
        onSubmit={() => setPending(true)}
        className="flex items-center gap-2"
      >
        <input type="hidden" name="id" value={despesaId} />
        <input
          type="file"
          name="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          required
        />
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Enviando..." : "Anexar"}
        </Button>
      </form>
      <p className="text-xs text-muted">PNG, JPG, WEBP ou PDF — máx 5MB.</p>
    </div>
  );
}
