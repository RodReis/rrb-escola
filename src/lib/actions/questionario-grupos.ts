"use server";

import { revalidatePath } from "next/cache";
import { assertOk } from "@/lib/actions/assert-ok";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { alternarAtivo } from "@/lib/questionario/ativo";
import { lerTexto } from "@/lib/questionario/lista";
import { primeiroErro, type ActionResult } from "@/lib/questionario/tipos";
import { GrupoSchema, IdSchema } from "@/lib/validation/questionario";

const ROTA = "/questionario/grupos";

export async function criarGrupoAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.grupo", "create");
  const parsed = GrupoSchema.safeParse({ descricao: lerTexto(formData, "descricao") });
  if (!parsed.success) return { ok: false, error: primeiroErro(parsed.error) };

  const db = await createServerClient();
  assertOk(
    await db.from("questao_grupos").insert({
      escola_id: session.profile.escola_id,
      descricao: parsed.data.descricao,
    }),
    "Não foi possível cadastrar o grupo",
  );
  revalidatePath(ROTA);
  return { ok: true, message: "Grupo cadastrado." };
}

export async function atualizarGrupoAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.grupo", "update");
  const id = IdSchema.safeParse(lerTexto(formData, "id"));
  if (!id.success) return { ok: false, error: primeiroErro(id.error) };
  const parsed = GrupoSchema.safeParse({ descricao: lerTexto(formData, "descricao") });
  if (!parsed.success) return { ok: false, error: primeiroErro(parsed.error) };

  const db = await createServerClient();
  assertOk(
    await db
      .from("questao_grupos")
      .update({ descricao: parsed.data.descricao })
      .eq("id", id.data)
      .eq("escola_id", session.profile.escola_id),
    "Não foi possível salvar o grupo",
  );
  revalidatePath(ROTA);
  return { ok: true, message: "Grupo atualizado." };
}

export async function alternarAtivoGrupoAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.grupo", "update");
  const resultado = await alternarAtivo(formData, "questao_grupos", session.profile.escola_id);
  if (resultado.ok) revalidatePath(ROTA);
  return resultado;
}
