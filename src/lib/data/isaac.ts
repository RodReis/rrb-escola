import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { createServerClient } from "@/lib/supabase/server";
import type { AlunoCadastro, TipoVaga } from "@/lib/isaac/preparar-importacao";

export type UnidadeIsaac = {
  id: string;
  nomeIsaac: string;
  companyId: string;
  companyNome: string;
  companyCnpj: string;
};

export type RepasseResumo = {
  id: string;
  unidadeId: string;
  unidadeNome: string;
  competenciaRepasse: string;
  dataRepasse: string;
  liquido: number;
  parcelas: number;
  pendencias: number;
  importadoEm: string;
};

export type ParcelaPendente = {
  id: string;
  idParcela: string;
  nomeIsaac: string;
  produto: string;
  tipo: string;
  competencia: string;
  valorBase: number;
  motivoPendencia: string;
  repasseId: string;
  competenciaRepasse: string;
  unidadeNome: string;
};

export async function getUnidadesIsaac(): Promise<UnidadeIsaac[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("isaac_unidade")
    .select("id, nome_isaac, company_id, companies(name, cnpj)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("ativo", true)
    .order("nome_isaac");

  if (error) throw error;

  return (data ?? []).map((row) => {
    const company = Array.isArray(row.companies) ? row.companies[0] : row.companies;
    return {
      id: row.id as string,
      nomeIsaac: row.nome_isaac as string,
      companyId: row.company_id as string,
      companyNome: (company?.name as string) ?? "—",
      companyCnpj: (company?.cnpj as string) ?? "—",
    };
  });
}

/**
 * Alunos para o casamento por nome.
 *
 * A comparação aplica `regexp_replace(nome_normalizado, '\s+', ' ')` porque a
 * coluna GERADA `alunos.nome_normalizado` é `lower(immutable_unaccent(nome))` e
 * NÃO colapsa espaço — o lado do isaac faz o mesmo em `normalizarNomeIsaac`.
 * Comparar sem isso faria um "Ana  Silva" do isaac não casar em silêncio.
 *
 * Traz o tipo_vaga da matrícula ATIVA mais recente, que é o que decide se a
 * parcela de mensalidade é legítima.
 */
export async function getAlunosParaCasamento(): Promise<AlunoCadastro[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("alunos")
    .select("id, nome_normalizado, matriculas(tipo_vaga, valor_mensalidade_praticado, ano_letivo, status)")
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  if (error) throw error;

  return (data ?? []).map((row) => {
    const matriculas = (Array.isArray(row.matriculas) ? row.matriculas : [row.matriculas])
      .filter((m): m is NonNullable<typeof m> => Boolean(m) && m.status === "ativa")
      .sort((a, b) => Number(b.ano_letivo ?? 0) - Number(a.ano_letivo ?? 0));
    const ativa = matriculas[0];
    return {
      id: row.id as string,
      nomeNormalizado: String(row.nome_normalizado ?? "").replace(/\s+/g, " ").trim(),
      tipoVaga: (ativa?.tipo_vaga as TipoVaga | undefined) ?? null,
      valorMensalidadePraticado:
        ativa?.valor_mensalidade_praticado === null || ativa?.valor_mensalidade_praticado === undefined
          ? null
          : Number(ativa.valor_mensalidade_praticado),
    };
  });
}

/** Apelidos já corrigidos à mão. Chave = nome normalizado do isaac. */
export async function getAliasesIsaac(): Promise<Map<string, string>> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("aluno_alias")
    .select("aluno_id, nome_normalizado")
    .eq("fonte", "isaac");

  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.nome_normalizado as string, row.aluno_id as string]));
}

export async function getRepassesIsaac(): Promise<RepasseResumo[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("isaac_repasse")
    .select("id, unidade_id, competencia_repasse, data_repasse, liquido, importado_em, isaac_unidade(nome_isaac)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .order("competencia_repasse", { ascending: false });

  if (error) throw error;
  if ((data ?? []).length === 0) return [];

  // Contagens por repasse numa consulta só — uma por linha viraria N+1 na tela.
  const ids = (data ?? []).map((r) => r.id as string);
  const { data: parcelas, error: erroParcelas } = await supabase
    .from("isaac_parcela")
    .select("repasse_id, motivo_pendencia, resolvido_em")
    .in("repasse_id", ids);

  if (erroParcelas) throw erroParcelas;

  const total = new Map<string, number>();
  const pendentes = new Map<string, number>();
  for (const p of parcelas ?? []) {
    const id = p.repasse_id as string;
    total.set(id, (total.get(id) ?? 0) + 1);
    if (p.motivo_pendencia !== null && p.resolvido_em === null) {
      pendentes.set(id, (pendentes.get(id) ?? 0) + 1);
    }
  }

  return (data ?? []).map((row) => {
    const unidade = Array.isArray(row.isaac_unidade) ? row.isaac_unidade[0] : row.isaac_unidade;
    return {
      id: row.id as string,
      unidadeId: row.unidade_id as string,
      unidadeNome: (unidade?.nome_isaac as string) ?? "—",
      competenciaRepasse: row.competencia_repasse as string,
      dataRepasse: row.data_repasse as string,
      liquido: Number(row.liquido),
      parcelas: total.get(row.id as string) ?? 0,
      pendencias: pendentes.get(row.id as string) ?? 0,
      importadoEm: row.importado_em as string,
    };
  });
}

export async function getPendenciasIsaac(): Promise<ParcelaPendente[]> {
  const supabase = await createServerClient();
  // Join de duas camadas (parcela → repasse → unidade) quebra a inferência de
  // tipos do supabase-js, então o repasse é resolvido numa segunda consulta.
  const { data, error } = await supabase
    .from("isaac_parcela")
    .select("id, id_parcela, nome_isaac, produto, tipo, competencia, valor_base, motivo_pendencia, repasse_id")
    .not("motivo_pendencia", "is", null)
    .is("resolvido_em", null)
    .order("nome_isaac");

  if (error) throw error;
  if ((data ?? []).length === 0) return [];

  const repasseIds = Array.from(new Set((data ?? []).map((row) => row.repasse_id as string)));
  const { data: repasses, error: erroRepasses } = await supabase
    .from("isaac_repasse")
    .select("id, competencia_repasse, isaac_unidade(nome_isaac)")
    .in("id", repasseIds);

  if (erroRepasses) throw erroRepasses;

  const porRepasse = new Map(
    (repasses ?? []).map((r) => {
      const unidade = Array.isArray(r.isaac_unidade) ? r.isaac_unidade[0] : r.isaac_unidade;
      return [
        r.id as string,
        {
          competenciaRepasse: r.competencia_repasse as string,
          unidadeNome: (unidade?.nome_isaac as string) ?? "—",
        },
      ];
    }),
  );

  return (data ?? []).map((row) => {
    const repasse = porRepasse.get(row.repasse_id as string);
    return {
      id: row.id as string,
      idParcela: row.id_parcela as string,
      nomeIsaac: row.nome_isaac as string,
      produto: row.produto as string,
      tipo: row.tipo as string,
      competencia: row.competencia as string,
      valorBase: Number(row.valor_base),
      motivoPendencia: row.motivo_pendencia as string,
      repasseId: row.repasse_id as string,
      competenciaRepasse: repasse?.competenciaRepasse ?? "—",
      unidadeNome: repasse?.unidadeNome ?? "—",
    };
  });
}
