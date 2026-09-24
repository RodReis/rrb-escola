import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { montarFiliacao } from "@/lib/historico/filiacao";
import { agregarNotasConsolidadas } from "@/lib/historico/medias";
import type {
  HistoricoAno,
  HistoricoCredenciamento,
  HistoricoData,
  HistoricoNota,
  NivelEnsino
} from "@/lib/historico/tipos";
import { createServerClient } from "@/lib/supabase/server";

export type NivelEnsinoRow = {
  id: string;
  serieId: string;
  serieNome: string;
  companyId: string;
  companyNome: string;
  nivel: NivelEnsino;
  anoInicio: number;
  anoFim: number;
};

/** `companies` (RH) fornece a identidade jurídica e os dados de cabeçalho do histórico. */
export function mapCredenciamento(row: Record<string, unknown>): HistoricoCredenciamento {
  return {
    razaoSocial: (row.name as string) ?? "",
    nomeFantasia: (row.nome_fantasia as string) || (row.name as string) || "",
    cnpj: (row.cnpj as string) ?? null,
    resolucao: (row.resolucao as string) ?? null,
    endereco: (row.endereco as string) ?? null,
    cidade: (row.cidade as string) ?? null,
    uf: (row.uf as string) ?? null,
    cep: (row.cep as string) ?? null,
    telefones: (row.telefones as string) ?? null,
    email: (row.email as string) ?? null,
    logoPath: (row.logo_path as string) ?? null,
    secretarioNome: (row.secretario_nome as string) ?? null,
    secretarioCargo: (row.secretario_cargo as string) ?? "Secretário(a)",
    diretorNome: (row.diretor_nome as string) ?? null,
    diretorCargo: (row.diretor_cargo as string) ?? "Diretor(a)"
  };
}

/** Empresas do RH, elegíveis para associar a uma série no histórico escolar. */
export async function listarCredenciamentos() {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, name")
    .eq("ativo", true)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id as string, nomeFantasia: r.name as string }));
}

