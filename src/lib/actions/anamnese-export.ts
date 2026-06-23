"use server";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateDocxFromBuffer } from "@/lib/documents/generator-v2";
import {
  formatAnamneseParaDocx,
  nomeArquivoAnamnese,
  type DadosIdentificacao,
} from "@/lib/documents/anamnese-docx";
import type { Anamnese } from "@/lib/actions/pipeline-anamnese";

const TEMPLATE_PATH = join(
  process.cwd(),
  "src/lib/documents/templates/anamnese-fund1.docx",
);

export type ExportarAnamneseResult =
  | { success: true; base64: string; nomeArquivo: string }
  | { success: false; error: string };

type Ref = { cardId?: string; alunoId?: string };

export async function exportarAnamneseDocxAction(
  ref: Ref,
): Promise<ExportarAnamneseResult> {
  let session: Awaited<ReturnType<typeof requirePermission>>;
  try {
    session = await requirePermission("pipeline_sensivel", "read");
  } catch {
    return { success: false, error: "Sem permissão para exportar dados sensíveis" };
  }

  if (!ref.cardId && !ref.alunoId) {
    return { success: false, error: "Referência inválida (cardId ou alunoId)" };
  }

  const supabase = await createServerClient();
  const escolaId = session.profile.escola_id;

  // 1) Carrega a anamnese (por card ou por aluno)
  const query = supabase
    .from("pipeline_anamnese")
    .select("*")
    .eq("escola_id", escolaId);
  const { data: anamnese } = ref.cardId
    ? await query.eq("card_id", ref.cardId).maybeSingle()
    : await query.eq("aluno_id", ref.alunoId!).maybeSingle();

  if (!anamnese) {
    return { success: false, error: "Anamnese não encontrada" };
  }

  // 2) Dados de identificação (caminho card → lead; caminho aluno → alunos)
  const [ident, { data: escola }] = await Promise.all([
    ref.cardId
      ? identViaCard(supabase, ref.cardId, escolaId)
      : identViaAluno(supabase, ref.alunoId!, escolaId),
    supabase.from("escolas").select("nome").eq("id", escolaId).maybeSingle(),
  ]);

  // 3) Monta variáveis e gera o DOCX
  const variables = formatAnamneseParaDocx(anamnese as Anamnese, ident, escola?.nome ?? null);

  let buffer: Buffer;
  try {
    const template = await readFile(TEMPLATE_PATH);
    const res = generateDocxFromBuffer(template, variables);
    buffer = res.buffer;
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Falha ao gerar documento",
    };
  }

  // 4) Log de acesso (usa card_id da própria anamnese)
  const cardId = (anamnese as Anamnese).card_id;
  if (cardId) {
    const admin = createAdminClient();
    void admin.rpc("pipeline_gravar_acesso_log", {
      p_escola_id: escolaId,
      p_usuario_id: session.profile.id,
      p_card_id: cardId,
      p_recurso: "anamnese",
      p_acao: "read",
    });
  }

  return {
    success: true,
    base64: buffer.toString("base64"),
    nomeArquivo: nomeArquivoAnamnese(ident.nome),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function identViaCard(
  supabase: any,
  cardId: string,
  escolaId: string,
): Promise<DadosIdentificacao> {
  const [{ data: lead }, { data: responsaveis }, { data: reserva }] = await Promise.all([
    supabase
      .from("pipeline_lead")
      .select("nome, data_nascimento, serie_interesse")
      .eq("card_id", cardId)
      .eq("escola_id", escolaId)
      .maybeSingle(),
    supabase
      .from("pipeline_lead_responsavel")
      .select("nome")
      .eq("card_id", cardId)
      .eq("escola_id", escolaId),
    supabase
      .from("pipeline_reserva")
      .select("serie_id, turma_id")
      .eq("card_id", cardId)
      .eq("escola_id", escolaId)
      .maybeSingle(),
  ]);

  // Resolve nomes de série/turma quando há reserva
  let serie: string | null = lead?.serie_interesse ?? null;
  let turma: string | null = null;
  if (reserva?.serie_id) {
    const { data: s } = await supabase
      .from("series")
      .select("nome")
      .eq("id", reserva.serie_id)
      .maybeSingle();
    serie = s?.nome ?? serie;
  }
  if (reserva?.turma_id) {
    const { data: t } = await supabase
      .from("turmas")
      .select("nome")
      .eq("id", reserva.turma_id)
      .maybeSingle();
    turma = t?.nome ?? null;
  }

  return {
    nome: lead?.nome ?? null,
    nascimento: lead?.data_nascimento ?? null,
    serie,
    turma,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    responsaveis: (responsaveis ?? []).map((r: any) => r.nome).filter(Boolean),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function identViaAluno(
  supabase: any,
  alunoId: string,
  escolaId: string,
): Promise<DadosIdentificacao> {
  const [{ data: aluno }, { data: responsaveis }, { data: matricula }] = await Promise.all([
    supabase
      .from("alunos")
      .select("nome, data_nascimento")
      .eq("id", alunoId)
      .eq("escola_id", escolaId)
      .maybeSingle(),
    supabase
      .from("responsaveis_aluno")
      .select("nome")
      .eq("aluno_id", alunoId),
    supabase
      .from("matriculas")
      .select("serie_id, turma_id")
      .eq("aluno_id", alunoId)
      .eq("escola_id", escolaId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  let serie: string | null = null;
  let turma: string | null = null;
  if (matricula?.serie_id) {
    const { data: s } = await supabase
      .from("series")
      .select("nome")
      .eq("id", matricula.serie_id)
      .maybeSingle();
    serie = s?.nome ?? null;
  }
  if (matricula?.turma_id) {
    const { data: t } = await supabase
      .from("turmas")
      .select("nome")
      .eq("id", matricula.turma_id)
      .maybeSingle();
    turma = t?.nome ?? null;
  }

  return {
    nome: aluno?.nome ?? null,
    nascimento: aluno?.data_nascimento ?? null,
    serie,
    turma,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    responsaveis: (responsaveis ?? []).map((r: any) => r.nome).filter(Boolean),
  };
}
