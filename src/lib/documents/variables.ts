import { createServerClient } from "@/lib/supabase/server";

export type DocumentVariables = {
  NOME_ALUNO: string;
  SERIE_ALUNO: string;
  TURNO_ALUNO: string;
  TIPOENSINO_ALUNO: string;
  ANO_LETIVO: string;
  // rg não existe em responsaveis_aluno — campos mantidos como string vazia para compatibilidade com templates
  RG_PAI_ALUNO: string;
  CPF_PAI_ALUNO: string;
  ENDERECO_PAI_ALUNO: string;
  RG_MAE_ALUNO: string;
  CPF_MAE_ALUNO: string;
  ENDERECO_MAE_ALUNO: string;
  ENDERECO_RESP: string;
  // escolas não tem razao_social/nome_fantasia — usa-se o campo `nome`
  RAZAO_SOCIAL_EMPRESA: string;
  FANTASIA_EMPRESA: string;
  CIDADE_DATA_EXTENSO: string;
};

function formatEndereco(
  e: {
    logradouro?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    uf?: string | null;
    cep?: string | null;
  } | null
): string {
  if (!e) return "";
  const parts = [
    e.logradouro,
    e.numero ? `nº ${e.numero}` : null,
    e.complemento,
    e.bairro,
    e.cidade && e.uf ? `${e.cidade}/${e.uf}` : e.cidade,
    e.cep,
  ].filter(Boolean);
  return parts.join(", ");
}

function formatDataExtenso(date: Date): string {
  const meses = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  return `Trindade, ${date.getDate()} de ${meses[date.getMonth()]} de ${date.getFullYear()}`;
}

export async function buildVariables(
  matriculaId: string
): Promise<DocumentVariables> {
  const supabase = await createServerClient();

  const { data: matricula, error: matError } = await supabase
    .from("matriculas")
    .select(
      `
      ano_letivo,
      escola_id,
      aluno_id,
      alunos(id, nome),
      series(nome, segmentos(nome)),
      turmas(turno)
    `
    )
    .eq("id", matriculaId)
    .single();

  if (matError || !matricula) throw new Error("Matrícula não encontrada");

  const alunoId = matricula.aluno_id as string;
  const escolaId = matricula.escola_id as string;

  const [responsaveisRes, enderecosRes, escolaRes] = await Promise.all([
    supabase
      .from("responsaveis_aluno")
      // schema: nome, cpf, parentesco (sem rg)
      .select("nome, cpf, parentesco, responsavel_financeiro")
      .eq("aluno_id", alunoId),
    supabase
      .from("enderecos_aluno")
      .select("logradouro, numero, complemento, bairro, cidade, uf, cep, principal")
      .eq("aluno_id", alunoId)
      .limit(5),
    supabase
      .from("escolas")
      // schema: somente `nome` — sem razao_social / nome_fantasia
      .select("nome")
      .eq("id", escolaId)
      .single(),
  ]);

  // responsáveis por parentesco (case-insensitive)
  const responsaveis = responsaveisRes.data ?? [];

  const pai = responsaveis.find(
    (r) => ["pai", "padrasto"].includes((r.parentesco ?? "").toLowerCase())
  ) ?? null;

  const mae = responsaveis.find(
    (r) => ["mae", "mãe", "madrasta"].includes((r.parentesco ?? "").toLowerCase())
  ) ?? null;

  const respFinanceiro = responsaveis.find((r) => r.responsavel_financeiro) ?? null;

  // endereço: prefere o marcado como principal, senão o primeiro
  const enderecos = enderecosRes.data ?? [];
  const endPrincipal = enderecos.find((e) => e.principal) ?? enderecos[0] ?? null;

  const escola = escolaRes.data;

  // série e tipo de ensino
  // Supabase retorna array para relações, pegamos o primeiro elemento
  const seriesRaw = (matricula.series as unknown) as
    | { nome: string | null; segmentos: { nome: string | null } | null }[]
    | { nome: string | null; segmentos: { nome: string | null } | null }
    | null;
  const seriesObj = Array.isArray(seriesRaw) ? seriesRaw[0] ?? null : seriesRaw;
  const serieNome = seriesObj?.nome ?? "";
  const segmentosRaw = seriesObj?.segmentos;
  const segmentosObj = Array.isArray(segmentosRaw)
    ? (segmentosRaw[0] ?? null)
    : segmentosRaw ?? null;
  const tipoEnsino = segmentosObj?.nome ?? "";

  // turno
  const turmasRaw = (matricula.turmas as unknown) as
    | { turno: string | null }[]
    | { turno: string | null }
    | null;
  const turmasObj = Array.isArray(turmasRaw) ? turmasRaw[0] ?? null : turmasRaw;
  const turno = turmasObj?.turno ?? "";

  // aluno
  const alunosRaw = (matricula.alunos as unknown) as
    | { nome: string | null }[]
    | { nome: string | null }
    | null;
  const alunosObj = Array.isArray(alunosRaw) ? alunosRaw[0] ?? null : alunosRaw;
  const nomeAluno = alunosObj?.nome ?? "";

  return {
    NOME_ALUNO: nomeAluno,
    SERIE_ALUNO: serieNome,
    TURNO_ALUNO: turno,
    TIPOENSINO_ALUNO: tipoEnsino,
    ANO_LETIVO: String(matricula.ano_letivo ?? ""),

    // rg não existe na tabela responsaveis_aluno — retorna string vazia
    RG_PAI_ALUNO: "",
    CPF_PAI_ALUNO: pai?.cpf ?? "",
    ENDERECO_PAI_ALUNO: "",

    RG_MAE_ALUNO: "",
    CPF_MAE_ALUNO: mae?.cpf ?? "",
    ENDERECO_MAE_ALUNO: "",

    ENDERECO_RESP: formatEndereco(endPrincipal),

    // escolas.nome serve tanto para razao_social quanto fantasia
    RAZAO_SOCIAL_EMPRESA: escola?.nome ?? "",
    FANTASIA_EMPRESA: escola?.nome ?? "",

    CIDADE_DATA_EXTENSO: formatDataExtenso(new Date()),
  };
}
