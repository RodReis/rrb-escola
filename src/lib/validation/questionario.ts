import { z } from "zod";

export const QUESTAO_TIPOS = [
  "subjetiva",
  "objetiva_unica",
  "objetiva_multipla",
  "objetiva_escala",
  "matriz_descritiva",
] as const;
export type QuestaoTipo = (typeof QUESTAO_TIPOS)[number];

export const QUESTAO_TIPO_LABEL: Record<QuestaoTipo, string> = {
  subjetiva: "Questão Subjetiva",
  objetiva_unica: "Questão Objetiva de Única Escolha",
  objetiva_multipla: "Questão Objetiva de Múltipla Escolha",
  objetiva_escala: "Questão Objetiva Com Escala",
  matriz_descritiva: "Questão de Matriz Descritiva",
};

const textoObrigatorio = (mensagem: string) => z.string().trim().min(1, mensagem);

function distintos(valores: string[]): boolean {
  const norm = valores.map((v) => v.trim().toLowerCase());
  return new Set(norm).size === norm.length;
}

export const IdSchema = z.string().uuid("Registro inválido.");

export const GrupoSchema = z.object({
  descricao: textoObrigatorio("Descrição é obrigatória"),
});

export const EscalaSchema = z
  .object({
    descricao: textoObrigatorio("Descrição é obrigatória"),
    opcoes: z
      .array(textoObrigatorio("Toda opção precisa de um rótulo"))
      .min(2, "A escala precisa de ao menos 2 opções"),
  })
  .refine((v) => distintos(v.opcoes), {
    message: "As opções da escala não podem se repetir",
    path: ["opcoes"],
  });

export const QuestaoSchema = z
  .object({
    grupoId: z.string().uuid("Grupo é obrigatório"),
    tipo: z.enum(QUESTAO_TIPOS, { errorMap: () => ({ message: "Tipo de questão é obrigatório" }) }),
    pergunta: textoObrigatorio("Pergunta é obrigatória"),
    ativa: z.boolean(),
    obrigatoria: z.boolean(),
    limitarCaracteres: z.boolean(),
    qtdeCaracteres: z.number().int("Informe um número inteiro").min(0),
    qtdeLinhas: z.number().int("Informe um número inteiro").min(0),
    alternativas: z.array(z.string().trim()),
    escalaId: z.string().uuid("Escala inválida").nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.tipo === "objetiva_escala" && !v.escalaId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["escalaId"], message: "Escolha a escala da questão" });
    }
    if (v.tipo === "subjetiva" && v.limitarCaracteres && v.qtdeCaracteres < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["qtdeCaracteres"],
        message: "Informe a quantidade de caracteres",
      });
    }
    if (v.tipo === "objetiva_unica" || v.tipo === "objetiva_multipla") {
      const msg = v.alternativas.some((a) => a === "")
        ? "Toda alternativa precisa de texto"
        : v.alternativas.length < 2
          ? "A questão precisa de ao menos 2 alternativas"
          : !distintos(v.alternativas)
            ? "As alternativas não podem se repetir"
            : null;
      if (msg) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["alternativas"], message: msg });
    }
  })
  .transform((v) => {
    const subjetiva = v.tipo === "subjetiva";
    const comAlternativas = v.tipo === "objetiva_unica" || v.tipo === "objetiva_multipla";
    return {
      ...v,
      limitarCaracteres: subjetiva && v.limitarCaracteres,
      qtdeCaracteres: subjetiva && v.limitarCaracteres ? v.qtdeCaracteres : 0,
      qtdeLinhas: subjetiva ? v.qtdeLinhas : 0,
      alternativas: comAlternativas ? v.alternativas : [],
      escalaId: v.tipo === "objetiva_escala" ? v.escalaId : null,
    };
  });
export type QuestaoInput = z.output<typeof QuestaoSchema>;

const VinculoSchema = z.object({
  id: z.string().uuid().optional(),
  questaoId: z.string().uuid("Questão inválida"),
  escalaId: z.string().uuid("Escala inválida").nullable(),
});

export const QuestionarioSchema = z.object({
  descricao: textoObrigatorio("Descrição é obrigatória"),
  observacoes: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v)),
  ativo: z.boolean(),
  vinculos: z.array(VinculoSchema),
});

export const SecaoSchema = z.object({
  descricao: textoObrigatorio("Descrição é obrigatória"),
  permiteLancamentoColetivo: z.boolean(),
});

const etapaSchema = z
  .number({ invalid_type_error: "Etapa inválida" })
  .int("Etapa inválida")
  .min(1, "Etapa inválida")
  .max(4, "Etapa inválida");

export const AssociacaoLoteSchema = z.object({
  questionarioId: z.string().uuid("Questionário é obrigatório"),
  professorId: z.string().uuid("Professor é obrigatório"),
  etapas: z.array(etapaSchema).min(1, "Marque ao menos uma etapa"),
  turmaIds: z.array(z.string().uuid("Turma inválida")).min(1, "Marque ao menos uma turma"),
});

export const AssociacaoEdicaoSchema = z.object({
  id: z.string().uuid("Registro inválido."),
  questionarioId: z.string().uuid("Questionário é obrigatório"),
  turmaId: z.string().uuid("Turma é obrigatória"),
  professorId: z.string().uuid("Professor é obrigatório"),
  etapa: etapaSchema,
});
