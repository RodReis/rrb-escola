import { z } from "zod";

const numericNonNeg = z.preprocess(
  (v) => {
    if (v === "" || v == null) return 0;
    if (typeof v === "string") return Number(v.replace(",", "."));
    return v;
  },
  z.number().min(0)
);

export const BracketSchema = z.object({
  table: z.enum(["inss", "ir"]),
  vigencia_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ordem: z.preprocess((v) => Number(v), z.number().int().min(1)),
  valor_de: numericNonNeg,
  valor_ate: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(String(v).replace(",", "."))),
    z.number().min(0).nullable()
  ),
  aliquota: numericNonNeg,
  parcela_deduzir: numericNonNeg,
  deducao_dependente: numericNonNeg.optional()
});

export const NewVigenciaSchema = z.object({
  table: z.enum(["inss", "ir"]),
  vigencia_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  copy_from: z.preprocess((v) => (v === "" ? undefined : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional())
});
