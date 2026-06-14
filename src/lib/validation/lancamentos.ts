import { z } from "zod";

export const TIPOS_LANCAMENTO = ["receita", "despesa"] as const;
export const CLASSES_DESPESA = ["fixa", "variavel"] as const;
export const FORMAS_PAGAMENTO = ["pix", "dinheiro", "cartao", "boleto", "transferencia"] as const;

export type TipoLancamento = (typeof TIPOS_LANCAMENTO)[number];
export type ClasseDespesa = (typeof CLASSES_DESPESA)[number];

// Livro-razão unificado: receita e despesa no mesmo CRUD.
// classe_despesa só se aplica a tipo='despesa' (refine abaixo).
export const lancamentoSchema = z
  .object({
    tipo: z.enum(TIPOS_LANCAMENTO),
    classe_despesa: z.enum(CLASSES_DESPESA).optional().nullable(),
    descricao: z.string().min(1, "Descrição obrigatória").max(200),
    categoria_id: z.string().uuid("Categoria inválida"),
    contraparte: z.string().max(200).optional().nullable(),
    valor: z.number().positive("Valor deve ser maior que zero"),
    data_vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
    data_pagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    forma_pagamento: z.enum(FORMAS_PAGAMENTO).optional().nullable()
  })
  .refine((d) => d.tipo === "despesa" || !d.classe_despesa, {
    message: "Classe (fixa/variável) só se aplica a despesa",
    path: ["classe_despesa"]
  });

export type LancamentoInput = z.infer<typeof lancamentoSchema>;

// Comprovante: mesmas regras das despesas (reusa bucket despesas-comprovantes).
export const MAX_COMPROVANTE_BYTES = 5 * 1024 * 1024;
export const COMPROVANTE_MIMES = ["image/png", "image/jpeg", "image/webp", "application/pdf"] as const;

export const comprovanteSchema = z.object({
  size: z.number().max(MAX_COMPROVANTE_BYTES, "Arquivo maior que 5MB"),
  type: z.enum(COMPROVANTE_MIMES, {
    errorMap: () => ({ message: "Tipo de arquivo não suportado" })
  })
});

export const categoriaFinanceiraSchema = z.object({
  nome: z.string().min(1).max(80),
  tipo: z.enum(TIPOS_LANCAMENTO),
  ativo: z.boolean().default(true)
});
