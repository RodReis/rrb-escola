import { z } from "zod";

// Movimento manual: entrada (reposição de compra) ou ajuste (contagem física ±).
// Saída manual não é exposta — saída só nasce de venda (confirmar_venda).
export const movimentoSchema = z
  .object({
    variacao_id: z.string().uuid("Variação inválida"),
    tipo: z.enum(["entrada", "ajuste"]),
    quantidade: z.number().int().positive("Quantidade deve ser positiva"),
    sentido: z.union([z.literal(-1), z.literal(1)]).default(1),
    custo_unit: z.number().nonnegative().optional().nullable(),
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
    observacao: z.string().max(300).optional().nullable()
  })
  .refine((m) => m.tipo !== "entrada" || m.sentido === 1, {
    message: "Entrada sempre tem sentido positivo",
    path: ["sentido"]
  });

export type MovimentoInput = z.infer<typeof movimentoSchema>;
