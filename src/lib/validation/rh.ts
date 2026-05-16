import { z } from "zod";
import { CPF_REGEX, CNPJ_REGEX } from "@/lib/format/masks";

export const CompanySchema = z.object({
  name: z.string().min(3, "Nome deve ter ao menos 3 caracteres"),
  cnpj: z.string().regex(CNPJ_REGEX, "CNPJ inválido (formato 00.000.000/0000-00)")
});

export const CompanyUpdateSchema = CompanySchema.extend({
  id: z.string().uuid(),
  ativo: z.preprocess((v) => v === "on" || v === true, z.boolean())
});

export const SchoolCategoryEnum = z.enum(["admin", "fund1", "fund2", "medio"]);
export const StatusContratoEnum = z.enum(["CLT", "PJ", "Estagio", "Temporario"]);

const optionalString = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().optional()
);

export const EmployeeSchema = z.object({
  company_id: z.string().uuid("Empresa obrigatória"),
  name: z.string().min(3, "Nome deve ter ao menos 3 caracteres"),
  cpf: z.string().regex(CPF_REGEX, "CPF inválido (formato 000.000.000-00)"),
  email: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().email("E-mail inválido").optional()
  ),
  telefone: optionalString,
  cargo: optionalString,
  school_category: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    SchoolCategoryEnum.optional()
  ),
  status_contrato: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    StatusContratoEnum.optional()
  ),
  birth_date: optionalString,
  hire_date: optionalString,
  salario_sem_dsr: z.preprocess(
    (v) => {
      if (v === "" || v == null) return 0;
      if (typeof v === "string") return Number(v.replace(",", "."));
      return v;
    },
    z.number().min(0)
  ).optional(),
  aplica_dobra: z.preprocess((v) => v === "on" || v === true, z.boolean()).optional(),
  gps_default: z.preprocess(
    (v) => {
      if (v === "" || v == null) return 0;
      if (typeof v === "string") return Number(v.replace(",", "."));
      return v;
    },
    z.number().min(0)
  ).optional()
});

export const EmployeeUpdateSchema = EmployeeSchema.extend({
  id: z.string().uuid(),
  ativo: z.preprocess((v) => v === "on" || v === true, z.boolean())
});

export type CompanyInput = z.infer<typeof CompanySchema>;
export type EmployeeInput = z.infer<typeof EmployeeSchema>;
