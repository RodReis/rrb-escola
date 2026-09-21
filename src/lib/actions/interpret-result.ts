export type Outcome =
  | { kind: "value"; value: unknown }
  | { kind: "error"; error: unknown };

export type Instruction = {
  toast: "success" | "error" | "none";
  message: string;
  redirectTo?: string;
  refresh: boolean;
  /** Excecoes de controle do Next (redirect/notFound) precisam subir. */
  rethrow: boolean;
  /** `data` do ActionResult (contrato novo), quando presente. Deixa o
   * `onSuccess` do useAction ler um valor devolvido pela action (ex: a senha
   * gerada por resetPasswordAction) sem precisar de outro mecanismo. */
  data?: unknown;
};

const DEFAULT_SUCCESS = "Operação concluída.";
const DEFAULT_ERROR = "Não foi possível concluir a operação.";

/**
 * `redirect()` e `notFound()` do Next funcionam lançando uma exceção
 * cujo `digest` identifica a intenção. Capturar isso como falha é o
 * bug que faz uma exclusão bem-sucedida exibir "Falha ao excluir".
 */
function isNextControlFlowError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const digest = (error as { digest?: unknown }).digest;
  if (typeof digest !== "string") return false;
  return digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function firstString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  return null;
}

export function interpretActionResult(
  outcome: Outcome,
  opts: { success?: string; error?: string } = {}
): Instruction {
  const successMsg = opts.success ?? DEFAULT_SUCCESS;
  const errorMsg = opts.error ?? DEFAULT_ERROR;

  if (outcome.kind === "error") {
    if (isNextControlFlowError(outcome.error)) {
      return { toast: "none", message: "", refresh: false, rethrow: true };
    }
    const fromError =
      outcome.error instanceof Error ? outcome.error.message : null;
    return {
      toast: "error",
      message: firstString(fromError) ?? errorMsg,
      refresh: false,
      rethrow: false,
    };
  }

  const record = asRecord(outcome.value);

  // Contrato C: action retorna void apos revalidatePath.
  if (record === null) {
    return { toast: "success", message: successMsg, refresh: true, rethrow: false };
  }

  // `ok` (contrato novo e pipeline/whatsapp) ou `success` (anamnese-export,
  // documents-generate-v2). Ausencia dos dois = objeto de dados, tratado
  // como sucesso.
  const flag = record.ok ?? record.success;
  const failed = flag === false;

  if (failed) {
    // `error` no contrato novo; `reason` em sicoob/asaas/conciliacao.
    const message = firstString(record.error, record.reason) ?? errorMsg;
    return { toast: "error", message, refresh: false, rethrow: false };
  }

  const redirectTo = firstString(record.redirectTo) ?? undefined;
  return {
    toast: "success",
    message: firstString(record.message) ?? successMsg,
    redirectTo,
    // Sem navegacao, a tela precisa de refresh para refletir o revalidatePath.
    refresh: redirectTo === undefined,
    rethrow: false,
    data: record.data,
  };
}
