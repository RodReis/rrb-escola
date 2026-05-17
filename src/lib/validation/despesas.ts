import { z } from "zod";

export const FORMAS_PAGAMENTO = ["pix", "dinheiro", "cartao", "boleto", "transferencia"] as const;

export const despesaSchema = z.object({
  descricao: z.string().min(1, "Descrição obrigatória").max(200),
  categoria_id: z.string().uuid("Categoria inválida"),
  fornecedor: z.string().max(200).optional().nullable(),
  valor: z.number().positive("Valor deve ser maior que zero"),
  data_vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  data_pagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  forma_pagamento: z.enum(FORMAS_PAGAMENTO).optional().nullable()
});

export type DespesaInput = z.infer<typeof despesaSchema>;

export const MAX_COMPROVANTE_BYTES = 5 * 1024 * 1024;
export const COMPROVANTE_MIMES = ["image/png", "image/jpeg", "image/webp", "application/pdf"] as const;

export const comprovanteSchema = z.object({
  size: z.number().max(MAX_COMPROVANTE_BYTES, "Arquivo maior que 5MB"),
  type: z.enum(COMPROVANTE_MIMES, {
    errorMap: () => ({ message: "Tipo de arquivo não suportado" })
  })
});

export const categoriaSchema = z.object({
  nome: z.string().min(1).max(80),
  ativo: z.boolean().default(true)
});
