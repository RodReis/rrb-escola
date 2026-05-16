"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { maskCNPJ } from "@/lib/format/masks";
import type { Company } from "@/lib/data/rh";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  company?: Company;
  submitLabel?: string;
};

export function CompanyForm({ action, company, submitLabel = "Salvar" }: Props) {
  const [cnpj, setCnpj] = useState(company?.cnpj ?? "");

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      {company ? <input type="hidden" name="id" value={company.id} /> : null}

      <label className="md:col-span-2">
        Nome da empresa
        <input
          name="name"
          defaultValue={company?.name ?? ""}
          required
          minLength={3}
          placeholder="Ex.: Escola RRB Educação Ltda."
        />
      </label>

      <label>
        CNPJ
        <input
          name="cnpj"
          value={cnpj}
          onChange={(e) => setCnpj(maskCNPJ(e.target.value))}
          required
          placeholder="00.000.000/0000-00"
        />
      </label>

      {company ? (
        <label className="flex grid-cols-none items-center gap-2 self-end pb-3">
          <input name="ativo" type="checkbox" defaultChecked={company.ativo} className="h-4 w-4" />
          Ativa
        </label>
      ) : null}

      <div className="md:col-span-2 flex justify-end gap-2">
        <Button type="submit" variant="primary">{submitLabel}</Button>
      </div>
    </form>
  );
}
