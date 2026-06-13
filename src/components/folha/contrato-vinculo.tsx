"use client";

import { useMemo, useState } from "react";

type Funcionario = { id: string; name: string; company_id: string | null };
type Empresa = { id: string; name: string };
type Perfil = { id: string; nome: string };

type Props = {
  funcionarios: Funcionario[];
  empresas: Empresa[];
  perfis: Perfil[];
};

export function ContratoVinculo({ funcionarios, empresas, perfis }: Props) {
  const [companyId, setCompanyId] = useState("");

  const funcionariosDaEmpresa = useMemo(
    () => (companyId ? funcionarios.filter((f) => f.company_id === companyId) : []),
    [companyId, funcionarios],
  );

  return (
    <section className="grid gap-4">
      <h2 className="text-xs font-bold uppercase tracking-kicker text-ink/55">Vínculo</h2>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
          Empresa
          <select
            name="company_id"
            required
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
          >
            <option value="">Selecione…</option>
            {empresas.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
          Funcionário
          <select name="funcionario_id" required disabled={!companyId}>
            <option value="">
              {companyId ? "Selecione…" : "Escolha a empresa primeiro"}
            </option>
            {funcionariosDaEmpresa.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          {companyId && funcionariosDaEmpresa.length === 0 ? (
            <span className="text-xs text-ink/45">
              Nenhum funcionário sem contrato nesta empresa.
            </span>
          ) : null}
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
          Perfil de cálculo
          <select name="perfil_calculo_id" required>
            <option value="">Selecione…</option>
            {perfis.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
