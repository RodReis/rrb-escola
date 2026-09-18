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
  const [cnpj, setCnpj] = useState(maskCNPJ(company?.cnpj ?? ""));

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

      {company ? (
        <>
          <div className="md:col-span-2 border-t border-line pt-4 text-sm font-medium text-muted">
            Dados para o histórico escolar
          </div>

          <label className="md:col-span-2">
            Endereço
            <input name="endereco" defaultValue={company.endereco ?? ""} placeholder="Rua, número, bairro" />
          </label>

          <label>
            Cidade
            <input name="cidade" defaultValue={company.cidade ?? ""} />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label>
              UF
              <input name="uf" maxLength={2} defaultValue={company.uf ?? ""} />
            </label>
            <label>
              CEP
              <input name="cep" defaultValue={company.cep ?? ""} placeholder="00000-000" />
            </label>
          </div>

          <label className="md:col-span-2">
            Resolução / credenciamento
            <input
              name="resolucao"
              defaultValue={company.resolucao ?? ""}
              placeholder="Ex.: RENOVAÇÃO DE RECONHECIMENTO, RESOLUÇÃO CEE/CEB Nº 000/0000"
            />
          </label>

          <label>
            Telefones
            <input name="telefones" defaultValue={company.telefones ?? ""} />
          </label>

          <label>
            E-mail
            <input name="email" type="email" defaultValue={company.email ?? ""} />
          </label>

          <label>
            Nome da secretária
            <input name="secretarioNome" defaultValue={company.secretario_nome ?? ""} />
          </label>

          <label>
            Cargo da secretária
            <input name="secretarioCargo" defaultValue={company.secretario_cargo ?? "Secretário(a)"} />
          </label>

          <label>
            Nome da diretora
            <input name="diretorNome" defaultValue={company.diretor_nome ?? ""} />
          </label>

          <label>
            Cargo da diretora
            <input name="diretorCargo" defaultValue={company.diretor_cargo ?? "Diretor(a)"} />
          </label>
        </>
      ) : null}

      <div className="md:col-span-2 flex justify-end gap-2">
        <Button type="submit" variant="primary">{submitLabel}</Button>
      </div>
    </form>
  );
}
