"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { assertOk } from "@/lib/actions/assert-ok";

export async function salvarContaBancariaAction(formData: FormData) {
  const session = await requirePermission("financeiro.tesouraria", "create");
  const supabase = await createServerClient();

  assertOk(await supabase.from("contas_bancarias").insert({
    escola_id: session.profile.escola_id,
    apelido: String(formData.get("apelido") ?? "Conta Sicoob"),
    banco: "756",
    cooperativa: String(formData.get("cooperativa") ?? ""),
    agencia: String(formData.get("agencia") ?? ""),
    conta: String(formData.get("conta") ?? ""),
    chave_pix: String(formData.get("chave_pix") ?? ""),
    provedor: "sicoob",
    ativo: true,
  }), "Não foi possível salvar a conta bancária");

  revalidatePath("/financeiro/tesouraria");
}

export async function alternarContaBancariaAction(formData: FormData) {
  const session = await requirePermission("financeiro.tesouraria", "update");
  const supabase = await createServerClient();
  const id = String(formData.get("id") ?? "");
  const ativo = String(formData.get("ativo") ?? "") === "true";

  await supabase
    .from("contas_bancarias")
    .update({ ativo: !ativo })
    .eq("id", id)
    .eq("escola_id", session.profile.escola_id);
  revalidatePath("/financeiro/tesouraria");
}
