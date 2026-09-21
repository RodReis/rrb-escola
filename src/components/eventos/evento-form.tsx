"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { salvarEventoAction, type SalvarEventoResult } from "@/lib/actions/eventos";
import { Panel } from "@/components/ui/card";
import type { EventoEscola } from "@/lib/data/eventos";

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="ds-button ds-button-primary">
      {pending ? "Salvando…" : editing ? "Salvar alterações" : "Cadastrar evento"}
    </button>
  );
}

export function EventoForm({ evento }: { evento?: EventoEscola | null }) {
  const editing = !!evento;
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [state, formAction] = useFormState<SalvarEventoResult | null, FormData>(
    salvarEventoAction,
    null,
  );

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.created ? "Evento cadastrado." : "Evento atualizado.");
      if (state.created) {
        formRef.current?.reset();
      } else {
        router.push("/eventos");
      }
    } else {
      toast.error(state.error);
    }
  }, [state, router]);

  return (
    <Panel className="flex flex-col gap-4 self-start">
      <h2 className="font-bold text-ink">
        {editing ? "Editar evento" : "Novo evento"}
      </h2>
      <form ref={formRef} action={formAction} className="flex flex-col gap-4">
        {evento?.id && <input type="hidden" name="id" value={evento.id} />}

        <label className="grid gap-1 text-sm">
          Título
          <input
            type="text"
            name="titulo"
            required
            maxLength={160}
            defaultValue={evento?.titulo ?? ""}
            placeholder="Ex: Reunião de pais"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Data início
            <input
              type="date"
              name="data_inicio"
              required
              defaultValue={evento?.dataInicio ?? ""}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Data fim
            <input
              type="date"
              name="data_fim"
              required
              defaultValue={evento?.dataFim ?? ""}
            />
          </label>
        </div>

        <label className="grid gap-1 text-sm">
          Local <span className="text-xs text-ink/60">(opcional)</span>
          <input
            type="text"
            name="local"
            maxLength={160}
            defaultValue={evento?.local ?? ""}
            placeholder="Ex: Pátio coberto"
          />
        </label>

        <label className="grid gap-1 text-sm">
          Descrição <span className="text-xs text-ink/60">(opcional)</span>
          <textarea
            name="descricao"
            rows={3}
            maxLength={1000}
            defaultValue={evento?.descricao ?? ""}
            placeholder="Detalhes do evento"
          />
        </label>

        <div className="flex justify-end gap-2">
          <SubmitButton editing={editing} />
        </div>
      </form>
    </Panel>
  );
}
