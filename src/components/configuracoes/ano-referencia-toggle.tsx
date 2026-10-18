"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { avancarAnoReferenciaAction } from "@/lib/actions/ano-referencia";

/**
 * Troca de ano de referência: o Confirmar só tem efeito depois que a
 * secretaria escolhe "Sim" — evita avançar o ano sem querer com um clique
 * cedo demais em um botão sempre ativo (é +1 sem desfazer, ver design doc).
 */
export function AnoReferenciaToggle() {
  const [mudar, setMudar] = useState(false);

  return (
    <form action={avancarAnoReferenciaAction} className="grid gap-4">
      <div>
        <p className="font-semibold text-ink">Mudar de ano de referência</p>
        <div className="mt-2 inline-flex overflow-hidden rounded-ui border border-line">
          <button
            type="button"
            onClick={() => setMudar(true)}
            aria-pressed={mudar}
            className={`px-4 py-2 text-sm font-semibold ${mudar ? "bg-brand text-white" : "bg-paper text-ink"}`}
          >
            Sim
          </button>
          <button
            type="button"
            onClick={() => setMudar(false)}
            aria-pressed={!mudar}
            className={`px-4 py-2 text-sm font-semibold ${!mudar ? "bg-brand text-white" : "bg-paper text-ink"}`}
          >
            Não
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <SubmitButton disabled={!mudar}>
          <Save size={14} /> Confirmar
        </SubmitButton>
      </div>
    </form>
  );
}
