"use server";

import { revalidatePath } from "next/cache";
import { assertOk } from "@/lib/actions/assert-ok";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { alternarAtivo } from "@/lib/questionario/ativo";
import { lerTexto } from "@/lib/questionario/lista";
import { primeiroErro, type ActionResult } from "@/lib/questionario/tipos";
import { formBoolean } from "@/lib/utils";
import { IdSchema, SecaoSchema } from "@/lib/validation/questionario";

const ROTA = "/questionario/secoes";

function lerSecao(formData: FormData) {
  return SecaoSchema.safeParse({
    descricao: lerTexto(formData, "descricao"),
    permiteLancamentoColetivo: formBoolean(formData, "permiteLancamentoColetivo"),
  });
}

export async function criarSecaoAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.secao", "create");
  const parsed = lerSecao(formData);
  if (!parsed.success) return { ok: false, error: primeiroErro(parsed.error) };

  const db = await createServerClient();
  assertOk(
    await db.from("ficha_secoes").insert({
      escola_id: session.profile.escola_id,
      descricao: parsed.data.descricao,
      permite_lancamento_coletivo: parsed.data.permiteLancamentoColetivo,
    }),
    "Não foi possível cadastrar a seção",
  );
  revalidatePath(ROTA);
  return { ok: true, message: "Seção cadastrada." };
}

export async function atualizarSecaoAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.secao", "update");
  const id = IdSchema.safeParse(lerTexto(formData, "id"));
  if (!id.success) return { ok: false, error: primeiroErro(id.error) };
  const parsed = lerSecao(formData);
  if (!parsed.success) return { ok: false, error: primeiroErro(parsed.error) };

  const db = await createServerClient();
  assertOk(
    await db
      .from("ficha_secoes")
      .update({
        descricao: parsed.data.descricao,
        permite_lancamento_coletivo: parsed.data.permiteLancamentoColetivo,
      })
      .eq("id", id.data)
      .eq("escola_id", session.profile.escola_id),
    "Não foi possível salvar a seção",
  );
  revalidatePath(ROTA);
  return { ok: true, message: "Seção atualizada." };
}

export async function alternarAtivoSecaoAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.secao", "update");
  const resultado = await alternarAtivo(formData, "ficha_secoes", session.profile.escola_id);
  if (resultado.ok) revalidatePath(ROTA);
  return resultado;
}
