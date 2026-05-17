"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { createServerClient } from "@/lib/supabase/server";
import { formNumber, formText } from "@/lib/utils";
import { despesaSchema, FORMAS_PAGAMENTO } from "@/lib/validation/despesas";

function competenciaFromDate(d: string) {
  return d.slice(0, 7);
}

export async function createDespesaAction(formData: FormData) {
  const session = await requireSession();
  const parsed = despesaSchema.safeParse({
    descricao: formText(formData, "descricao"),
    categoria_id: formText(formData, "categoria_id"),
    fornecedor: formText(formData, "fornecedor"),
    valor: formNumber(formData, "valor"),
    data_vencimento: formText(formData, "data_vencimento"),
    data_pagamento: formText(formData, "data_pagamento"),
    forma_pagamento: formText(formData, "forma_pagamento")
  });
  if (!parsed.success) {
    redirect(`/despesas/nova?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "validacao")}`);
  }

  const supabase = await createServerClient();
  const status = parsed.data.data_pagamento ? "paga" : "aberta";
  const { data, error } = await supabase
    .from("despesas")
    .insert({
      ...parsed.data,
      competencia: competenciaFromDate(parsed.data.data_vencimento),
      status,
      escola_id: DEFAULT_SCHOOL_ID,
      criado_por: session.profile.id
    })
    .select("id, competencia")
    .single();
  if (error) redirect(`/despesas/nova?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/despesas");
  redirect(`/despesas?mes=${data.competencia}`);
}

export async function updateDespesaAction(formData: FormData) {
  await requireSession();
  const id = formText(formData, "id");
  if (!id) redirect("/despesas?erro=id");

  const parsed = despesaSchema.safeParse({
    descricao: formText(formData, "descricao"),
    categoria_id: formText(formData, "categoria_id"),
    fornecedor: formText(formData, "fornecedor"),
    valor: formNumber(formData, "valor"),
    data_vencimento: formText(formData, "data_vencimento"),
    data_pagamento: formText(formData, "data_pagamento"),
    forma_pagamento: formText(formData, "forma_pagamento")
  });
  if (!parsed.success) {
    redirect(`/despesas/${id}/editar?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "validacao")}`);
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("despesas")
    .update({
      ...parsed.data,
      competencia: competenciaFromDate(parsed.data.data_vencimento)
    })
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  if (error) redirect(`/despesas/${id}/editar?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/despesas");
  redirect(`/despesas?mes=${competenciaFromDate(parsed.data.data_vencimento)}`);
}

export async function payDespesaAction(formData: FormData) {
  await requireSession();
  const id = formText(formData, "id");
  const data_pagamento = formText(formData, "data_pagamento") ?? new Date().toISOString().slice(0, 10);
  const forma_pagamento = formText(formData, "forma_pagamento");
  if (!id) redirect("/despesas?erro=id");
  if (forma_pagamento && !FORMAS_PAGAMENTO.includes(forma_pagamento as any)) {
    redirect("/despesas?erro=forma_invalida");
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("despesas")
    .update({ status: "paga", data_pagamento, forma_pagamento })
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  if (error) redirect(`/despesas?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/despesas");
}

export async function cancelDespesaAction(formData: FormData) {
  await requireSession();
  const id = formText(formData, "id");
  if (!id) redirect("/despesas?erro=id");

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("despesas")
    .update({ status: "cancelada" })
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  if (error) redirect(`/despesas?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/despesas");
}
