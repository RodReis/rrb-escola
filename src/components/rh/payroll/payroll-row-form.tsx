"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import { money } from "@/lib/constants";
import { calcAll, calcDSR, calcBaseFromSemDsr, calcProventosBase, type InssBracket, type IrBracket, type PayrollInput as CalcInput } from "@/lib/payroll/calculators";
import type { PayrollRowJoined } from "@/lib/data/payroll";
import { upsertPayrollAction } from "@/lib/actions/payroll";

type Props = {
  row: PayrollRowJoined;
  brackets: { inss: InssBracket[]; ir: IrBracket[] };
  disabled: boolean;
};

type FormState = {
  base_salary: number;
  horas_extras: number;
  gratificacao: number;
  comissao: number;
  adicional_noturno: number;
  periculosidade: number;
  insalubridade: number;
  outros_proventos: number;
  family_allowance: number;
  vale_transporte: number;
  vale_alimentacao: number;
  outros_descontos: number;
  loan_deduction: number;
  advance: number;
  gps: number;
  uniform_value: number;
  dependentes: number;
  salario_sem_dsr: number;
  aplica_dobra: boolean;
  inss_manual: boolean;
  ir_manual: boolean;
  inss: number;
  ir: number;
  consider_decimo_terceiro: boolean;
  considera_um_tercio_ferias: boolean;
  observations: string;
};

function num(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  return Number(String(v).replace(",", ".")) || 0;
}

