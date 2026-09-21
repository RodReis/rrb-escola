import { describe, expect, it } from "vitest";
import { interpretActionResult } from "./interpret-result";

const opts = { success: "Salvo.", error: "Falhou." };

function value(v: unknown) {
  return { kind: "value" as const, value: v };
}
function thrown(e: unknown) {
  return { kind: "error" as const, error: e };
}

describe("interpretActionResult", () => {
  it("trata retorno {ok:true} como sucesso com a mensagem padrao", () => {
    const r = interpretActionResult(value({ ok: true, data: undefined }), opts);
    expect(r.toast).toBe("success");
    expect(r.message).toBe("Salvo.");
    expect(r.rethrow).toBe(false);
  });

  it("usa a mensagem da action quando ela vem em message", () => {
    const r = interpretActionResult(
      value({ ok: true, data: undefined, message: "12 rematriculados." }),
      opts
    );
    expect(r.toast).toBe("success");
    expect(r.message).toBe("12 rematriculados.");
  });

  it("propaga redirectTo do retorno", () => {
    const r = interpretActionResult(
      value({ ok: true, data: undefined, redirectTo: "/alunos" }),
      opts
    );
    expect(r.toast).toBe("success");
    expect(r.redirectTo).toBe("/alunos");
  });

  it("trata {ok:false,error} como erro com a mensagem da action", () => {
    const r = interpretActionResult(value({ ok: false, error: "CPF invalido." }), opts);
    expect(r.toast).toBe("error");
    expect(r.message).toBe("CPF invalido.");
  });

  it("aceita a convencao legada {ok:false,reason} de sicoob/asaas/conciliacao", () => {
    const r = interpretActionResult(value({ ok: false, reason: "Sem saldo." }), opts);
    expect(r.toast).toBe("error");
    expect(r.message).toBe("Sem saldo.");
  });

  it("aceita a convencao legada {success:false,error} de anamnese-export", () => {
    const r = interpretActionResult(value({ success: false, error: "Template ausente." }), opts);
    expect(r.toast).toBe("error");
    expect(r.message).toBe("Template ausente.");
  });

  it("aceita a convencao legada {success:true}", () => {
    const r = interpretActionResult(value({ success: true }), opts);
    expect(r.toast).toBe("success");
    expect(r.message).toBe("Salvo.");
  });

  it("trata retorno void (contrato C) como sucesso e pede refresh", () => {
    const r = interpretActionResult(value(undefined), opts);
    expect(r.toast).toBe("success");
    expect(r.refresh).toBe(true);
  });

  // REGRESSAO: hoje aluno-row-actions.tsx:77 mostra "Falha ao excluir aluno."
  // em toda exclusao BEM-SUCEDIDA, porque redirect() lanca NEXT_REDIRECT.
  it("nao transforma NEXT_REDIRECT em erro; relanca para o Next navegar", () => {
    const redirectError = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;push;/alunos;307;",
    });
    const r = interpretActionResult(thrown(redirectError), opts);
    expect(r.toast).toBe("none");
    expect(r.rethrow).toBe(true);
  });

  it("nao transforma NEXT_NOT_FOUND em erro; relanca", () => {
    const notFound = Object.assign(new Error("NEXT_NOT_FOUND"), {
      digest: "NEXT_NOT_FOUND",
    });
    const r = interpretActionResult(thrown(notFound), opts);
    expect(r.toast).toBe("none");
    expect(r.rethrow).toBe(true);
  });

  it("trata Error comum como erro usando error.message", () => {
    const r = interpretActionResult(thrown(new Error("Serie e nome obrigatorios")), opts);
    expect(r.toast).toBe("error");
    expect(r.message).toBe("Serie e nome obrigatorios");
    expect(r.rethrow).toBe(false);
  });

  it("usa a mensagem de erro padrao quando a excecao nao e Error", () => {
    const r = interpretActionResult(thrown("qualquer coisa"), opts);
    expect(r.toast).toBe("error");
    expect(r.message).toBe("Falhou.");
  });
});
