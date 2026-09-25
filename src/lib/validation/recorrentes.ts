import { z } from "zod";

const competencia = z.string().regex(/^\d{4}-\d{2}$/, "Competência inválida (AAAA-MM)");

export const recorrenteSchema = z.object({
  descricao: z.string().min(1, "Descrição obrigatória").max(200),
  categoria_id: z.string().uuid("Categoria inválida"),
  company_id: z.string().uuid("Empresa inválida"),
  contraparte: z.string().max(200).nullable(),
  valor_referencia: z.number().positive("Valor deve ser maior que zero").nullable(),
  dia_vencimento: z.number().int().min(1).max(31),
  classe_despesa: z.enum(["fixa", "variavel"]).nullable(),
  inicio_competencia: competencia,
});

export const lancarValorSchema = z.object({
  recorrente_id: z.string().uuid(),
  competencia,
  valor: z.number().positive("Valor deve ser maior que zero"),
});
