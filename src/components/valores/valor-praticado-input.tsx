"use client";

import { useState, useTransition } from "react";
import { upsertValorPraticadoAction } from "@/lib/actions/valores-praticados";
import type { SegmentoSerie } from "@/lib/data/valores-praticados";

type Props = {
  anoLetivo: number;
  segmento: SegmentoSerie;
  ordemFilho: 1 | 2 | 3;
  campo: "valor_matricula" | "valor_mensalidade";
  initialValue: number;
  outroCampo: { campo: "valor_matricula" | "valor_mensalidade"; valor: number };
};

export function ValorPraticadoInput({
  anoLetivo,
  segmento,
  ordemFilho,
  campo,
  initialValue,
  outroCampo,
}: Props) {
  const [value, setValue] = useState(initialValue.toFixed(2));
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [, startTransition] = useTransition();

  function handleBlur() {
    const n = Number(value.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) {
      setSaved("error");
      return;
    }
    if (n === initialValue) {
      setSaved("idle");
      return;
    }
    setSaved("saving");
    const fd = new FormData();
    fd.set("ano_letivo", String(anoLetivo));
    fd.set("segmento", segmento);
    fd.set("ordem_filho", String(ordemFilho));
    fd.set(campo, String(n));
    fd.set(outroCampo.campo, String(outroCampo.valor));
    startTransition(async () => {
      try {
        await upsertValorPraticadoAction(fd);
        setSaved("saved");
        setTimeout(() => setSaved("idle"), 1500);
      } catch {
        setSaved("error");
      }
    });
  }

  const border =
    saved === "saving" ? "border-warning" :
    saved === "saved"  ? "border-success" :
    saved === "error"  ? "border-danger"  :
    "border-line";

  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      className={`w-full rounded-ui border ${border} bg-surface px-2 py-1 text-right text-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-brand/20`}
    />
  );
}
