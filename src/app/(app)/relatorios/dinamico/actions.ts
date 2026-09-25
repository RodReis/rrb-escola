"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import {
  ENTIDADES, FiltrosAlunoSchema, FiltrosRhSchema, LIMITE_REGISTROS, MODULO_POR_ENTIDADE, TemplateConfigSchema,
  type DadosRelatorio, type Entidade, type Ordenacao, type RegistroResumo, type TemplateResumo,
} from "@/lib/relatorio-dinamico/tipos";
import { filtrarColunasPorPermissao, getCatalogo, relacoesNecessarias } from "@/lib/relatorio-dinamico/catalogo";
import { montarDados } from "@/lib/relatorio-dinamico/montar";
import { ordenarLinhas } from "@/lib/relatorio-dinamico/ordenar";
import { carregarCtxAlunos, listarRegistrosAluno } from "@/lib/relatorio-dinamico/dados/aluno";
import { carregarCtxFuncionarios, listarRegistrosRh } from "@/lib/relatorio-dinamico/dados/rh";

type Falha = { ok: false; error: string };
const EntidadeSchema = z.enum(ENTIDADES);
const ROTA: Record<Entidade, string> = {
  aluno: "/relatorios/dinamico/alunos",
  funcionario: "/relatorios/dinamico/funcionarios",
  professor: "/relatorios/dinamico/professores",
};

function erro(e: unknown): Falha {
  const msg = e instanceof Error ? e.message : "Erro inesperado ao gerar o relatório.";
  return { ok: false, error: msg };
}

export async function listarRegistrosAction(input: { entidade: Entidade; filtros: unknown }): Promise<{ ok: true; registros: RegistroResumo[] } | Falha> {
  const ent = EntidadeSchema.safeParse(input.entidade);
  if (!ent.success) return { ok: false, error: "Relatório inválido." };
  await requirePermission(MODULO_POR_ENTIDADE[ent.data], "read");
  try {
    if (ent.data === "aluno") {
      const f = FiltrosAlunoSchema.safeParse(input.filtros);
      if (!f.success) return { ok: false, error: "Filtros inválidos." };
      return { ok: true, registros: await listarRegistrosAluno(f.data) };
    }
    const f = FiltrosRhSchema.safeParse(input.filtros);
    if (!f.success) return { ok: false, error: "Filtros inválidos." };
    return { ok: true, registros: await listarRegistrosRh(f.data, ent.data === "professor") };
  } catch (e) {
    console.error("[relatorio-dinamico] listarRegistros", e);
    return erro(e);
  }
}

const GerarSchema = z.object({
  entidade: EntidadeSchema,
  ids: z.array(z.string().uuid()).min(1, "Selecione ao menos um registro.").max(LIMITE_REGISTROS, `Máximo de ${LIMITE_REGISTROS} registros por emissão.`),
  colunas: z.array(z.string()).min(1, "Selecione ao menos uma coluna."),
  ordenacao: z.array(z.object({ key: z.string(), dir: z.enum(["asc", "desc"]) })),
  filtros: z.unknown(),
});

export async function gerarDadosRelatorioAction(input: {
  entidade: Entidade; ids: string[]; colunas: string[]; ordenacao: Ordenacao[]; filtros: unknown;
}): Promise<{ ok: true; dados: DadosRelatorio } | Falha> {
  const p = GerarSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Pedido inválido." };
  const { entidade, ids, colunas, ordenacao } = p.data;
  const session = await requirePermission(MODULO_POR_ENTIDADE[entidade], "read");
  const isAdmin = session.profile.perfil === "admin";

  try {
    if (entidade === "aluno") {
      const f = FiltrosAlunoSchema.safeParse(p.data.filtros);
      if (!f.success) return { ok: false, error: "Informe o ano de referência." };
      const catalogo = filtrarColunasPorPermissao(getCatalogo("aluno"), session.permissions, isAdmin);
      montarDados(catalogo, [], colunas); // valida keys antes de consultar o banco
      const ctxs = await carregarCtxAlunos(ids, f.data.ano, relacoesNecessarias(catalogo, colunas));
      return { ok: true, dados: ordenarLinhas(montarDados(catalogo, ctxs, colunas), ordenacao) };
    }
    const catalogo = filtrarColunasPorPermissao(getCatalogo(entidade), session.permissions, isAdmin);
    montarDados(catalogo, [], colunas);
    const ctxs = await carregarCtxFuncionarios(ids, relacoesNecessarias(catalogo, colunas));
    return { ok: true, dados: ordenarLinhas(montarDados(catalogo, ctxs, colunas), ordenacao) };
  } catch (e) {
    if (!(e instanceof Error && e.message.startsWith("Coluna desconhecida"))) console.error("[relatorio-dinamico] gerar", e);
    return erro(e);
  }
}

const SalvarSchema = z.object({
  id: z.string().uuid().optional(),
  entidade: EntidadeSchema,
  nome: z.string().trim().min(1, "Informe o nome do template.").max(120),
  config: TemplateConfigSchema,
});

export async function salvarTemplateAction(input: { id?: string; entidade: Entidade; nome: string; config: unknown }): Promise<{ ok: true; template: TemplateResumo } | Falha> {
  const p = SalvarSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Template inválido." };
  const { id, entidade, nome, config } = p.data;
  const session = await requirePermission(MODULO_POR_ENTIDADE[entidade], id ? "update" : "create");
  const supabase = await createServerClient();

  const query = id
    ? supabase.from("relatorio_templates").update({ nome, config }).eq("id", id).eq("entidade", entidade)
    : supabase.from("relatorio_templates").insert({ escola_id: session.profile.escola_id, entidade, nome, config, criado_por: session.user?.id ?? null });
  const { data, error } = await query.select("id, nome, config").single();
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Já existe um template com esse nome." };
    console.error("[relatorio-dinamico] salvarTemplate", error);
    return { ok: false, error: "Não foi possível salvar o template." };
  }
  revalidatePath(ROTA[entidade]);
  return { ok: true, template: { id: data.id as string, nome: data.nome as string, config } };
}

export async function excluirTemplateAction(input: { id: string; entidade: Entidade }): Promise<{ ok: true } | Falha> {
  const p = z.object({ id: z.string().uuid(), entidade: EntidadeSchema }).safeParse(input);
  if (!p.success) return { ok: false, error: "Template inválido." };
  await requirePermission(MODULO_POR_ENTIDADE[p.data.entidade], "delete");
  const supabase = await createServerClient();
  const { error } = await supabase.from("relatorio_templates").delete().eq("id", p.data.id).eq("entidade", p.data.entidade);
  if (error) {
    console.error("[relatorio-dinamico] excluirTemplate", error);
    return { ok: false, error: "Não foi possível excluir o template." };
  }
  revalidatePath(ROTA[p.data.entidade]);
  return { ok: true };
}
