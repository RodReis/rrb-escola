"use server";

import { revalidatePath } from "next/cache";
import { assertOk } from "@/lib/actions/assert-ok";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { alternarAtivo } from "@/lib/questionario/ativo";
import { substituirFilhos } from "@/lib/questionario/filhos";
import { lerLista, lerTexto } from "@/lib/questionario/lista";
import { primeiroErro, type ActionResult } from "@/lib/questionario/tipos";
import { EscalaSchema, IdSchema } from "@/lib/validation/questionario";

const ROTA = "/questionario/escalas";

function lerEscala(formData: FormData) {
  return EscalaSchema.safeParse({
    descricao: lerTexto(formData, "descricao"),
    opcoes: lerLista(formData, "opcoes"),
  });
}

export async function criarEscalaAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.escala", "create");
  const parsed = lerEscala(formData);
  if (!parsed.success) return { ok: false, error: primeiroErro(parsed.error) };

  const db = await createServerClient();
  const nova = assertOk(
    await db
      .from("escalas")
      .insert({ escola_id: session.profile.escola_id, descricao: parsed.data.descricao })
      .select("id")
      .single(),
    "Não foi possível cadastrar a escala",
  ) as { id: string };

  try {
    await substituirFilhos(db, "escala_opcoes", nova.id, parsed.data.opcoes);
  } catch (erro) {
    await db.from("escalas").delete().eq("id", nova.id);
    throw erro;
  }

  revalidatePath(ROTA);
  return { ok: true, message: "Escala cadastrada." };
}

export async function atualizarEscalaAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.escala", "update");
  const id = IdSchema.safeParse(lerTexto(formData, "id"));
  if (!id.success) return { ok: false, error: primeiroErro(id.error) };
  const parsed = lerEscala(formData);
  if (!parsed.success) return { ok: false, error: primeiroErro(parsed.error) };

  const db = await createServerClient();
  assertOk(
    await db
      .from("escalas")
      .update({ descricao: parsed.data.descricao })
      .eq("id", id.data)
      .eq("escola_id", session.profile.escola_id),
    "Não foi possível salvar a escala",
  );
  await substituirFilhos(db, "escala_opcoes", id.data, parsed.data.opcoes);

  revalidatePath(ROTA);
  return { ok: true, message: "Escala atualizada." };
}

export async function alternarAtivoEscalaAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.escala", "update");
  const resultado = await alternarAtivo(formData, "escalas", session.profile.escola_id);
  if (resultado.ok) revalidatePath(ROTA);
  return resultado;
}
