"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { formText } from "@/lib/utils";

export async function updateEscolaAction(formData: FormData) {
  const session = await requireAdmin();
  const supabase = await createServerClient();

  await supabase
    .from("escolas")
    .update({
      nome: formText(formData, "nome") ?? "",
      cnpj: formText(formData, "cnpj"),
      telefone: formText(formData, "telefone"),
      email: formText(formData, "email"),
      endereco: formText(formData, "endereco"),
      cidade: formText(formData, "cidade"),
      uf: formText(formData, "uf"),
      cep: formText(formData, "cep"),
      logo_url: formText(formData, "logo_url"),
    })
    .eq("id", session.profile.escola_id);

  revalidatePath("/configuracoes/escola");
}
