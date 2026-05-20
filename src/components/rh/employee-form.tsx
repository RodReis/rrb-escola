"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { maskCPF, maskPhone } from "@/lib/format/masks";
import type { Employee } from "@/lib/data/rh";
import type { Company } from "@/lib/data/rh";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  employee?: Employee;
  companies: Company[];
  defaultCompanyId?: string;
  submitLabel?: string;
};

export function EmployeeForm({ action, employee, companies, defaultCompanyId, submitLabel = "Salvar" }: Props) {
  const [cpf, setCpf] = useState(employee?.cpf ?? "");
  const [telefone, setTelefone] = useState(employee?.telefone ?? "");
  const [baseSalary, setBaseSalary] = useState<number>(Number(employee?.base_salary ?? 0));
  const [salarioSemDsr, setSalarioSemDsr] = useState<number>(Number(employee?.salario_sem_dsr ?? 0));
  const [gpsDefault, setGpsDefault] = useState<number>(Number(employee?.gps_default ?? 0));

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      {employee ? <input type="hidden" name="id" value={employee.id} /> : null}

      <label>
        Empresa
        <select name="company_id" defaultValue={employee?.company_id ?? defaultCompanyId ?? ""} required>
          <option value="">Selecione...</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>

      <label>
        Nome completo
        <input name="name" defaultValue={employee?.name ?? ""} required minLength={3} />
      </label>

      <label>
        CPF
        <input
          name="cpf"
          value={cpf}
          onChange={(e) => setCpf(maskCPF(e.target.value))}
          required
          placeholder="000.000.000-00"
        />
      </label>

      <label>
        E-mail
        <input name="email" type="email" defaultValue={employee?.email ?? ""} />
      </label>

      <label>
        Telefone
        <input
          name="telefone"
          value={telefone}
          onChange={(e) => setTelefone(maskPhone(e.target.value))}
          placeholder="(00) 00000-0000"
        />
      </label>

      <label>
        Cargo
        <input name="cargo" defaultValue={employee?.cargo ?? ""} />
      </label>

      <label>
        Categoria escolar
        <select name="school_category" defaultValue={employee?.school_category ?? ""}>
          <option value="">—</option>
          <option value="admin">Admin</option>
          <option value="fund1">Fundamental I</option>
          <option value="fund2">Fundamental II</option>
          <option value="medio">Médio</option>
        </select>
      </label>

      <label>
        Status do contrato
        <select name="status_contrato" defaultValue={employee?.status_contrato ?? ""}>
          <option value="">—</option>
          <option value="CLT">CLT</option>
          <option value="PJ">PJ</option>
          <option value="Estagio">Estágio</option>
          <option value="Temporario">Temporário</option>
        </select>
      </label>

      <label>
        Salário Base
        <CurrencyInput name="base_salary" value={baseSalary} onChange={setBaseSalary} />
      </label>

      <label>
        Salário s/ DSR
        <CurrencyInput name="salario_sem_dsr" value={salarioSemDsr} onChange={setSalarioSemDsr} />
      </label>

      <label className="flex grid-cols-none items-center gap-2 self-end pb-3">
        <input
          name="aplica_dobra"
          type="checkbox"
          defaultChecked={employee?.aplica_dobra ?? false}
          className="h-4 w-4"
        />
        Aplica dobra mensal
      </label>

      <label>
        GPS padrão
        <CurrencyInput name="gps_default" value={gpsDefault} onChange={setGpsDefault} />
      </label>

      <label>
        Data de nascimento
        <input name="birth_date" type="date" defaultValue={employee?.birth_date ?? ""} />
      </label>

      <label>
        Data de admissão
        <input name="hire_date" type="date" defaultValue={employee?.hire_date ?? ""} />
      </label>

      {employee ? (
        <label className="flex grid-cols-none items-center gap-2 self-end pb-3">
          <input name="ativo" type="checkbox" defaultChecked={employee.ativo} className="h-4 w-4" />
          Ativo
        </label>
      ) : null}

      <div className="md:col-span-2 flex justify-end gap-2">
        <Button type="submit" variant="primary">{submitLabel}</Button>
      </div>
    </form>
  );
}
