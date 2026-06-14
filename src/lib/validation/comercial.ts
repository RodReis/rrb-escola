import { z } from "zod";

export const TIPOS_PRODUTO = ["uniforme", "apostila", "outro"] as const;
export const FORMAS_PAGAMENTO = ["pix", "dinheiro", "cartao", "boleto", "transferencia"] as const;

export type TipoProduto = (typeof TIPOS_PRODUTO)[number];

// --- Produto ---
export const produtoSchema = z.object({
  nome: z.string().min(1, "Nome obrigatório").max(120),
  tipo: z.enum(TIPOS_PRODUTO),
  controla_estoque: z.boolean().default(false),
  ativo: z.boolean().default(true)
});
export type ProdutoInput = z.infer<typeof produtoSchema>;

// --- Variação (SKU) ---
export const variacaoSchema = z.object({
  sku: z.string().max(60).optional().nullable(),
  atributos: z.record(z.string(), z.string()).default({}),
  preco_venda: z.number().nonnegative("Preço inválido"),
  custo: z.number().nonnegative().default(0),
  estoque_minimo: z.number().int().nonnegative().default(0),
  ativo: z.boolean().default(true)
});
export type VariacaoInput = z.infer<typeof variacaoSchema>;

// --- Venda (cabeçalho) ---
// numero_cupom obrigatório quando cartão (refine).
export const vendaSchema = z
  .object({
    aluno_id: z.string().uuid().optional().nullable(),
    cliente_nome: z.string().max(200).optional().nullable(),
    data_venda: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
    desconto: z.number().nonnegative().default(0),
    forma_pagamento: z.enum(FORMAS_PAGAMENTO).optional().nullable(),
    numero_cupom: z.string().max(60).optional().nullable(),
    evento_id: z.string().uuid().optional().nullable(),
    observacao: z.string().max(500).optional().nullable()
  })
  .refine((v) => v.forma_pagamento !== "cartao" || !!v.numero_cupom?.trim(), {
    message: "Número do cupom é obrigatório para cartão",
    path: ["numero_cupom"]
  })
  .refine((v) => !!v.aluno_id || !!v.cliente_nome?.trim(), {
    message: "Informe o aluno ou o nome do cliente",
    path: ["cliente_nome"]
  });
export type VendaInput = z.infer<typeof vendaSchema>;

// --- Item de venda ---
export const vendaItemSchema = z.object({
  variacao_id: z.string().uuid("Variação inválida"),
  quantidade: z.number().int().positive("Quantidade deve ser positiva"),
  preco_unit: z.number().nonnegative("Preço inválido")
});
export type VendaItemInput = z.infer<typeof vendaItemSchema>;
