import { z } from "zod";

export const MOTIVOS_CANCELAMENTO = [
  "transferencia",
  "desistencia",
  "mudanca_cidade",
  "inadimplencia",
  "outro",
] as const;

export type MotivoCancelamento = (typeof MOTIVOS_CANCELAMENTO)[number];

export const MOTIVO_CANCELAMENTO_LABEL: Record<MotivoCancelamento, string> = {
  transferencia: "Transferência",
  desistencia: "Desistência",
  mudanca_cidade: "Mudança de cidade",
  inadimplencia: "Inadimplência",
  outro: "Outro",
};

export const CancelamentoMatriculaSchema = z
  .object({
    matriculaId: z.string().uuid(),
    data: z.string().min(1, "Informe a data do cancelamento."),
    motivo: z.enum(MOTIVOS_CANCELAMENTO),
    obs: z.string(),
    cienteCoordenacao: z.literal(true, {
      errorMap: () => ({ message: "Confirme ciência da coordenação." }),
    }),
    cienteDiretoria: z.literal(true, {
      errorMap: () => ({ message: "Confirme ciência da diretoria." }),
    }),
    isaacCanceladoConfirmado: z.boolean().nullable(),
    cobrancaIds: z.array(z.string().uuid()),
  })
  .superRefine((data, ctx) => {
    if (data.motivo === "outro" && data.obs.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Observação é obrigatória quando o motivo é \"Outro\".",
        path: ["obs"],
      });
    }
  });

export type CancelamentoMatriculaInput = z.infer<typeof CancelamentoMatriculaSchema>;
