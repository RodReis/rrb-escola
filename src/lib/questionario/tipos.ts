import type { ZodError } from "zod";
import type { QuestaoTipo } from "@/lib/validation/questionario";

export type ActionResult =
  | { ok: true; message?: string; redirectTo?: string }
  | { ok: false; error: string };

export function primeiroErro(error: ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos.";
}

export type GrupoRow = { id: string; codigo: number; descricao: string; ativo: boolean };
export type EscalaRow = { id: string; descricao: string; ativo: boolean; opcoes: string[] };
export type QuestaoLinha = {
  id: string;
  tipo: QuestaoTipo;
  pergunta: string;
  ativa: boolean;
  grupoId: string;
  grupoDescricao: string;
  escalaId: string | null;
  escalaDescricao: string | null;
};
export type QuestaoDetalhe = {
  id: string;
  grupoId: string;
  tipo: QuestaoTipo;
  pergunta: string;
  ativa: boolean;
  obrigatoria: boolean;
  limitarCaracteres: boolean;
  qtdeCaracteres: number;
  qtdeLinhas: number;
  alternativas: string[];
  escalaId: string | null;
  emUso: boolean;
};
export type QuestionarioRow = { id: string; descricao: string; ativo: boolean };
export type QuestionarioDetalhe = QuestionarioRow & {
  observacoes: string | null;
  vinculos: Array<{ id: string; questaoId: string; escalaId: string | null }>;
};