/** Anos que o aluno de fato cursou nesta escola, a partir de `matriculas` — fonte de verdade para anos internos. */
export async function listarAnosMatriculados(
  alunoId: string
): Promise<Array<{ ano: number; serieId: string; serieNome: string }>> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("matriculas")
    .select("ano_letivo, serie_id, series(nome)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("aluno_id", alunoId)
    .order("ano_letivo", { ascending: false });
  if (error) throw error;

  const vistos = new Set<string>();
  const resultado: Array<{ ano: number; serieId: string; serieNome: string }> = [];
  for (const row of data ?? []) {
    const ano = row.ano_letivo as number;
    const serieId = row.serie_id as string;
    const chave = `${ano}-${serieId}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const serie = row.series as { nome?: string } | null;
    resultado.push({ ano, serieId, serieNome: serie?.nome ?? "" });
  }
  return resultado;
}

export async function listarNiveisEnsino(): Promise<NivelEnsinoRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("historico_niveis_ensino")
    .select("id, serie_id, nivel, ano_inicio, ano_fim, series(nome), companies(id, name)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .order("ano_inicio", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const serie = row.series as { nome?: string } | null;
    const empresa = row.companies as { id?: string; name?: string } | null;
    return {
      id: row.id as string,
      serieId: row.serie_id as string,
      serieNome: serie?.nome ?? "",
      companyId: empresa?.id ?? "",
      companyNome: empresa?.name ?? "",
      nivel: row.nivel as NivelEnsino,
      anoInicio: row.ano_inicio as number,
      anoFim: row.ano_fim as number
    };
  });
}

export async function getCredenciamentoVigente(
  serieId: string,
  ano: number
): Promise<HistoricoCredenciamento | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("historico_niveis_ensino")
    .select("companies(*)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("serie_id", serieId)
    .lte("ano_inicio", ano)
    .gte("ano_fim", ano)
    .order("ano_inicio", { ascending: false })
    .limit(1);
  if (error) throw error;
  const empresa = data?.[0]?.companies as unknown as Record<string, unknown> | null;
  if (empresa) return mapCredenciamento(empresa);

  // Sem associação vigente para o ano (histórico antigo, associação só do ano
  // corrente): cai para a associação mais recente da série. O cabeçalho e as
  // assinaturas são da escola que emite hoje, não do ano cursado — sem isso o
  // PDF saía sem cabeçalho, sem cidade e sem os nomes das signatárias.
  const { data: recente, error: erroRecente } = await supabase
    .from("historico_niveis_ensino")
    .select("companies(*)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("serie_id", serieId)
    .order("ano_inicio", { ascending: false })
    .limit(1);
  if (erroRecente) throw erroRecente;
  const fallback = recente?.[0]?.companies as unknown as Record<string, unknown> | null;
  return fallback ? mapCredenciamento(fallback) : null;
}

/** Médias ao vivo de um ano interno, calculadas de notas_consolidadas. */
async function notasAoVivo(alunoId: string, anoLetivo: number): Promise<HistoricoNota[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("notas_consolidadas")
    .select("disciplina_id, bimestre, media, disciplinas(nome, ordem)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("aluno_id", alunoId)
    .eq("ano_letivo", anoLetivo);
  if (error) throw error;

  return agregarNotasConsolidadas(
    (data ?? []).map((row) => ({
      disciplina_id: row.disciplina_id as string,
      media: row.media === null ? null : Number(row.media),
      disciplinas: row.disciplinas as { nome?: string; ordem?: number } | null
    }))
  );
}

export async function getHistoricoAluno(
  alunoId: string,
  nivel: NivelEnsino
): Promise<HistoricoData | null> {
  const supabase = await createServerClient();

  const { data: historico, error: erroHistorico } = await supabase
    .from("historico_escolar")
    .select("id, observacoes")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("aluno_id", alunoId)
    .eq("nivel", nivel)
    .maybeSingle();
  if (erroHistorico) throw erroHistorico;
  if (!historico) return null;

  // A filiação do histórico vem dos responsáveis com parentesco de pai/mãe.
  const [
    { data: aluno, error: erroAluno },
    { data: anosRows, error: erroAnos },
    { data: responsaveis, error: erroResponsaveis }
  ] = await Promise.all([
    supabase
      .from("alunos")
      .select(
        "id, nome, cpf, matricula_codigo, data_nascimento, naturalidade, rg, nacionalidade, orgao_expedidor, data_expedicao"
      )
      .eq("escola_id", DEFAULT_SCHOOL_ID)
      .eq("id", alunoId)
      .maybeSingle(),
    supabase
      .from("historico_anos")
      .select("*, historico_notas(*)")
      .eq("historico_id", historico.id as string)
      .order("ano"),
    supabase
      .from("responsaveis_aluno")
      .select("nome, parentesco")
      .eq("aluno_id", alunoId)
  ]);
  if (erroAluno) throw erroAluno;
  if (erroAnos) throw erroAnos;
  if (erroResponsaveis) throw erroResponsaveis;
  if (!aluno) return null;

  const filiacao = montarFiliacao(
    (responsaveis ?? []).map((r) => ({
      nome: r.nome as string,
      parentesco: (r.parentesco as string) ?? null
    }))
  );

  const anos: HistoricoAno[] = [];
  for (const row of anosRows ?? []) {
    const congelado = row.congelado as boolean;
    const origem = row.origem as HistoricoAno["origem"];
    const notas: HistoricoNota[] =
      !congelado && origem === "interna"
        ? await notasAoVivo(alunoId, row.ano as number)
        : ((row.historico_notas as Record<string, unknown>[]) ?? [])
            .map((n) => ({
              disciplinaId: (n.disciplina_id as string) ?? null,
              disciplinaNome: n.disciplina_nome as string,
              nota: n.nota === null ? null : Number(n.nota),
              cargaHoraria: (n.carga_horaria as number) ?? null,
              faltas: (n.faltas as number) ?? null,
              ordem: (n.ordem as number) ?? 0
            }))
            .sort((a, b) => a.ordem - b.ordem);

    anos.push({
      id: row.id as string,
      ano: row.ano as number,
      serieId: (row.serie_id as string) ?? null,
      serieNome: row.serie_nome as string,
      origem,
      instituicao: (row.instituicao as string) ?? null,
      cidade: (row.cidade as string) ?? null,
      uf: (row.uf as string) ?? null,
      resultado: row.resultado as HistoricoAno["resultado"],
      mediaAprovacao: row.media_aprovacao === null ? null : Number(row.media_aprovacao),
      cargaHoraria: (row.carga_horaria as number) ?? null,
      diasLetivos: (row.dias_letivos as number) ?? null,
      faltas: (row.faltas as number) ?? null,
      percentualFrequencia:
        row.percentual_frequencia === null ? null : Number(row.percentual_frequencia),
      congelado,
      notas
    });
  }

  const primeiroInterno = anos.find((a) => a.origem === "interna" && a.serieId);
  const credenciamento = primeiroInterno?.serieId
    ? await getCredenciamentoVigente(primeiroInterno.serieId, primeiroInterno.ano)
    : null;

  return {
    aluno: {
      id: aluno.id as string,
      nome: aluno.nome as string,
      cpf: (aluno.cpf as string) ?? null,
      matricula: (aluno.matricula_codigo as string) ?? null,
      filiacao,
      dataNascimento: (aluno.data_nascimento as string) ?? null,
      naturalidade: (aluno.naturalidade as string) ?? null,
      nacionalidade: (aluno.nacionalidade as string) ?? null,
      rg: (aluno.rg as string) ?? null,
      orgaoExpedidor: (aluno.orgao_expedidor as string) ?? null,
      dataExpedicao: (aluno.data_expedicao as string) ?? null
    },
    nivel,
    credenciamento: credenciamento ?? {
      razaoSocial: "",
      nomeFantasia: "",
      cnpj: null,
      resolucao: null,
      endereco: null,
      cidade: null,
      uf: null,
      cep: null,
      telefones: null,
      email: null,
      logoPath: null,
      secretarioNome: null,
      secretarioCargo: "Secretário(a)",
      diretorNome: null,
      diretorCargo: "Diretor(a)"
    },
    anos,
    observacoes: (historico.observacoes as string) ?? null
  };
}
