type SupabaseLike = {
  from: (table: string) => unknown;
};

type PlanQuery = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      single: () => Promise<{ data: Plan | null; error: unknown }>;
    };
  };
};

type InsertQuery = {
  insert: (rows: unknown) => Promise<{ error: unknown }>;
};

type Plan = {
  nome: string;
  valor_matricula: number | string;
  valor_mensalidade: number | string;
  quantidade_parcelas: number;
  dia_vencimento: number;
};

type GenerateChargesInput = {
  supabase: SupabaseLike;
  escolaId: string;
  alunoId: string;
  matriculaId: string;
  planoId: string | null;
  dataMatricula: string;
  anoLetivo: number;
};

// generateChargesForEnrollment: geração sob demanda. Filtra duplicatas (matricula_id + competencia + numero_parcela) para ser idempotente.

function lastDayOfMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function dueDate(year: number, monthIndex: number, day: number) {
  const safeDay = Math.min(Math.max(day, 1), lastDayOfMonth(year, monthIndex));
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
}

export async function generateChargesForEnrollment(input: GenerateChargesInput) {
  if (!input.planoId) return;

  const planQuery = input.supabase.from("planos") as PlanQuery;
  const { data: plan, error } = await planQuery
    .select("nome, valor_matricula, valor_mensalidade, quantidade_parcelas, dia_vencimento")
    .eq("id", input.planoId)
    .single();

  if (error || !plan) return;

  const rows = [];
  const registrationFee = Number(plan.valor_matricula ?? 0);
  const monthlyFee = Number(plan.valor_mensalidade ?? 0);
  const installments = Math.max(Number(plan.quantidade_parcelas ?? 0), 0);
  const dueDay = Number(plan.dia_vencimento ?? 10);

  if (registrationFee > 0) {
    rows.push({
      escola_id: input.escolaId,
      aluno_id: input.alunoId,
      matricula_id: input.matriculaId,
      plano_id: input.planoId,
      descricao: `Matricula ${input.anoLetivo}`,
      competencia: `${input.anoLetivo}-00`,
      numero_parcela: 0,
      valor_original: registrationFee,
      valor_desconto: 0,
      valor_acrescimo: 0,
      data_vencimento: input.dataMatricula,
      status: "aberta"
    });
  }

  for (let index = 0; index < installments; index += 1) {
    const monthIndex = index % 12;
    const year = input.anoLetivo + Math.floor(index / 12);
    rows.push({
      escola_id: input.escolaId,
      aluno_id: input.alunoId,
      matricula_id: input.matriculaId,
      plano_id: input.planoId,
      descricao: `Mensalidade ${String(monthIndex + 1).padStart(2, "0")}/${year} - ${plan.nome}`,
      competencia: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
      numero_parcela: index + 1,
      valor_original: monthlyFee,
      valor_desconto: 0,
      valor_acrescimo: 0,
      data_vencimento: dueDate(year, monthIndex, dueDay),
      status: "aberta"
    });
  }

  if (rows.length === 0) return;

  // Idempotência: filtra linhas que já existem para esta matrícula.
  type ExistingChargeQuery = {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        neq: (column: string, value: string) => Promise<{ data: Array<{ competencia: string; numero_parcela: number | null }> | null; error: unknown }>;
      };
    };
  };

  const existingQuery = input.supabase.from("cobrancas") as ExistingChargeQuery;
  const { data: existing } = await existingQuery
    .select("competencia, numero_parcela")
    .eq("matricula_id", input.matriculaId)
    .neq("status", "cancelada");

  const seen = new Set<string>(
    (existing ?? []).map((row) => `${row.competencia}#${row.numero_parcela ?? 0}`)
  );
  const filtered = rows.filter((row) => !seen.has(`${row.competencia}#${row.numero_parcela ?? 0}`));

  if (filtered.length === 0) return;

  const insertQuery = input.supabase.from("cobrancas") as InsertQuery;
  await insertQuery.insert(filtered);
}
