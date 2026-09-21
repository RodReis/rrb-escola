"use client";

import { createGateDeviceAction } from "@/lib/actions/gate";
import { useAction } from "@/lib/hooks/use-action";
import { Button } from "@/components/ui/button";

export function NovoDispositivoForm() {
  const { run, pending } = useAction(createGateDeviceAction, {
    success: "Dispositivo adicionado.",
    error: "Falha ao adicionar o dispositivo.",
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    run(new FormData(e.currentTarget));
    e.currentTarget.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-[1fr_1fr_180px_140px]">
      <label>Nome<input name="nome" placeholder="Camera entrada principal" required /></label>
      <label>Local<input name="local" placeholder="Entrada principal" /></label>
      <label>
        Tipo
        <select name="tipo" defaultValue="portaria">
          <option value="portaria">Portaria</option>
          <option value="camera">Câmera</option>
          <option value="totem">Totem</option>
        </select>
      </label>
      <Button type="submit" variant="accent" loading={pending} className="self-end">Adicionar</Button>
    </form>
  );
}
