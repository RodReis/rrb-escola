import { z } from "zod";

const numericPositive = z.preprocess(
  (v) => {
    if (v === "" || v == null) return undefined;
    if (typeof v === "string") return Number(v.replace(",", "."));
    return v;
  },
  z.number().positive()
);

const numericNonNeg = z.preprocess(
  (v) => {
    if (v === "" || v == null) return 0;
    if (typeof v === "string") return Number(v.replace(",", "."));
    return v;
  },
  z.number().min(0)
);

const optionalPositive = z.preprocess(
  (v) => {
    if (v === "" || v == null) return undefined;
    if (typeof v === "string") return Number(v.replace(",", "."));
    return v;
  },
  z.number().positive().optional()
);

export const rubricaSchema = z.object({
  escola_id: z.string().uuid("Escola obrigatória"),
  codigo: z.string().min(1, "Código obrigatório").max(20),
  nome: z.string().min(1, "Nome obrigatório").max(100),
  tipo: z.enum(["provento", "desconto", "base", "informativa"]),
  metodo_calculo: z.string().min(1, "Método obrigatório").max(50),
  incide_inss: z.preprocess((v) => v === "on" || v === true, z.boolean()).default(false),
  incide_irrf: z.preprocess((v) => v === "on" || v === true, z.boolean()).default(false),
  incide_fgts: z.preprocess((v) => v === "on" || v === true, z.boolean()).default(false),
  incide_dsr: z.preprocess((v) => v === "on" || v === true, z.boolean()).default(false),
  ordem_holerite: z.preprocess((v) => (v === "" || v == null ? 0 : Number(v)), z.number().int().min(0)).default(0),
  ativa: z.preprocess((v) => v === "on" || v === true, z.boolean()).default(true),
});

export type RubricaInput = z.infer<typeof rubricaSchema>;

const optionalInt = z.preprocess(
  (v) => (v === "" || v == null ? undefined : Number(v)),
  z.number().int().min(0).optional()
);

export const contratoSchema = z
  .object({
    company_id: z.string().uuid("Empresa obrigatória"),
    funcionario_id: z.string().uuid("Funcionário obrigatório"),
    perfil_calculo_id: z.string().uuid("Perfil de cálculo obrigatório"),
    salario_base: optionalPositive,
    valor_hora_aula: optionalPositive,
    aulas_semanais: z.preprocess(
      (v) => (v === "" || v == null ? undefined : Number(v)),
      z.number().int().positive().optional()
    ),
    dependentes_irrf: z.preprocess(
      (v) => (v === "" || v == null ? 0 : Number(v)),
      z.number().int().min(0)
    ).default(0),
    ativo: z.preprocess((v) => v === "on" || v === true, z.boolean()).default(true),
    cargo: z.string().max(100).optional().nullable(),
    cbo: z.string().max(20).optional().nullable(),
    aulas_manha: optionalInt,
    aulas_tarde: optionalInt,
    aulas_noite: optionalInt,
    antecipa_13_com_ferias: z.preprocess((v) => v === "on" || v === true, z.boolean()).default(false),
    janela_ferias: z.string().max(20).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const temSalario = data.salario_base != null && data.salario_base > 0;
    const temHoraAula = data.valor_hora_aula != null && data.valor_hora_aula > 0;
    const temAulas = data.aulas_semanais != null && data.aulas_semanais > 0;

    if (!temSalario && !temHoraAula) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe salário base ou valor/hora-aula",
        path: ["salario_base"],
      });
    }
    if (temSalario && temHoraAula) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe apenas salário base ou valor/hora-aula, não ambos",
        path: ["salario_base"],
      });
    }
    if (temHoraAula && !temAulas) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Aulas semanais obrigatórias quando valor/hora-aula é informado",
        path: ["aulas_semanais"],
      });
    }
    const { aulas_manha, aulas_tarde, aulas_noite, aulas_semanais } = data;
    const turnos = [aulas_manha, aulas_tarde, aulas_noite];
    const todosPreenchidos = turnos.every((v) => v != null);
    if (todosPreenchidos && temAulas) {
      const soma = (aulas_manha ?? 0) + (aulas_tarde ?? 0) + (aulas_noite ?? 0);
      if (soma !== aulas_semanais) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Soma das aulas por turno (${soma}) deve ser igual ao total de aulas semanais (${aulas_semanais})`,
          path: ["aulas_manha"],
        });
      }
    }
  });

export type ContratoInput = z.infer<typeof contratoSchema>;

export const configSchema = z.object({
  company_id: z.string().uuid("Empresa obrigatória"),
  divisor_dsr: z.preprocess(
    (v) => {
      if (v === "" || v == null) return 30;
      if (typeof v === "string") return Number(v.replace(",", "."));
      return v;
    },
    z.number().positive()
  ).default(30),
  percentual_hora_atividade: numericNonNeg.default(0),
  semanas_mes: z.preprocess(
    (v) => {
      if (v === "" || v == null) return 4;
      if (typeof v === "string") return Number(v.replace(",", "."));
      return v;
    },
    z.number().positive()
  ).default(4),
});

export type ConfigInput = z.infer<typeof configSchema>;

export const verbaContratualSchema = z
  .object({
    contrato_id: z.string().uuid("Contrato obrigatório"),
    rubrica_id: z.string().uuid("Rubrica obrigatória"),
    valor: optionalPositive,
    percentual: optionalPositive,
    ativa: z.preprocess((v) => v === "on" || v === true, z.boolean()).default(true),
  })
  .superRefine((data, ctx) => {
    const temValor = data.valor != null && data.valor > 0;
    const temPercentual = data.percentual != null && data.percentual > 0;

    if (!temValor && !temPercentual) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe valor ou percentual",
        path: ["valor"],
      });
    }
    if (temValor && temPercentual) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe apenas valor ou percentual, não ambos",
        path: ["valor"],
      });
    }
  });

export type VerbaContratualInput = z.infer<typeof verbaContratualSchema>;
