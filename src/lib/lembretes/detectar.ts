import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

export type LembretePendente = {
  cobrancaId: string;
  alunoId: string;
  alunoNome: string;
  responsavelNome: string;
  telefone: string;
  descricao: string;
  valor: number;
  vencimento: string;
  diasAtraso: number;
};

const STATUS_EM_ABERTO = new Set(["aberta", "parcial", "vencida"]);

type ResponsavelRow = {
  nome: string | null;
  celular: string | null;
  responsavel_financeiro: boolean | null;
};

type CobrancaRow = {
  id: string;
  descricao: string;
  valor_final: number | string | null;
  data_vencimento: string;
  status: string;
  aluno_id: string;
  alunos: {
    nome: string | null;
    responsaveis_aluno: ResponsavelRow[];
  } | null;
};

function diffDias(de: string, ate: string): number {
  const [ay, am, ad] = de.split("-").map(Number);
  const [by, bm, bd] = ate.split("-").map(Number);
  const a = Date.UTC(ay, am - 1, ad);
  const b = Date.UTC(by, bm - 1, bd);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

// Parte pura: aplica as regras de elegibilidade.
// jaEnviados: ids de cobranças que já têm lembrete (exclui no modo automático;
// passar Set vazio no modo forçar reenvio).
export function filtrarElegiveis(
  cobrancas: CobrancaRow[],
  hoje: string,
  jaEnviados: Set<string>,
): LembretePendente[] {
  const resultado: LembretePendente[] = [];
  for (const c of cobrancas) {
    if (c.data_vencimento >= hoje) continue; // não vencida
    if (!STATUS_EM_ABERTO.has(c.status)) continue; // paga/cancelada
    if (jaEnviados.has(c.id)) continue; // já avisada

    const responsavel = (c.alunos?.responsaveis_aluno ?? []).find(
      (r) => r.responsavel_financeiro === true && !!r.celular,
    );
    if (!responsavel?.celular) continue;

    resultado.push({
      cobrancaId: c.id,
      alunoId: c.aluno_id,
      alunoNome: c.alunos?.nome ?? "Aluno",
      responsavelNome: responsavel.nome ?? "Responsável",
      telefone: responsavel.celular,
      descricao: c.descricao,
      valor: Number(c.valor_final ?? 0),
      vencimento: c.data_vencimento,
      diasAtraso: diffDias(c.data_vencimento, hoje),
    });
  }
  return resultado;
}

type SupabaseLike = {
  from: (table: string) => any;
};

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Parte com I/O: busca cobranças vencidas em aberto + responsável financeiro,
// e (se ignorarJaEnviados) descobre quais já têm lembrete.
export async function resolverLembretesPendentes(
  supabase: SupabaseLike,
  escolaId: string = DEFAULT_SCHOOL_ID,
  ignorarJaEnviados: boolean = true,
): Promise<LembretePendente[]> {
  const hoje = hojeISO();

  const { data: cobrancas } = await supabase
    .from("cobrancas")
    .select(
      "id, descricao, valor_final, data_vencimento, status, aluno_id, alunos(nome, responsaveis_aluno(nome, celular, responsavel_financeiro))",
    )
    .eq("escola_id", escolaId)
    .lt("data_vencimento", hoje)
    .in("status", ["aberta", "parcial", "vencida"]);

  const lista = (cobrancas ?? []) as CobrancaRow[];

  let jaEnviados = new Set<string>();
  if (ignorarJaEnviados && lista.length > 0) {
    const { data: enviados } = await supabase
      .from("mensagens_whatsapp")
      .select("referencia_id")
      .eq("escola_id", escolaId)
      .eq("referencia_tipo", "lembrete_cobranca")
      .in("referencia_id", lista.map((c) => c.id));
    jaEnviados = new Set((enviados ?? []).map((m: { referencia_id: string }) => m.referencia_id));
  }

  return filtrarElegiveis(lista, hoje, jaEnviados);
}
