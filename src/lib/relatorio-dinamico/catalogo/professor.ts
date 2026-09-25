import type { ColunaDef } from "../tipos";
import { txt } from "../formatar";
import { COLUNAS_FUNCIONARIO, colF, type FuncionarioCtx } from "./funcionario";

export const RELACOES_PROFESSOR = ["contrato", "atribuicoes", "usuario"] as const;

const COLLATOR = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });
const unicosOrdenados = (vals: string[]) => Array.from(new Set(vals.filter(Boolean))).sort(COLLATOR.compare).join(" / ");
const AT = ["atribuicoes"] as const;
const G = "Docência";

export const COLUNAS_PROFESSOR: ColunaDef<FuncionarioCtx>[] = [
  ...COLUNAS_FUNCIONARIO,
  colF("prof.disciplinas", "Disciplinas", G, AT, (c) => unicosOrdenados(c.atribuicoes.map((a) => a.disciplina))),
  colF("prof.turmas", "Turmas", G, AT, (c) => unicosOrdenados(c.atribuicoes.map((a) => `${a.serie} ${a.turma}`.trim()))),
  colF("prof.series", "Séries", G, AT, (c) => unicosOrdenados(c.atribuicoes.map((a) => a.serie))),
  colF("prof.usuario", "E-mail de Acesso ao Sistema", G, ["usuario"], (c) => txt(c.usuarioEmail)),
];
