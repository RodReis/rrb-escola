import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { getStudentAvailableYears } from "@/lib/data/students";
import { companyLogoUrl } from "@/lib/storage/company-logo-url";
import { TemplateConfigSchema, type EmpresaRelatorio, type Entidade, type TemplateResumo } from "../tipos";

export type OpcoesAluno = {
  anos: number[];
  series: { id: string; nome: string; segmento: string | null }[];
  turmas: { id: string; nome: string; serie_id: string; ano_letivo: number }[];
};
export type OpcoesRh = {
  empresas: { id: string; nome: string }[];
  cargos: string[];
  turmas: { id: string; nome: string; ano_letivo: number }[];
  disciplinas: { id: string; nome: string; serie: string }[];
};

export async function listarTemplates(entidade: Entidade): Promise<TemplateResumo[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("relatorio_templates").select("id, nome, config").eq("entidade", entidade).order("nome");
  if (error) throw error;
  // Template com config inválida (ex.: schema mudou) é descartado em vez de quebrar a página.
  return (data ?? []).flatMap((t) => {
    const cfg = TemplateConfigSchema.safeParse(t.config);
    return cfg.success ? [{ id: t.id as string, nome: t.nome as string, config: cfg.data }] : [];
  });
}

export async function listarEmpresasRelatorio(): Promise<EmpresaRelatorio[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("companies").select("id, name, nome_fantasia, resolucao, logo_path").eq("ativo", true).order("name");
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id as string,
    nomeFantasia: (c.nome_fantasia as string) || (c.name as string),
    resolucao: (c.resolucao as string) ?? null,
    logoUrl: companyLogoUrl(c.logo_path as string | null),
  }));
}

export async function opcoesAluno(): Promise<OpcoesAluno> {
  const supabase = await createServerClient();
  const [anos, series, turmas] = await Promise.all([
    getStudentAvailableYears(),
    supabase.from("series").select("id, nome, segmento, ordem").eq("ativo", true).order("ordem"),
    supabase.from("turmas").select("id, nome, serie_id, ano_letivo").eq("ativo", true).order("nome"),
  ]);
  if (series.error) throw series.error;
  if (turmas.error) throw turmas.error;
  return {
    anos,
    series: (series.data ?? []).map((s) => ({ id: s.id as string, nome: s.nome as string, segmento: (s.segmento as string) ?? null })),
    turmas: (turmas.data ?? []) as OpcoesAluno["turmas"],
  };
}

export async function opcoesRh(): Promise<OpcoesRh> {
  const supabase = await createServerClient();
  const [empresas, cargos, turmas, disciplinas] = await Promise.all([
    supabase.from("companies").select("id, name").eq("ativo", true).order("name"),
    supabase.from("employees").select("cargo").not("cargo", "is", null),
    supabase.from("turmas").select("id, nome, ano_letivo, series(nome)").eq("ativo", true).order("ano_letivo", { ascending: false }),
    supabase.from("disciplinas").select("id, nome, series(nome)").eq("ativo", true).order("nome"),
  ]);
  for (const r of [empresas, cargos, turmas, disciplinas]) if (r.error) throw r.error;
  const um = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
  return {
    empresas: (empresas.data ?? []).map((e) => ({ id: e.id as string, nome: e.name as string })),
    cargos: Array.from(new Set((cargos.data ?? []).map((c) => String(c.cargo).trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    turmas: (turmas.data ?? []).map((t) => ({
      id: t.id as string,
      nome: `${um(t.series as { nome: string } | { nome: string }[] | null)?.nome ?? ""} ${t.nome}`.trim(),
      ano_letivo: t.ano_letivo as number,
    })),
    disciplinas: (disciplinas.data ?? []).map((d) => ({
      id: d.id as string,
      nome: d.nome as string,
      serie: um(d.series as { nome: string } | { nome: string }[] | null)?.nome ?? "",
    })),
  };
}
