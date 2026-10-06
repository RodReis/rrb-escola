import { assertOk } from "@/lib/actions/assert-ok";
import { createServerClient } from "@/lib/supabase/server";
import { IdSchema } from "@/lib/validation/questionario";
import { lerTexto } from "./lista";
import { primeiroErro, type ActionResult } from "./tipos";

type Tabela = "questao_grupos" | "escalas" | "questoes" | "questionarios";

/** Ativar/inativar: nunca apaga. Campos do form: `id`, `ativo` ("true" | "false"). */
export async function alternarAtivo(formData: FormData, tabela: Tabela, escolaId: string): Promise<ActionResult> {
  const id = IdSchema.safeParse(lerTexto(formData, "id"));
  if (!id.success) return { ok: false, error: primeiroErro(id.error) };

  const coluna = tabela === "questoes" ? "ativa" : "ativo";
  const db = await createServerClient();
  assertOk(
    await db
      .from(tabela)
      .update({ [coluna]: formData.get("ativo") === "true" })
      .eq("id", id.data)
      .eq("escola_id", escolaId),
    "Não foi possível alterar a situação",
  );
  return { ok: true, message: "Situação atualizada." };
}
