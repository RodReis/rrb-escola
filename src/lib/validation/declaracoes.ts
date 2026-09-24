import { z } from "zod";
import { validarParametros } from "@/lib/documents/declaracao-resolver";

function campoComParametrosValidos(nomeCampo: string) {
  return z.string().min(1, `${nomeCampo} é obrigatório`).superRefine((valor, ctx) => {
    const resultado = validarParametros(valor);
    if (!resultado.valido) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Parâmetro desconhecido em ${nomeCampo}: ${resultado.tokenInvalido}`
      });
    }
  });
}

export const DeclaracaoModeloSchema = z.object({
  nome: z.string().min(3, "Nome deve ter ao menos 3 caracteres"),
  titulo: campoComParametrosValidos("Título"),
  texto: campoComParametrosValidos("Texto"),
  fecho: campoComParametrosValidos("Fecho")
});

export const DeclaracaoModeloUpdateSchema = DeclaracaoModeloSchema.extend({
  id: z.string().uuid(),
  ativo: z.preprocess((v) => v === "on" || v === true, z.boolean())
});

export type DeclaracaoModeloInput = z.infer<typeof DeclaracaoModeloSchema>;