export function PayrollRowForm({ row, brackets, disabled }: Props) {
  const initial: FormState = useMemo(
    () => ({
      base_salary: num(row.base_salary) > 0 ? num(row.base_salary) : num(row.employees?.base_salary ?? 0),
      horas_extras: num(row.horas_extras),
      gratificacao: num(row.gratificacao),
      comissao: num(row.comissao),
      adicional_noturno: num(row.adicional_noturno),
      periculosidade: num(row.periculosidade),
      insalubridade: num(row.insalubridade),
      outros_proventos: num(row.outros_proventos),
      family_allowance: num(row.family_allowance),
      vale_transporte: num(row.vale_transporte),
      vale_alimentacao: num(row.vale_alimentacao),
      outros_descontos: num(row.outros_descontos),
      loan_deduction: num(row.loan_deduction),
      advance: num(row.advance),
      gps: num(row.gps ?? row.employees?.gps_default ?? 0),
      uniform_value: num(row.uniform_value),
      dependentes: num(row.dependentes),
      salario_sem_dsr: row.salario_sem_dsr != null
        ? num(row.salario_sem_dsr)
        : num(row.employees?.salario_sem_dsr ?? 0),
      aplica_dobra:
        row.aplica_dobra ?? row.employees?.aplica_dobra ?? false,
      inss_manual: !!row.inss_manual,
      ir_manual: !!row.ir_manual,
      inss: num(row.inss),
      ir: num(row.ir),
      consider_decimo_terceiro: !!row.consider_decimo_terceiro,
      considera_um_tercio_ferias: !!row.considera_um_tercio_ferias,
      observations: row.observations ?? ""
    }),
    [row]
  );
  const [state, setState] = useState<FormState>(initial);

  const derivedBase =
    state.salario_sem_dsr > 0
      ? calcProventosBase(state.salario_sem_dsr, state.aplica_dobra)
      : state.base_salary;

  const calcInput: CalcInput = {
    base_salary: derivedBase,
    salario_sem_dsr: state.salario_sem_dsr,
    aplica_dobra: state.aplica_dobra,
    horas_extras: state.horas_extras,
    gratificacao: state.gratificacao,
    comissao: state.comissao,
    adicional_noturno: state.adicional_noturno,
    periculosidade: state.periculosidade,
    insalubridade: state.insalubridade,
    outros_proventos: state.outros_proventos,
    family_allowance: state.family_allowance,
    vale_transporte: state.vale_transporte,
    vale_alimentacao: state.vale_alimentacao,
    outros_descontos: state.outros_descontos,
    loan_deduction: state.loan_deduction,
    advance: state.advance,
    gps: state.gps,
    uniform_value: state.uniform_value,
    dependentes: state.dependentes
  };

  const computed = calcAll(calcInput, brackets, {
    manualInss: state.inss_manual ? state.inss : undefined,
    manualIr: state.ir_manual ? state.ir : undefined
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setState((s) => ({ ...s, [k]: v }));
  const setNum = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(k, num(e.target.value) as never);
  const setVal = (k: keyof FormState) => (v: number) => set(k, v as never);

  const resetCalc = () => {
    setState((s) => ({ ...s, inss_manual: false, ir_manual: false, inss: computed.inss, ir: computed.ir }));
  };

  return (
    <form action={upsertPayrollAction} className="grid gap-6">
      <input type="hidden" name="employee_id" value={row.employee_id} />
      <input type="hidden" name="reference_month" value={row.reference_month} />

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel className="grid gap-3 p-5">
          <h3 className="text-sm font-bold text-ink uppercase tracking-[0.1em]">Proventos</h3>
          <NumberField
            label="Salário s/ DSR"
            name="salario_sem_dsr"
            value={state.salario_sem_dsr}
            onValueChange={setVal("salario_sem_dsr")}
            disabled={disabled}
          />
          <div className="grid gap-1 text-xs text-ink/65">
            <div className="flex justify-between">
              <span>DSR (1/5)</span>
              <span className="tabular-nums">{money.format(calcDSR(state.salario_sem_dsr))}</span>
            </div>
            <div className="flex justify-between">
              <span>Salário base</span>
              <span className="tabular-nums">{money.format(calcBaseFromSemDsr(state.salario_sem_dsr))}</span>
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-sm mt-1">
            <input
              name="aplica_dobra"
              type="checkbox"
              checked={state.aplica_dobra}
              onChange={(e) => set("aplica_dobra", e.target.checked)}
              disabled={disabled}
              className="h-4 w-4 accent-brand"
            />
            Aplica dobra mensal
          </label>
          <div className="flex justify-between text-sm font-bold border-t border-line pt-2 mt-1">
            <span className="text-ink/70">Total base</span>
            <span className="text-success tabular-nums">{money.format(derivedBase)}</span>
          </div>
          <input type="hidden" name="base_salary" value={derivedBase} />
          <NumberField label="Horas extras" name="horas_extras" value={state.horas_extras} onValueChange={setVal("horas_extras")} disabled={disabled} />
          <NumberField label="Gratificação" name="gratificacao" value={state.gratificacao} onValueChange={setVal("gratificacao")} disabled={disabled} />
          <NumberField label="Comissão" name="comissao" value={state.comissao} onValueChange={setVal("comissao")} disabled={disabled} />
          <NumberField label="Adicional noturno" name="adicional_noturno" value={state.adicional_noturno} onValueChange={setVal("adicional_noturno")} disabled={disabled} />
          <NumberField label="Periculosidade" name="periculosidade" value={state.periculosidade} onValueChange={setVal("periculosidade")} disabled={disabled} />
          <NumberField label="Insalubridade" name="insalubridade" value={state.insalubridade} onValueChange={setVal("insalubridade")} disabled={disabled} />
          <NumberField label="Outros proventos" name="outros_proventos" value={state.outros_proventos} onValueChange={setVal("outros_proventos")} disabled={disabled} />
          <NumberField label="Salário-família" name="family_allowance" value={state.family_allowance} onValueChange={setVal("family_allowance")} disabled={disabled} />
          <div className="mt-2 border-t border-line pt-2 flex justify-between text-sm font-bold">
            <span className="text-ink/70">Subtotal proventos</span>
            <span className="text-success tabular-nums">{money.format(computed.total_earnings)}</span>
          </div>
        </Panel>

        <Panel className="grid gap-3 p-5">
          <h3 className="text-sm font-bold text-ink uppercase tracking-[0.1em]">Descontos</h3>

          <label className="flex items-center justify-between text-xs">
            <span className="font-semibold text-ink/70">INSS</span>
            <label className="inline-flex items-center gap-1 text-[0.65rem] text-ink/60">
              <input
                type="checkbox"
                name="inss_manual"
                checked={state.inss_manual}
                onChange={(e) => set("inss_manual", e.target.checked)}
                disabled={disabled}
                className="h-3 w-3 accent-brand"
              />
              Editar manual
            </label>
          </label>
          {state.inss_manual ? (
            <CurrencyInput
              name="inss"
              value={state.inss}
              onChange={setVal("inss")}
              disabled={disabled}
            />
          ) : (
            <>
              <input type="hidden" name="inss" value={computed.inss} />
              <div className="rounded-ui border border-line bg-paper px-3 py-2 text-sm text-danger font-semibold tabular-nums">
                {money.format(computed.inss)} <span className="text-xs text-ink/45 font-normal">(auto)</span>
              </div>
            </>
          )}

          <label className="flex items-center justify-between text-xs mt-2">
            <span className="font-semibold text-ink/70">IRRF</span>
            <label className="inline-flex items-center gap-1 text-[0.65rem] text-ink/60">
              <input
                type="checkbox"
                name="ir_manual"
                checked={state.ir_manual}
                onChange={(e) => set("ir_manual", e.target.checked)}
                disabled={disabled}
                className="h-3 w-3 accent-brand"
              />
              Editar manual
            </label>
          </label>
          {state.ir_manual ? (
            <CurrencyInput
              name="ir"
              value={state.ir}
              onChange={setVal("ir")}
              disabled={disabled}
            />
          ) : (
            <>
              <input type="hidden" name="ir" value={computed.ir} />
              <div className="rounded-ui border border-line bg-paper px-3 py-2 text-sm text-danger font-semibold tabular-nums">
                {money.format(computed.ir)} <span className="text-xs text-ink/45 font-normal">(auto)</span>
              </div>
            </>
          )}

          <NumberField label="Dependentes (IR)" name="dependentes" value={state.dependentes} onChange={setNum("dependentes")} step={1} integer disabled={disabled} />
          <NumberField label="Empréstimo" name="loan_deduction" value={state.loan_deduction} onValueChange={setVal("loan_deduction")} disabled={disabled} />
          <NumberField label="Adiantamento" name="advance" value={state.advance} onValueChange={setVal("advance")} disabled={disabled} />
          <NumberField label="GPS" name="gps" value={state.gps} onValueChange={setVal("gps")} disabled={disabled} />
          <NumberField label="Vale transporte" name="vale_transporte" value={state.vale_transporte} onValueChange={setVal("vale_transporte")} disabled={disabled} />
          <NumberField label="Vale alimentação" name="vale_alimentacao" value={state.vale_alimentacao} onValueChange={setVal("vale_alimentacao")} disabled={disabled} />
          <NumberField label="Outros descontos" name="outros_descontos" value={state.outros_descontos} onValueChange={setVal("outros_descontos")} disabled={disabled} />
          <NumberField label="Uniforme" name="uniform_value" value={state.uniform_value} onValueChange={setVal("uniform_value")} disabled={disabled} />

          <div className="mt-2 border-t border-line pt-2 flex justify-between text-sm font-bold">
            <span className="text-ink/70">Subtotal descontos</span>
            <span className="text-warning tabular-nums">{money.format(computed.total_deductions)}</span>
          </div>
        </Panel>

        <Panel className="grid gap-3 p-5">
          <h3 className="text-sm font-bold text-ink uppercase tracking-[0.1em]">Outros / Resumo</h3>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="consider_decimo_terceiro"
              checked={state.consider_decimo_terceiro}
              onChange={(e) => set("consider_decimo_terceiro", e.target.checked)}
              disabled={disabled}
              className="h-4 w-4 accent-brand"
            />
            Considera 13º
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="considera_um_tercio_ferias"
              checked={state.considera_um_tercio_ferias}
              onChange={(e) => set("considera_um_tercio_ferias", e.target.checked)}
              disabled={disabled}
              className="h-4 w-4 accent-brand"
            />
            Considera 1/3 férias
          </label>
          <label className="block text-sm">
            <span className="text-xs font-semibold text-ink/70">Observações</span>
            <textarea
              name="observations"
              value={state.observations}
              onChange={(e) => set("observations", e.target.value)}
              disabled={disabled}
              rows={3}
              className="mt-1 w-full rounded-ui border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
          <div className="mt-2 border-t border-line pt-3 grid gap-2">
            <div className="flex justify-between text-xs">
              <span className="text-ink/60">Total proventos</span>
              <span className="text-success tabular-nums">{money.format(computed.total_earnings)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-ink/60">Total descontos</span>
              <span className="text-warning tabular-nums">{money.format(computed.total_deductions)}</span>
            </div>
            <div className="flex justify-between items-end pt-2 border-t border-line">
              <span className="text-xs font-bold uppercase tracking-[0.1em] text-ink/60">Líquido</span>
              <span className="font-display text-3xl text-brand tabular-nums">{money.format(computed.net_amount)}</span>
            </div>
          </div>
          <button
            type="button"
            className="mt-2 text-xs font-semibold text-brand hover:underline disabled:opacity-50"
            onClick={resetCalc}
            disabled={disabled}
          >
            Resetar INSS/IR automático
          </button>
        </Panel>
      </div>

      {!disabled ? (
        <div className="flex justify-end">
          <Button type="submit" variant="primary">Salvar</Button>
        </div>
      ) : null}
    </form>
  );
}

function NumberField({
  label,
  name,
  value,
  onChange,
  onValueChange,
  step = 0.01,
  integer = false,
  required = false,
  disabled = false
}: {
  label: string;
  name: string;
  value: number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onValueChange?: (v: number) => void;
  step?: number;
  integer?: boolean;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="text-xs font-semibold text-ink/70">{label}</span>
      {integer ? (
        <input
          name={name}
          type="number"
          step={1}
          min="0"
          value={value}
          onChange={onChange}
          required={required}
          disabled={disabled}
          className="mt-1 w-full rounded-ui border border-line bg-surface px-3 py-2 text-sm tabular-nums"
        />
      ) : (
        <CurrencyInput
          name={name}
          value={value}
          onChange={onValueChange ?? (() => {})}
          disabled={disabled}
          required={required}
        />
      )}
    </label>
  );
}
