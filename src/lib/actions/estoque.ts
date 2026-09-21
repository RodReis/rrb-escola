"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { createServerClient } from "@/lib/supabase/server";
import { formNumber, formText } from "@/lib/utils";
import { movimentoSchema } from "@/lib/validation/estoque";

const BASE = "/comercial/estoque";

// Entrada de estoque (reposição/compra). sentido forçado +1 no banco.
export async function registrarEntradaAction(formData: FormData) {
  const session = await requirePermission("comercial.estoque", "create");
  const parsed = movimentoSchema.safeParse({
    variacao_id: formText(formData, "variacao_id"),
    tipo: "entrada",
    quantidade: formNumber(formData, "quantidade"),
    sentido: 1,
    custo_unit: formNumber(formData, "custo_unit") || null,
    data: formText(formData, "data"),
    observacao: formText(formData, "observacao")
  });
  if (!parsed.success) {
    redirect(`${BASE}?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "validacao")}`);
  }

  const supabase = await createServerClient();
  const { error } = await supabase.from("movimento_estoque").insert({
    ...parsed.data,
    escola_id: DEFAULT_SCHOOL_ID,
    criado_por: session.profile.id
  });
  if (error) redirect(`${BASE}?erro=${encodeURIComponent(error.message)}`);

  revalidatePath(BASE);
  redirect(`${BASE}?ok=entrada`);
}

// Ajuste de contagem física (±). sentido escolhido pelo operador.
// Saldo negativo é bloqueado pelo trigger (mensagem volta como erro).
export async function registrarAjusteAction(formData: FormData) {
  const session = await requirePermission("comercial.estoque", "create");
  const sentidoRaw = formText(formData, "sentido");
  const sentido = sentidoRaw === "-1" ? -1 : 1;

  const parsed = movimentoSchema.safeParse({
    variacao_id: formText(formData, "variacao_id"),
    tipo: "ajuste",
    quantidade: formNumber(formData, "quantidade"),
    sentido,
    data: formText(formData, "data"),
    observacao: formText(formData, "observacao")
  });
  if (!parsed.success) {
    redirect(`${BASE}?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "validacao")}`);
  }

  const supabase = await createServerClient();
  const { error } = await supabase.from("movimento_estoque").insert({
    ...parsed.data,
    escola_id: DEFAULT_SCHOOL_ID,
    criado_por: session.profile.id
  });
  if (error) redirect(`${BASE}?erro=${encodeURIComponent(error.message)}`);

  revalidatePath(BASE);
  redirect(`${BASE}?ok=ajuste`);
}
