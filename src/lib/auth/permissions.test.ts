// src/lib/auth/permissions.test.ts
import { describe, it, expect } from "vitest";
import { MODULOS, ROTA_PARA_MODULO } from "./permissions";

describe("módulos de relatório dinâmico", () => {
  it("registra os 3 módulos e mapeia as 3 rotas", () => {
    expect(MODULOS["relatorios.dinamico-aluno"].grupo).toBe("operacional");
    expect(MODULOS["relatorios.dinamico-funcionario"].grupo).toBe("operacional");
    expect(MODULOS["relatorios.dinamico-professor"].grupo).toBe("operacional");
    expect(ROTA_PARA_MODULO["/relatorios/dinamico/alunos"]).toBe("relatorios.dinamico-aluno");
    expect(ROTA_PARA_MODULO["/relatorios/dinamico/funcionarios"]).toBe("relatorios.dinamico-funcionario");
    expect(ROTA_PARA_MODULO["/relatorios/dinamico/professores"]).toBe("relatorios.dinamico-professor");
  });
});
