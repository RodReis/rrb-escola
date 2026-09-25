import { z } from "zod";
import type { ModuloCodigo } from "@/lib/auth/permissions";

export const ENTIDADES = ["aluno", "funcionario", "professor"] as const;
export type Entidade = (typeof ENTIDADES)[number];

export const MODULO_POR_ENTIDADE: Record<Entidade, ModuloCodigo> = {
  aluno: "relatorios.dinamico-aluno",
  funcionario: "relatorios.dinamico-funcionario",
  professor: "relatorios.dinamico-professor",
};

export const LIMITE_REGISTROS = 2000;

export type TipoColuna = "texto" | "data" | "numero";

export type ColunaDef<Ctx> = {
  key: string;
  label: string;
  grupo: string;
  /** Relações que o server precisa buscar para resolver esta coluna. */
  relacoes: readonly string[];
  tipo?: TipoColuna;
  /** Coluna só existe para quem tem `read` neste módulo (admin sempre). */
  permissao?: ModuloCodigo;
  resolve: (ctx: Ctx) => string;
};

export type ColunaMeta = { key: string; label: string; grupo: string; tipo: TipoColuna };
export type Ordenacao = { key: string; dir: "asc" | "desc" };
export type DadosRelatorio = { colunas: ColunaMeta[]; linhas: string[][] };
export type RegistroResumo = { id: string; nome: string; detalhe: string };

export const FORMATOS = ["etiqueta", "grade", "tabular", "csv"] as const;
export type Formato = (typeof FORMATOS)[number];
export const FORMATO_LABEL: Record<Formato, string> = {
  etiqueta: "Etiquetas",
  grade: "Relatório em grade PDF",
  tabular: "Relatório tabular PDF",
  csv: "Arquivo CSV",
};

export const MODELOS_ETIQUETA_CODIGOS = ["6180", "6181", "A4256", "A4362"] as const;
export type ModeloEtiqueta = (typeof MODELOS_ETIQUETA_CODIGOS)[number];

export const TemplateConfigSchema = z
  .object({
    formato: z.enum(FORMATOS),
    colunas: z.array(z.string().min(1).max(80)).max(200),
    ordenacao: z.array(z.object({ key: z.string(), dir: z.enum(["asc", "desc"]) })).max(10),
    copias: z.number().int().min(1).max(10),
    descricaoImpressao: z.string().max(200).optional(),
    modeloEtiqueta: z.enum(MODELOS_ETIQUETA_CODIGOS).optional(),
    fonte: z.number().min(6).max(12).refine((v) => Number.isInteger(v * 2), "Fonte em passos de 0,5").optional(),
    rotulos: z.boolean().optional(),
    titulo: z.string().max(120).optional(),
    subtitulo: z.string().max(120).optional(),
    exibirLogos: z.boolean().optional(),
    logosEmpresas: z.array(z.string().uuid()).max(4).optional(),
  })
  .superRefine((c, ctx) => {
    if (new Set(c.colunas).size !== c.colunas.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Coluna repetida", path: ["colunas"] });
    }
    if (c.ordenacao.some((o) => !c.colunas.includes(o.key))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ordenação só por coluna selecionada", path: ["ordenacao"] });
    }
    if ((c.formato === "grade" || c.formato === "tabular") && !c.titulo?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe o título do relatório", path: ["titulo"] });
    }
    if (c.formato === "etiqueta" && !c.modeloEtiqueta) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Escolha o formato da etiqueta", path: ["modeloEtiqueta"] });
    }
  });
export type TemplateConfig = z.infer<typeof TemplateConfigSchema>;

export type TemplateResumo = { id: string; nome: string; config: TemplateConfig };
export type EmpresaRelatorio = { id: string; nomeFantasia: string; resolucao: string | null; logoUrl: string | null };

export const STATUS_MATRICULA = ["ativa", "cancelada", "transferida", "concluida"] as const;

export const FiltrosAlunoSchema = z.object({
  ano: z.number().int().min(2000).max(2100),
  filtrarPor: z.enum(["serie", "turma", "segmento"]),
  valores: z.array(z.string().min(1)).max(200),
  status: z.array(z.enum(STATUS_MATRICULA)).min(1),
});
export type FiltrosAluno = z.infer<typeof FiltrosAlunoSchema>;

export const FiltrosRhSchema = z.object({
  companyId: z.string().uuid().nullable(),
  situacao: z.enum(["ativo", "inativo", "todos"]),
  categoria: z.enum(["admin", "fund1", "fund2", "medio"]).nullable(),
  cargo: z.string().max(80).nullable(),
  turmaIds: z.array(z.string().uuid()).max(200),
  disciplinaIds: z.array(z.string().uuid()).max(200),
});
export type FiltrosRh = z.infer<typeof FiltrosRhSchema>;

const COLUNAS_PADRAO: Record<Entidade, string[]> = {
  aluno: ["aluno.nome", "mat.serie", "mat.turma"],
  funcionario: ["func.nome", "func.cargo"],
  professor: ["func.nome", "prof.disciplinas"],
};

export function configPadrao(entidade: Entidade): TemplateConfig {
  return {
    formato: "etiqueta",
    colunas: COLUNAS_PADRAO[entidade],
    ordenacao: [],
    copias: 1,
    descricaoImpressao: "",
    modeloEtiqueta: "6180",
    fonte: 7.5,
    rotulos: true,
    titulo: "",
    subtitulo: "",
    exibirLogos: true,
    logosEmpresas: [],
  };
}

/** Mensagem que bloqueia o botão Emitir, ou null quando pode emitir. */
export function validarEmissao(config: TemplateConfig, qtdSelecionados: number): string | null {
  if (qtdSelecionados === 0) return "Selecione ao menos um registro na aba Filtros.";
  if (qtdSelecionados > LIMITE_REGISTROS) return `Máximo de ${LIMITE_REGISTROS} registros por emissão.`;
  if (config.colunas.length === 0) return "Selecione ao menos uma coluna no Leiaute.";
  const r = TemplateConfigSchema.safeParse(config);
  return r.success ? null : r.error.issues[0]?.message ?? "Leiaute inválido.";
}
