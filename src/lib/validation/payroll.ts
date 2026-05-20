import { z } from "zod";

const numericNonNeg = z.preprocess(
  (v) => {
    if (v === "" || v == null) return 0;
    if (typeof v === "string") return Number(v.replace(",", "."));
    return v;
  },
  z.number().min(0)
);

const boolFromForm = z.preprocess((v) => v === "on" || v === true, z.boolean());

export const PayrollSchema = z.object({
  employee_id: z.string().uuid(),
  reference_month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Mês inválido"),
  base_salary: numericNonNeg,
  horas_extras: numericNonNeg,
  gratificacao: numericNonNeg,
  comissao: numericNonNeg,
  adicional_noturno: numericNonNeg,
  periculosidade: numericNonNeg,
  insalubridade: numericNonNeg,
  outros_proventos: numericNonNeg,
  family_allowance: numericNonNeg,
  vale_transporte: numericNonNeg,
  vale_alimentacao: numericNonNeg,
  outros_descontos: numericNonNeg,
  loan_deduction: numericNonNeg,
  advance: numericNonNeg,
  uniform_value: numericNonNeg,
  gps: numericNonNeg,
  dependentes: z.preprocess(
    (v) => (v === "" || v == null ? 0 : Number(v)),
    z.number().int().min(0)
  ),
  consider_decimo_terceiro: boolFromForm.optional(),
  considera_um_tercio_ferias: boolFromForm.optional(),
  inss_manual: boolFromForm.optional(),
  ir_manual: boolFromForm.optional(),
  inss: numericNonNeg.optional(),
  ir: numericNonNeg.optional(),
  observations: z.preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
  salario_sem_dsr: numericNonNeg.optional(),
  aplica_dobra: boolFromForm.optional()
});

export const BracketSchema = z.object({
  table: z.enum(["inss", "ir"]),
  vigencia_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ordem: z.preprocess((v) => Number(v), z.number().int().min(1)),
  valor_de: numericNonNeg,
  valor_ate: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(String(v).replace(",", "."))),
    z.number().min(0).nullable()
  ),
  aliquota: numericNonNeg,
  parcela_deduzir: numericNonNeg,
  deducao_dependente: numericNonNeg.optional()
});

export const NewVigenciaSchema = z.object({
  table: z.enum(["inss", "ir"]),
  vigencia_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  copy_from: z.preprocess((v) => (v === "" ? undefined : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional())
});

export type PayrollInput = z.infer<typeof PayrollSchema>;
