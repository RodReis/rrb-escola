"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { assertOk } from "@/lib/actions/assert-ok";
import { formNumber, formText } from "@/lib/utils";
import { lancarValorSchema, recorrenteSchema } from "@/lib/validation/recorrentes";
import { carregarRecorrentes, gerarRecorrentes } from "@/lib/previsto/gerar-recorrentes";
import { dataDeVencimento } from "@/lib/previsto/recorrencia";

const BASE = "/financeiro/lancamentos/recorrentes";

export async function createRecorrenteAction(formData: FormData) {
  const session = await requirePermission("financeiro.lancamentos", "create");
  const valor = formNumber(formData, "valor_referencia");
  const parsed = recorrenteSchema.safeParse({
    descricao: formText(formData, "descricao"),
    categoria_id: formText(formData, "categoria_id"),
    company_id: formText(formData, "company_id"),
    contraparte: formText(formData, "contraparte") || null,
    // campo vazio/0 = valor varia todo mês (água, luz)
    valor_referencia: valor && valor > 0 ? valor : null,
    dia_vencimento: Number(formText(formData, "dia_vencimento")),
    classe_despesa: formText(formData, "classe_despesa") || null,
    inicio_competencia: formText(formData, "inicio_competencia"),
  });
  if (!parsed.success) {
    redirect(`${BASE}?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "validacao")}`);
  }

  const supabase = await createServerClient();
  assertOk(
    await supabase.from("despesa_recorrente").insert({
      ...parsed.data,
      escola_id: DEFAULT_SCHOOL_ID,
      criado_por: session.profile.id,
    }),
    "Não foi possível criar a recorrência",
  );
  revalidatePath(BASE);
  redirect(BASE);
}

/** Encerra a recorrência: não gera mais títulos; os já criados ficam. */
export async function encerrarRecorrenteAction(formData: FormData) {
  await requirePermission("financeiro.lancamentos", "update");
  const id = formText(formData, "id");
  if (!id) redirect(`${BASE}?erro=id`);

  const supabase = await createServerClient();
  assertOk(
    await supabase.from("despesa_recorrente").update({ ativo: false }).eq("id", id).eq("escola_id", DEFAULT_SCHOOL_ID),
    "Não foi possível encerrar a recorrência",
  );
  revalidatePath(BASE);
}

export async function gerarMesAction(formData: FormData) {
  await requirePermission("financeiro.lancamentos", "create");
  const competencia = formText(formData, "competencia");
  if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) redirect(`${BASE}?erro=competencia`);

  await gerarRecorrentes(createAdminClient(), competencia, DEFAULT_SCHOOL_ID);
  revalidatePath(BASE);
  revalidatePath("/financeiro/lancamentos");
}

/** Título de recorrente de valor variável: nasce quando a conta chega, com o valor real. */
export async function lancarValorRecorrenteAction(formData: FormData) {
  const session = await requirePermission("financeiro.lancamentos", "create");
  const parsed = lancarValorSchema.safeParse({
    recorrente_id: formText(formData, "recorrente_id"),
    competencia: formText(formData, "competencia"),
    valor: formNumber(formData, "valor"),
  });
  if (!parsed.success) {
    redirect(`${BASE}?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "validacao")}`);
  }

  const recorrentes = await carregarRecorrentes(createAdminClient(), DEFAULT_SCHOOL_ID);
  const r = recorrentes.find((x) => x.id === parsed.data.recorrente_id);
  if (!r) redirect(`${BASE}?erro=recorrente`);

  const supabase = await createServerClient();
  assertOk(
    await supabase.from("lancamento_financeiro").insert({
      escola_id: r.escolaId,
      tipo: "despesa",
      competencia: parsed.data.competencia,
      descricao: r.descricao,
      categoria_id: r.categoriaId,
      company_id: r.companyId,
      classe_despesa: r.classeDespesa,
      contraparte: r.contraparte,
      valor: parsed.data.valor,
      data_vencimento: dataDeVencimento(parsed.data.competencia, r.diaVencimento),
      status: "aberta",
      origem_tipo: "manual",
      recorrente_id: r.id,
      criado_por: session.profile.id,
    }),
    "Não foi possível lançar o valor (o título deste mês já existe?)",
  );
  revalidatePath(BASE);
}
