"use client";

import { AnamneseFields, anamneseToForm } from "@/components/pipeline/anamnese-fields";
import type { Anamnese } from "@/lib/actions/pipeline-anamnese";

// Wrapper client read-only: AnamneseFields exige onChange (ignorado em readOnly).
export function AnamneseReadOnly({ anamnese }: { anamnese: Anamnese }) {
  const form = anamneseToForm(anamnese);
  return <AnamneseFields form={form} onChange={() => {}} readOnly />;
}
