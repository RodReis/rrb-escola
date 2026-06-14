import { z } from "zod";

export const contratoSchema = z.object({
  descricao: z.string().min(1, "Descrição obrigatória").max(200),
  contraparte: z.string().max(200).optional().nullable(),
  valor: z.number().positive("Valor deve ser maior que zero"),
  dia_vencimento: z.number().int().min(1).max(28),
  categoria_id: z.string().uuid().optional().nullable(),
  ativo: z.boolean().default(true),
  inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable()
});

export type ContratoInput = z.infer<typeof contratoSchema>;
