import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { createServerClient } from "@/lib/supabase/server";
import { getSignedFotoUrl } from "@/lib/storage/photos";

export type AlunoParaRequerimento = {
  matriculaId: string;
  alunoId: string;
  nome: string;
  /** Sem responsável financeiro o requerimento não pode ser assinado — a tela mostra o aluno como pendente. */
  temResponsavelFinanceiro: boolean;
};

export type FiltroRequerimento = {
  anoLetivo: number;
  serieId?: string;
  turmaId?: string;
  alunoId?: string;
};

/**
 * Só matrícula ativa — o requerimento é documento de quem está matriculando,
 * não de quem já saiu (diferente da declaração, que inclui cancelada/transferida).
 */
export async function listarAlunosParaRequerimento(filtro: FiltroRequerimento): Promise<AlunoParaRequerimento[]> {
  const supabase = await createServerClient();

  let query = supabase
    .from("matriculas")
    .select("id, aluno_id, alunos(nome, responsaveis_aluno(responsavel_financeiro))")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("ano_letivo", filtro.anoLetivo);

  if (filtro.serieId) query = query.eq("serie_id", filtro.serieId);
  if (filtro.turmaId) query = query.eq("turma_id", filtro.turmaId);
  if (filtro.alunoId) query = query.eq("aluno_id", filtro.alunoId);

  const { data, error } = await query.in("status", ["ativa"]);
  if (error) throw error;

  return (data ?? [])
    .map((row) => {
      const aluno = row.alunos as {
        nome?: string;
        responsaveis_aluno?: Array<{ responsavel_financeiro: boolean | null }>;
      } | null;
      if (!aluno?.nome) return null;
      return {
        matriculaId: row.id as string,
        alunoId: row.aluno_id as string,
        nome: aluno.nome,
        temResponsavelFinanceiro: (aluno.responsaveis_aluno ?? []).some((r) => r.responsavel_financeiro === true)
      };
    })
    .filter((a): a is AlunoParaRequerimento => a !== null)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export type PessoaResponsavel = {
  nome: string;
  rg: string | null;
  cpfOuCnpj: string | null;
  telefones: string | null;
  email: string | null;
  dataNascimento: string | null;
  estadoCivil: string | null;
  escolaridade: string | null;
  localTrabalho: string | null;
  profissao: string | null;
  telefoneTrabalho: string | null;
};

export type ResponsavelFinanceiro = {
  nome: string;
  cpfOuCnpj: string | null;
  parentesco: string | null;
};

export type DadosRequerimento = {
  aluno: {
    matricula: string | null;
    nome: string;
    sexo: string | null;
    dataNascimento: string | null;
    naturalidade: string | null;
    telefones: string | null;
    endereco: string | null;
    cpf: string | null;
    rg: string | null;
    etnia: string | null;
    religiao: string | null;
    /** URL assinada (1h) da foto — o cliente baixa para embutir no PDF. */
    fotoUrl: string | null;
  };
  pai: PessoaResponsavel | null;
  mae: PessoaResponsavel | null;
  matricula: {
    anoLetivo: number;
    serieId: string | null;
    serie: string;
    turma: string;
    turno: string;
    tipoEnsino: string;
    dataMatricula: string | null;
  };
  responsavelFinanceiro: ResponsavelFinanceiro | null;
};

type ResponsavelRow = {
  nome: string;
  rg: string | null;
  cpf: string | null;
  cnpj: string | null;
  telefone: string | null;
  celular: string | null;
  email: string | null;
  data_nascimento: string | null;
  estado_civil: string | null;
  escolaridade: string | null;
  endereco_trabalho: string | null;
  profissao: string | null;
  telefone_trabalho: string | null;
  parentesco: string | null;
  responsavel_financeiro: boolean | null;
};

function ehPai(parentesco: string | null): boolean {
  return ["pai", "padrasto"].includes((parentesco ?? "").trim().toLowerCase());
}

function ehMae(parentesco: string | null): boolean {
  return ["mae", "mãe", "madrasta"].includes((parentesco ?? "").trim().toLowerCase());
}

function montarPessoa(r: ResponsavelRow): PessoaResponsavel {
  return {
    nome: r.nome,
    rg: r.rg,
    cpfOuCnpj: r.cpf ?? r.cnpj,
    telefones: [r.celular, r.telefone].filter(Boolean).join(" "),
    email: r.email,
    dataNascimento: r.data_nascimento,
    estadoCivil: r.estado_civil,
    escolaridade: r.escolaridade,
    localTrabalho: r.endereco_trabalho,
    profissao: r.profissao,
    telefoneTrabalho: r.telefone_trabalho
  };
}

function montarEndereco(e: Record<string, unknown> | null): string | null {
  if (!e) return null;
  const partes = [
    e.logradouro,
    e.numero ? `nº ${e.numero}` : null,
    e.complemento,
    e.bairro,
    e.cidade && e.uf ? `${e.cidade}/${e.uf}` : e.cidade,
    e.cep
  ].filter((v) => typeof v === "string" && v);
  return partes.length ? partes.join(", ") : null;
}

/**
 * Responsável financeiro ausente vira `null`, nunca lança — quem decide se
 * isso bloqueia a emissão é o caller (preview/lote), não a leitura do dado.
 */
export async function buscarDadosRequerimento(matriculaId: string): Promise<DadosRequerimento> {
  const supabase = await createServerClient();

  const { data: matricula, error } = await supabase
    .from("matriculas")
    .select(
      "codigo, ano_letivo, serie_id, data_matricula, series(nome, segmentos(nome)), turmas(nome, turno), alunos(matricula_codigo, nome, foto_url, sexo, data_nascimento, naturalidade, celular, cpf, rg, etnia, religiao, enderecos_aluno(logradouro, numero, complemento, bairro, cidade, uf, cep, principal), responsaveis_aluno(nome, rg, cpf, cnpj, telefone, celular, email, data_nascimento, estado_civil, escolaridade, endereco_trabalho, profissao, telefone_trabalho, parentesco, responsavel_financeiro))"
    )
    .eq("id", matriculaId)
    .maybeSingle();

  if (error) throw error;
  if (!matricula) throw new Error(`Matrícula não encontrada: ${matriculaId}`);

  const aluno = matricula.alunos as {
    matricula_codigo?: string | null;
    nome?: string;
    foto_url?: string | null;
    sexo?: string | null;
    data_nascimento?: string | null;
    naturalidade?: string | null;
    celular?: string | null;
    cpf?: string | null;
    rg?: string | null;
    etnia?: string | null;
    religiao?: string | null;
    enderecos_aluno?: Array<{ principal?: boolean | null } & Record<string, unknown>>;
    responsaveis_aluno?: ResponsavelRow[];
  } | null;
  const serie = matricula.series as { nome?: string; segmentos?: { nome?: string } | { nome?: string }[] | null } | null;
  const turma = matricula.turmas as { nome?: string; turno?: string } | null;

  const enderecos = aluno?.enderecos_aluno ?? [];
  const enderecoPrincipal = enderecos.find((e) => e.principal === true) ?? enderecos[0] ?? null;

  const responsaveis = aluno?.responsaveis_aluno ?? [];
  const pai = responsaveis.find((r) => ehPai(r.parentesco)) ?? null;
  const mae = responsaveis.find((r) => ehMae(r.parentesco)) ?? null;

  const financeiros = responsaveis
    .filter((r) => r.responsavel_financeiro === true)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const responsavelFinanceiro = financeiros[0]
    ? { nome: financeiros[0].nome, cpfOuCnpj: financeiros[0].cpf ?? financeiros[0].cnpj, parentesco: financeiros[0].parentesco }
    : null;

  const segmentoObj = Array.isArray(serie?.segmentos) ? serie?.segmentos[0] ?? null : serie?.segmentos ?? null;

  return {
    aluno: {
      matricula: aluno?.matricula_codigo ?? null,
      nome: aluno?.nome ?? "",
      sexo: aluno?.sexo ?? null,
      dataNascimento: aluno?.data_nascimento ?? null,
      naturalidade: aluno?.naturalidade ?? null,
      telefones: aluno?.celular ?? null,
      endereco: montarEndereco(enderecoPrincipal),
      cpf: aluno?.cpf ?? null,
      rg: aluno?.rg ?? null,
      etnia: aluno?.etnia ?? null,
      religiao: aluno?.religiao ?? null,
      fotoUrl: await getSignedFotoUrl(aluno?.foto_url)
    },
    pai: pai ? montarPessoa(pai) : null,
    mae: mae ? montarPessoa(mae) : null,
    matricula: {
      anoLetivo: matricula.ano_letivo as number,
      serieId: (matricula.serie_id as string | null) ?? null,
      serie: serie?.nome ?? "",
      turma: turma?.nome ?? "",
      turno: turma?.turno ?? "",
      tipoEnsino: segmentoObj?.nome ?? "",
      dataMatricula: (matricula.data_matricula as string | null) ?? null
    },
    responsavelFinanceiro
  };
}
