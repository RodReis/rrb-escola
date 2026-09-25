import { describe, it, expect } from "vitest";
import { COLUNAS_ALUNO, type AlunoCtx } from "./aluno";

function ctx(over: Partial<AlunoCtx> = {}): AlunoCtx {
  return {
    aluno: {
      matricula_codigo: "123", nome: "ANA LAURA", sexo: "F", data_nascimento: "2018-02-10", naturalidade: "Goiânia",
      nacionalidade: "Brasileira", celular: null, cpf: null, rg: null, orgao_expedidor: null, data_expedicao: null,
      certidao_livro: "A1", certidao_folha: "10", certidao_numero: "999", certidao_cartorio: "1º", email: null, codigo_inep: null, etnia: null,
    },
    matricula: { codigo: "M1", ano_letivo: 2026, status: "ativa", data_matricula: "2026-01-15", serie: "3º ANO", segmento: "FUNDAMENTAL1", turma: "A", turno: "matutino" },
    responsaveis: [
      { nome: "MARTIUS AQUINO", cpf: null, telefone: null, celular: "(62)98522-0812", parentesco: "Pai", email: null, responsavel_financeiro: false, responsavel_pedagogico: true },
      { nome: "FRANÇOISA SILVA", cpf: "111", telefone: null, celular: "(62)98481-8104", parentesco: "Mãe", email: "f@x.com", responsavel_financeiro: true, responsavel_pedagogico: false },
    ],
    contatos: [{ nome: "MARGARETE", telefone: null, celular: "(62)98416-7273", parentesco: "Avó", principal: false }],
    enderecos: [
      { logradouro: "Rua 1", numero: "10", complemento: null, bairro: "Centro", cidade: "Goiânia", uf: "GO", cep: "74000-000", principal: false },
      { logradouro: "Rua 2", numero: "20", complemento: "Qd 3", bairro: "Setor Sul", cidade: "TRINDADE", uf: "GO", cep: "75380-000", principal: true },
    ],
    medico: null,
    numeroChamada: 4,
    hoje: new Date(2026, 8, 25),
    ...over,
  };
}

const col = (key: string) => {
  const c = COLUNAS_ALUNO.find((x) => x.key === key);
  if (!c) throw new Error(`coluna ${key} não existe`);
  return c;
};

describe("catálogo de aluno", () => {
  it("keys únicas e labels preenchidos", () => {
    const keys = COLUNAS_ALUNO.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(COLUNAS_ALUNO.every((c) => c.label.trim() && c.grupo.trim())).toBe(true);
    expect(COLUNAS_ALUNO.length).toBeGreaterThanOrEqual(55);
  });
  it("pai e mãe por parentesco (com e sem acento)", () => {
    expect(col("pai.nome").resolve(ctx())).toBe("MARTIUS AQUINO");
    expect(col("mae.nome").resolve(ctx())).toBe("FRANÇOISA SILVA");
    const semAcento = ctx({ responsaveis: [{ ...ctx().responsaveis[1], parentesco: "mae" }] });
    expect(col("mae.celular").resolve(semAcento)).toBe("(62)98481-8104");
    expect(col("pai.nome").resolve(semAcento)).toBe("");
  });
  it("responsável financeiro/pedagógico pelas flags", () => {
    expect(col("rf.nome").resolve(ctx())).toBe("FRANÇOISA SILVA");
    expect(col("rp.nome").resolve(ctx())).toBe("MARTIUS AQUINO");
  });
  it("Celular de pai/mãe/responsável cai para Telefone quando celular está vazio (erro comum de cadastro)", () => {
    const c = ctx({
      responsaveis: [
        { nome: "MARTIUS AQUINO", cpf: null, telefone: "(62)98522-0812", celular: null, parentesco: "Pai", email: null, responsavel_financeiro: false, responsavel_pedagogico: false },
        { nome: "FRANÇOISA SILVA", cpf: "111", telefone: "(62)98481-8104", celular: null, parentesco: "Mãe", email: "f@x.com", responsavel_financeiro: true, responsavel_pedagogico: true },
      ],
    });
    expect(col("pai.celular").resolve(c)).toBe("(62)98522-0812");
    expect(col("mae.celular").resolve(c)).toBe("(62)98481-8104");
    expect(col("rf.celular").resolve(c)).toBe("(62)98481-8104");
    expect(col("rp.celular").resolve(c)).toBe("(62)98481-8104");
  });
  it("Celular usa o valor da própria coluna quando preenchido, mesmo com Telefone também preenchido", () => {
    const c = ctx({
      responsaveis: [
        { nome: "MARTIUS AQUINO", cpf: null, telefone: "(62)3333-3333", celular: "(62)98522-0812", parentesco: "Pai", email: null, responsavel_financeiro: false, responsavel_pedagogico: false },
      ],
    });
    expect(col("pai.celular").resolve(c)).toBe("(62)98522-0812");
  });
  it("Celular fica vazio quando nem celular nem telefone estão preenchidos", () => {
    const c = ctx({
      responsaveis: [
        { nome: "MARTIUS AQUINO", cpf: null, telefone: null, celular: null, parentesco: "Pai", email: null, responsavel_financeiro: false, responsavel_pedagogico: false },
      ],
    });
    expect(col("pai.celular").resolve(c)).toBe("");
  });
  it("Celulares concatena responsáveis e contatos sem duplicar número", () => {
    const c = ctx({ contatos: [...ctx().contatos, { nome: "X", telefone: null, celular: "(62) 98481-8104", parentesco: null, principal: false }] });
    expect(col("cont.celulares").resolve(c)).toBe(
      "(62)98522-0812 - MARTIUS - (Pai) / (62)98481-8104 - FRANÇOISA - (Mãe) / (62)98416-7273 - MARGARETE - (Avó)"
    );
  });
  it("Celulares inclui quem só tem Telefone preenchido (erro comum de cadastro)", () => {
    const c = ctx({
      responsaveis: [
        { nome: "MARTIUS AQUINO", cpf: null, telefone: "(62)98522-0812", celular: null, parentesco: "Pai", email: null, responsavel_financeiro: false, responsavel_pedagogico: false },
      ],
      contatos: [],
    });
    expect(col("cont.celulares").resolve(c)).toBe("(62)98522-0812 - MARTIUS - (Pai)");
  });
  it("endereço principal e Cidade Endereço", () => {
    expect(col("end.cidadeUf").resolve(ctx())).toBe("TRINDADE - GO");
    expect(col("end.completo").resolve(ctx())).toBe("Rua 2, 20, Qd 3 - Setor Sul - TRINDADE - GO - CEP 75380-000");
    expect(col("end.cidadeUf").resolve(ctx({ enderecos: [] }))).toBe("");
  });
  it("idade, datas, segmento, turno e chamada", () => {
    expect(col("aluno.idade").resolve(ctx())).toBe("8");
    expect(col("aluno.nascimento").resolve(ctx())).toBe("10/02/2018");
    expect(col("mat.segmento").resolve(ctx())).toBe("Fundamental I");
    expect(col("mat.turno").resolve(ctx())).toBe("Matutino");
    expect(col("mat.chamada").resolve(ctx())).toBe("4");
  });
});
