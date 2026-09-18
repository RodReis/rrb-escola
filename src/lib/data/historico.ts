import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { mediaAnual } from "@/lib/historico/medias";
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
  credenciamentoId: string;
  credenciamentoNome: string;
  nivel: NivelEnsino;
  anoInicio: number;
  anoFim: number;
};

function mapCredenciamento(row: Record<string, unknown>): HistoricoCredenciamento {
  return {
    razaoSocial: (row.razao_social as string) ?? "",
    nomeFantasia: (row.nome_fantasia as string) ?? "",
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

export async function listarCredenciamentos() {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("historico_credenciamentos")
    .select("id, nome_fantasia")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .order("nome_fantasia");
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id as string, nomeFantasia: r.nome_fantasia as string }));
}

export async function listarNiveisEnsino(): Promise<NivelEnsinoRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("historico_niveis_ensino")
    .select("id, serie_id, nivel, ano_inicio, ano_fim, series(nome), historico_credenciamentos(id, nome_fantasia)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .order("ano_inicio", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const serie = row.series as { nome?: string } | null;
    const cred = row.historico_credenciamentos as { id?: string; nome_fantasia?: string } | null;
    return {
      id: row.id as string,
      serieId: row.serie_id as string,
      serieNome: serie?.nome ?? "",
      credenciamentoId: cred?.id ?? "",
      credenciamentoNome: cred?.nome_fantasia ?? "",
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
    .select("historico_credenciamentos(*)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("serie_id", serieId)
    .lte("ano_inicio", ano)
    .gte("ano_fim", ano)
    .maybeSingle();
  if (error) throw error;
  const cred = data?.historico_credenciamentos as unknown as Record<string, unknown> | null;
  return cred ? mapCredenciamento(cred) : null;
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

  const porDisciplina = new Map<string, { nome: string; ordem: number; bimestrais: Array<number | null> }>();
  for (const row of data ?? []) {
    const id = row.disciplina_id as string;
    const disciplina = row.disciplinas as { nome?: string; ordem?: number } | null;
    let entrada = porDisciplina.get(id);
    if (!entrada) {
      entrada = { nome: disciplina?.nome ?? "", ordem: disciplina?.ordem ?? 0, bimestrais: [] };
      porDisciplina.set(id, entrada);
    }
    entrada.bimestrais.push(row.media === null ? null : Number(row.media));
  }

  return Array.from(porDisciplina.entries())
    .map(([disciplinaId, e]) => ({
      disciplinaId,
      disciplinaNome: e.nome,
      nota: mediaAnual(e.bimestrais),
      cargaHoraria: null,
      faltas: null,
      ordem: e.ordem
    }))
    .sort((a, b) => a.ordem - b.ordem);
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

  // Nota: `nacionalidade`, `orgao_expedidor`, `data_expedicao` e `filiacao` não existem em `alunos`
  // (ver supabase/migrations/202605130001_initial_schema.sql). Mapeados como null abaixo.
  const [{ data: aluno, error: erroAluno }, { data: anosRows, error: erroAnos }] = await Promise.all([
    supabase
      .from("alunos")
      .select("id, nome, cpf, matricula_codigo, data_nascimento, naturalidade, rg")
      .eq("escola_id", DEFAULT_SCHOOL_ID)
      .eq("id", alunoId)
      .maybeSingle(),
    supabase
      .from("historico_anos")
      .select("*, historico_notas(*)")
      .eq("historico_id", historico.id as string)
      .order("ano")
  ]);
  if (erroAluno) throw erroAluno;
  if (erroAnos) throw erroAnos;
  if (!aluno) return null;

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
      filiacao: null,
      dataNascimento: (aluno.data_nascimento as string) ?? null,
      naturalidade: (aluno.naturalidade as string) ?? null,
      nacionalidade: null,
      rg: (aluno.rg as string) ?? null,
      orgaoExpedidor: null,
      dataExpedicao: null
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
