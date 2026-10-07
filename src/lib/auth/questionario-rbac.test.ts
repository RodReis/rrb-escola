import { describe, expect, it } from "vitest";
import { MODULOS, ROTA_PARA_MODULO } from "./permissions";

// Rota sem entrada em ROTA_PARA_MODULO é "liberada" nos filtros de menu:
// este teste impede um módulo novo de escapar do RBAC.
const ROTAS = {
  "/questionario/grupos": "questionario.grupo",
  "/questionario/escalas": "questionario.escala",
  "/questionario/questoes": "questionario.questao",
  "/questionario/questionarios": "questionario.questionario",
  "/questionario/secoes": "questionario.secao",
  "/questionario/associacoes": "questionario.associacao",
} as const;

describe("RBAC do módulo Questionário", () => {
  it.each(Object.entries(ROTAS))("rota %s exige o módulo %s", (rota, modulo) => {
    expect(ROTA_PARA_MODULO[rota]).toBe(modulo);
    expect(MODULOS).toHaveProperty(modulo);
  });
});
