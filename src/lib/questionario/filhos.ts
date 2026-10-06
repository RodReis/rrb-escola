import { assertOk } from "@/lib/actions/assert-ok";
import type { createServerClient } from "@/lib/supabase/server";

type Cliente = Awaited<ReturnType<typeof createServerClient>>;

const FK = { escala_opcoes: "escala_id", questao_alternativas: "questao_id" } as const;

/**
 * Troca os itens filhos de um pai. Insere os novos ANTES de apagar os antigos:
 * se o insert falhar, o pai continua com os itens que tinha (sem ficar vazio).
 */
export async function substituirFilhos(
  db: Cliente,
  tabela: keyof typeof FK,
  paiId: string,
  rotulos: string[],
): Promise<void> {
  const fk = FK[tabela];
  const antigos = assertOk(
    await db.from(tabela).select("id").eq(fk, paiId),
    "Não foi possível ler os itens atuais",
  ) as Array<{ id: string }> | null;

  if (rotulos.length > 0) {
    assertOk(
      await db.from(tabela).insert(rotulos.map((rotulo, i) => ({ [fk]: paiId, rotulo, ordem: i + 1 }))),
      "Não foi possível salvar os itens",
    );
  }

  const ids = (antigos ?? []).map((r) => r.id);
  if (ids.length > 0) {
    assertOk(await db.from(tabela).delete().in("id", ids), "Não foi possível limpar os itens antigos");
  }
}
