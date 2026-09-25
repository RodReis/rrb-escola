import { describe, it, expect } from "vitest";
import { COLUNAS_FUNCIONARIO, type FuncionarioCtx } from "./funcionario";
import { COLUNAS_PROFESSOR } from "./professor";
import { filtrarColunasPorPermissao, getCatalogo, catalogoMeta } from "./index";

const ctx: FuncionarioCtx = {
  func: { name: "JOÃO", cpf: "123.456.789-00", birth_date: "1990-01-01", hire_date: "2020-02-03", email: "j@x.com", telefone: null, cargo: "Professor", school_category: "fund1", status_contrato: "CLT", ativo: true },
  empresa: { name: "EPG LTDA", nome_fantasia: "EPG TRINDADE", cnpj: "11.714.876/0001-16" },
  contrato: { salario_base: 3500, valor_hora_aula: 30.5, aulas_semanais: 20, data_desligamento: null },
  atribuicoes: [
    { disciplina: "Matemática", turma: "A", serie: "3º ANO" },
    { disciplina: "Ciências", turma: "B", serie: "3º ANO" },
    { disciplina: "Matemática", turma: "B", serie: "4º ANO" },
  ],
  usuarioEmail: "joao@escola.com",
  hoje: new Date(2026, 8, 25),
};
const r = (cols: typeof COLUNAS_FUNCIONARIO, key: string) => cols.find((c) => c.key === key)!.resolve(ctx);

describe("catálogo funcionário/professor", () => {
  it("resolve campos básicos e formatados", () => {
    expect(r(COLUNAS_FUNCIONARIO, "func.categoria")).toBe("Fundamental I");
    expect(r(COLUNAS_FUNCIONARIO, "func.situacao")).toBe("Ativo");
    expect(r(COLUNAS_FUNCIONARIO, "emp.nome")).toBe("EPG TRINDADE");
    expect(r(COLUNAS_FUNCIONARIO, "ctr.salario")).toMatch(/3\.500,00/);
  });
  it("professor: listas únicas e ordenadas", () => {
    expect(r(COLUNAS_PROFESSOR, "prof.disciplinas")).toBe("Ciências / Matemática");
    expect(r(COLUNAS_PROFESSOR, "prof.series")).toBe("3º ANO / 4º ANO");
    expect(r(COLUNAS_PROFESSOR, "prof.turmas")).toBe("3º ANO A / 3º ANO B / 4º ANO B");
  });
  it("colunas salariais somem sem rh.folha-v2", () => {
    const semPerm = filtrarColunasPorPermissao(getCatalogo("funcionario"), {}, false).map((c) => c.key);
    expect(semPerm).not.toContain("ctr.salario");
    expect(semPerm).not.toContain("ctr.horaAula");
    const admin = filtrarColunasPorPermissao(getCatalogo("funcionario"), {}, true).map((c) => c.key);
    expect(admin).toContain("ctr.salario");
  });
  it("meta não carrega funções", () => {
    const meta = catalogoMeta(getCatalogo("professor"));
    expect(Object.keys(meta[0]).sort()).toEqual(["grupo", "key", "label", "tipo"]);
  });
});
