import type { PermissionMap } from "@/lib/auth/permissions";
import { can } from "@/lib/auth/permissions";
import type { ColunaDef, ColunaMeta, Entidade } from "../tipos";
import { COLUNAS_ALUNO, type AlunoCtx } from "./aluno";
import { COLUNAS_FUNCIONARIO, type FuncionarioCtx } from "./funcionario";
import { COLUNAS_PROFESSOR } from "./professor";

export function getCatalogo(entidade: "aluno"): ColunaDef<AlunoCtx>[];
export function getCatalogo(entidade: "funcionario" | "professor"): ColunaDef<FuncionarioCtx>[];
export function getCatalogo(entidade: Entidade): ColunaDef<AlunoCtx>[] | ColunaDef<FuncionarioCtx>[];
export function getCatalogo(entidade: Entidade): ColunaDef<AlunoCtx>[] | ColunaDef<FuncionarioCtx>[] {
  if (entidade === "aluno") return COLUNAS_ALUNO;
  return entidade === "professor" ? COLUNAS_PROFESSOR : COLUNAS_FUNCIONARIO;
}

export function filtrarColunasPorPermissao<C>(cols: ColunaDef<C>[], perms: PermissionMap, isAdmin: boolean): ColunaDef<C>[] {
  return cols.filter((c) => !c.permissao || isAdmin || can(perms, c.permissao, "read"));
}

export function catalogoMeta<C>(cols: ColunaDef<C>[]): ColunaMeta[] {
  return cols.map((c) => ({ key: c.key, label: c.label, grupo: c.grupo, tipo: c.tipo ?? "texto" }));
}

export function relacoesNecessarias<C>(cols: ColunaDef<C>[], keys: string[]): Set<string> {
  const pedidas = new Set(keys);
  return new Set(cols.filter((c) => pedidas.has(c.key)).flatMap((c) => [...c.relacoes]));
}
