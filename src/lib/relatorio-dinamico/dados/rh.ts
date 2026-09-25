import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import type { FiltrosRh, RegistroResumo } from "../tipos";
import type { FuncionarioCtx } from "../catalogo/funcionario";
import { emLotes } from "./lotes";

const COLLATOR = new Intl.Collator("pt-BR", { sensitivity: "base" });
const um = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
const CATEGORIAS_DOCENTES = "(fund1,fund2,medio)";

async function perfisPorAtribuicao(f: FiltrosRh): Promise<string[] | null> {
  if (f.turmaIds.length === 0 && f.disciplinaIds.length === 0) return null;
  const supabase = await createServerClient();
  let q = supabase.from("professor_disciplina_turma").select("perfil_id");
  if (f.turmaIds.length) q = q.in("turma_id", f.turmaIds);
  if (f.disciplinaIds.length) q = q.in("disciplina_id", f.disciplinaIds);
  const { data, error } = await q;
  if (error) throw error;
  return Array.from(new Set((data ?? []).map((r) => r.perfil_id as string)));
}

export async function listarRegistrosRh(f: FiltrosRh, professor: boolean): Promise<RegistroResumo[]> {
  const supabase = await createServerClient();
  let q = supabase.from("employees").select("id, name, cargo, companies(name, nome_fantasia)");
  if (f.situacao !== "todos") q = q.eq("ativo", f.situacao === "ativo");
  if (f.companyId) q = q.eq("company_id", f.companyId);
  if (f.categoria) q = q.eq("school_category", f.categoria);
  if (f.cargo) q = q.ilike("cargo", f.cargo);
  if (professor) {
    q = q.or(`perfil_id.not.is.null,school_category.in.${CATEGORIAS_DOCENTES}`);
    const perfis = await perfisPorAtribuicao(f);
    if (perfis !== null) {
      if (perfis.length === 0) return [];
      q = q.in("perfil_id", perfis);
    }
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? [])
    .map((e) => {
      const emp = um(e.companies as { name: string; nome_fantasia: string | null } | { name: string; nome_fantasia: string | null }[] | null);
      return { id: e.id as string, nome: e.name as string, detalhe: [e.cargo, emp?.nome_fantasia || emp?.name].filter(Boolean).join(" · ") };
    })
    .sort((a, b) => COLLATOR.compare(a.nome, b.nome));
}

type LinhaFunc = Record<string, unknown> & {
  id: string; name: string; perfil_id: string | null;
  companies: FuncionarioCtx["empresa"] | NonNullable<FuncionarioCtx["empresa"]>[] | null;
  folha_contratos?: Array<NonNullable<FuncionarioCtx["contrato"]> & { ativo: boolean }>;
  perfis?: { email: string | null } | { email: string | null }[] | null;
};

async function atribuicoesPorPerfil(perfilIds: string[]): Promise<Map<string, FuncionarioCtx["atribuicoes"]>> {
  const supabase = await createServerClient();
  const mapa = new Map<string, FuncionarioCtx["atribuicoes"]>();
  for (const lote of emLotes(perfilIds)) {
    const { data, error } = await supabase
      .from("professor_disciplina_turma")
      .select("perfil_id, disciplinas(nome), turmas(nome, series(nome))")
      .in("perfil_id", lote);
    if (error) throw error;
    for (const r of data ?? []) {
      const disc = um(r.disciplinas as { nome: string } | { nome: string }[] | null);
      const turma = um(r.turmas as { nome: string; series: unknown } | { nome: string; series: unknown }[] | null);
      const serie = um(turma?.series as { nome: string } | { nome: string }[] | null);
      const lista = mapa.get(r.perfil_id as string) ?? [];
      lista.push({ disciplina: disc?.nome ?? "", turma: turma?.nome ?? "", serie: serie?.nome ?? "" });
      mapa.set(r.perfil_id as string, lista);
    }
  }
  return mapa;
}

export async function carregarCtxFuncionarios(ids: string[], relacoes: Set<string>): Promise<FuncionarioCtx[]> {
  const supabase = await createServerClient();
  const partes = [
    "id, name, cpf, birth_date, hire_date, email, telefone, cargo, school_category, status_contrato, ativo, perfil_id",
    "companies(name, nome_fantasia, cnpj)",
    relacoes.has("contrato") ? "folha_contratos(salario_base, valor_hora_aula, aulas_semanais, data_desligamento, ativo)" : null,
    relacoes.has("usuario") ? "perfis(email)" : null,
  ].filter(Boolean);

  const linhas: LinhaFunc[] = [];
  for (const lote of emLotes(ids)) {
    const { data, error } = await supabase.from("employees").select(partes.join(", ")).in("id", lote);
    if (error) throw error;
    linhas.push(...((data ?? []) as unknown as LinhaFunc[]));
  }

  const atrib = relacoes.has("atribuicoes")
    ? await atribuicoesPorPerfil(linhas.map((l) => l.perfil_id).filter((p): p is string => Boolean(p)))
    : new Map<string, FuncionarioCtx["atribuicoes"]>();
  const hoje = new Date();

  return linhas
    .map((l): FuncionarioCtx => {
      const contratos = l.folha_contratos ?? [];
      const contrato = contratos.find((c) => c.ativo) ?? null;
      return {
        func: l as unknown as FuncionarioCtx["func"],
        empresa: um(l.companies),
        contrato,
        atribuicoes: l.perfil_id ? atrib.get(l.perfil_id) ?? [] : [],
        usuarioEmail: um(l.perfis)?.email ?? null,
        hoje,
      };
    })
    .sort((x, y) => COLLATOR.compare(x.func.name, y.func.name));
}
