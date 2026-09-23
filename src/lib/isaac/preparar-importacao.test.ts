import { describe, expect, it } from "vitest";
import {
  categoriaDaParcela,
  conferirFechamento,
  decidirPendencia,
  prepararImportacao,
  type AlunoCadastro,
  type TipoVaga,
} from "./preparar-importacao";
import type { AnaliticoIsaac, ParcelaAnalitico } from "./parse-analitico";
import type { ResumoIsaac } from "./parse-resumo";

function parcela(over: Partial<ParcelaAnalitico> = {}): ParcelaAnalitico {
  return {
    idParcela: "p1",
    nomeIsaac: "Aluno Um",
    produto: "Mensalidade - Ensino Fundamental - 5º Ano",
    tipo: "mensalidade",
    competencia: "2026-08",
    valorMensalidade: 745,
    valorMudanca: 0,
    valorBase: 745,
    taxa: 54.3,
    valorFinal: 690.7,
    tipoMudanca: null,
    ...over,
  };
}

function aluno(over: Partial<AlunoCadastro> = {}): AlunoCadastro {
  return {
    id: "aluno-1",
    nomeNormalizado: "aluno um",
    tipoVaga: "NORMAL",
    valorMensalidadePraticado: null,
    ...over,
  };
}

describe("categoriaDaParcela — material por segmento, não por editora", () => {
  it("mensalidade vai para a categoria única", () => {
    expect(categoriaDaParcela(parcela())).toBe("Mensalidades");
    expect(categoriaDaParcela(parcela({ produto: "Anuidade 1º Ano", tipo: "mensalidade" }))).toBe("Mensalidades");
  });

  it("separa material pelos quatro segmentos", () => {
    const mat = (produto: string) => categoriaDaParcela(parcela({ produto, tipo: "material" }));
    expect(mat("Materia De Apoio Pedagogico Infantil 4")).toBe("Material didático — Infantil");
    expect(mat("Materia De Apoio Pedagogico 3º Ano Fund 1")).toBe("Material didático — Fund I");
    expect(mat("Materia De Apoio Pedagogico Fund 2")).toBe("Material didático — Fund II");
    expect(mat("Materia De Apoio Pedagogico 2º Série Ensino Médio")).toBe("Material didático — Médio");
  });

  it("maternal cai em Infantil — só tem agenda, não vira categoria própria", () => {
    expect(categoriaDaParcela(parcela({ produto: "Agenda Maternal", tipo: "material" }))).toBe(
      "Material didático — Infantil",
    );
  });

  it("material não reconhecido fica na categoria pai em vez de virar Mensalidades", () => {
    expect(categoriaDaParcela(parcela({ produto: "Material Didático", tipo: "material" }))).toBe("Material didático");
  });
});

describe("decidirPendencia — tipo_vaga × parcela de mensalidade", () => {
  it("NORMAL e BOLSA_50_PORCENTO viram cobrança normalmente", () => {
    expect(decidirPendencia(parcela(), aluno({ tipoVaga: "NORMAL" }))).toBeNull();
    expect(decidirPendencia(parcela(), aluno({ tipoVaga: "BOLSA_50_PORCENTO" }))).toBeNull();
  });

  it("bolsista integral e isento com mensalidade cobrada caem na fila", () => {
    const tipos: TipoVaga[] = ["BOLSA_INTEGRAL", "FILHO_PROFESSORA_INTEGRAL", "ISENTO"];
    for (const tipoVaga of tipos) {
      expect(decidirPendencia(parcela(), aluno({ tipoVaga }))).toBe("tipo_vaga_incompativel");
    }
  });

  it("FILHO_PROFESSORA cai na fila, apesar de ter os mesmos 50% de BOLSA_50_PORCENTO", () => {
    // O desconto do filho de professora é aplicado na FOLHA, não no isaac — o
    // aluno não é cobrado pelo isaac de forma alguma. percentual_bolsa igual
    // não significa mesmo fluxo de cobrança.
    expect(decidirPendencia(parcela(), aluno({ tipoVaga: "FILHO_PROFESSORA" }))).toBe("tipo_vaga_incompativel");
    expect(decidirPendencia(parcela(), aluno({ tipoVaga: "BOLSA_50_PORCENTO" }))).toBeNull();
  });

  it("PERMUTA sempre vai para revisão manual — não tem percentual fixo no schema", () => {
    expect(decidirPendencia(parcela(), aluno({ tipoVaga: "PERMUTA" }))).toBe("permuta_manual");
  });

  it("parcela de MATERIAL nunca é bloqueada por tipo_vaga", () => {
    // Bolsista de mensalidade continua comprando apostila.
    const material = parcela({ tipo: "material", produto: "Materia De Apoio Pedagogico Fund 2" });
    expect(decidirPendencia(material, aluno({ tipoVaga: "BOLSA_INTEGRAL" }))).toBeNull();
    expect(decidirPendencia(material, aluno({ tipoVaga: "PERMUTA" }))).toBeNull();
  });

  it("estorno e ajuste de centavo não viram pendência — não há o que revisar", () => {
    expect(decidirPendencia(parcela({ valorBase: -690 }), aluno({ tipoVaga: "BOLSA_INTEGRAL" }))).toBeNull();
    expect(decidirPendencia(parcela({ valorBase: 0 }), aluno({ tipoVaga: "PERMUTA" }))).toBeNull();
  });

  it("sem aluno casado, o motivo é sem_aluno — antes de qualquer checagem de vaga", () => {
    expect(decidirPendencia(parcela(), null)).toBe("sem_aluno");
  });

  it("aluno sem tipo_vaga é tratado como NORMAL", () => {
    expect(decidirPendencia(parcela(), aluno({ tipoVaga: null }))).toBeNull();
  });
});

const RESUMO: ResumoIsaac = {
  unidade: "EPG Trindade",
  competencia: "2026-09",
  periodo: null,
  linhas: [
    { grupo: "recebimento", tipo: "Mensalidades", valor: 1000 },
    { grupo: "recebimento", tipo: "Novo contrato", valor: 100 },
    { grupo: "desconto", tipo: "Taxa isaac", valor: -80 },
    { grupo: "desconto", tipo: "Recebido na escola", valor: -50 },
    { grupo: "outros", tipo: "Débito da parcela do crédito de curto prazo", valor: -200 },
  ],
  transferencias: [
    { data: "2026-09-05", valor: 540 },
    { data: "2026-09-15", valor: 230 },
  ],
  total: 770,
  alunosInformados: 2,
  cobrancasInformadas: 2,
};

const ANALITICO: AnaliticoIsaac = {
  parcelas: [
    parcela({ idParcela: "p1", valorMensalidade: 1000, valorMudanca: 0, valorBase: 1000, taxa: 80, valorFinal: 920 }),
    parcela({
      idParcela: "p2",
      nomeIsaac: "Aluno Dois",
      valorMensalidade: 0,
      valorMudanca: 50,
      valorBase: 50,
      taxa: 0,
      valorFinal: 50,
      tipoMudanca: "Novo contrato",
    }),
  ],
  mudancas: [],
  totais: { linhas: 2, mensalidades: 1000, mudancas: 50, base: 1050, taxa: 80, final: 970 },
};

describe("conferirFechamento", () => {
  it("não acusa nada quando analítico e resumo batem", () => {
    // 970 (final do analítico) - 200 (crédito) = 770 (total do resumo).
    const analitico: AnaliticoIsaac = {
      ...ANALITICO,
      parcelas: ANALITICO.parcelas.map((p) =>
        p.idParcela === "p2" ? { ...p, valorMudanca: 100, valorBase: 100, valorFinal: 100 } : p,
      ),
      totais: { linhas: 2, mensalidades: 1000, mudancas: 100, base: 1100, taxa: 80, final: 1020 },
    };
    const resumo: ResumoIsaac = { ...RESUMO, total: 820, transferencias: [{ data: "2026-09-05", valor: 820 }] };
    const semRecebido: ResumoIsaac = { ...resumo, linhas: resumo.linhas.filter((l) => l.tipo !== "Recebido na escola") };
    expect(conferirFechamento(analitico, semRecebido)).toEqual([]);
  });

  it("bloqueia quando as transferências não somam o total", () => {
    const quebrado: ResumoIsaac = { ...RESUMO, transferencias: [{ data: "2026-09-05", valor: 540 }] };
    const d = conferirFechamento(ANALITICO, quebrado);
    expect(d.some((x) => x.o_que.includes("transferências") && x.bloqueia)).toBe(true);
  });

  it("bloqueia quando o analítico menos o crédito não dá o total do resumo", () => {
    const analitico: AnaliticoIsaac = {
      ...ANALITICO,
      totais: { ...ANALITICO.totais, final: 999 },
    };
    const d = conferirFechamento(analitico, RESUMO);
    expect(d.some((x) => x.o_que.includes("valor final do analítico") && x.bloqueia)).toBe(true);
  });

  it("bloqueia quando a taxa do analítico difere do resumo", () => {
    const analitico: AnaliticoIsaac = { ...ANALITICO, totais: { ...ANALITICO.totais, taxa: 99 } };
    const d = conferirFechamento(analitico, RESUMO);
    expect(d.some((x) => x.o_que.includes("taxa") && x.bloqueia)).toBe(true);
  });

  it("bloqueia quando uma linha do resumo não tem contrapartida no analítico", () => {
    // "Recebido na escola" existe no resumo (-50) mas nenhuma parcela tem esse tipo.
    const d = conferirFechamento(ANALITICO, RESUMO);
    expect(d.some((x) => x.o_que.includes("Recebido na escola") && x.bloqueia)).toBe(true);
  });

  it("apenas AVISA quando a contagem de cobranças do resumo não bate", () => {
    const resumo: ResumoIsaac = { ...RESUMO, cobrancasInformadas: 99 };
    const d = conferirFechamento(ANALITICO, resumo);
    const contagem = d.find((x) => x.o_que.includes("nº de cobranças"));
    expect(contagem?.bloqueia).toBe(false);
  });

  it("rebaixa a divergência a AVISO quando o tipo aparece numa parcela composta", () => {
    // "Edição de desconto / Novo contrato" traz um valor só (890 − 13,35), sem
    // dizer quanto é de cada — o resumo separa, o analítico não. Divergir aí é
    // limitação do formato, não erro de dado: não pode barrar a importação.
    const analitico: AnaliticoIsaac = {
      ...ANALITICO,
      parcelas: ANALITICO.parcelas.map((p) =>
        p.idParcela === "p2" ? { ...p, tipoMudanca: "Edição de desconto / Novo contrato" } : p,
      ),
    };
    const resumo: ResumoIsaac = { ...RESUMO, linhas: RESUMO.linhas.filter((l) => l.tipo !== "Recebido na escola") };
    const d = conferirFechamento(analitico, resumo);
    const novoContrato = d.find((x) => x.o_que.includes("Novo contrato"));
    expect(novoContrato).toBeDefined();
    expect(novoContrato?.bloqueia).toBe(false);
  });

  it("segue BLOQUEANDO a divergência de um tipo que só aparece sozinho", () => {
    // Sem parcela composta envolvendo o tipo, divergir é erro de dado de verdade.
    const resumo: ResumoIsaac = {
      ...RESUMO,
      linhas: RESUMO.linhas.filter((l) => l.tipo !== "Recebido na escola"),
    };
    const d = conferirFechamento(ANALITICO, resumo);
    const novoContrato = d.find((x) => x.o_que.includes("Novo contrato"));
    expect(novoContrato?.bloqueia).toBe(true);
  });
});

describe("prepararImportacao", () => {
  const alunos: AlunoCadastro[] = [
    aluno({ id: "a1", nomeNormalizado: "aluno um", tipoVaga: "NORMAL" }),
    aluno({ id: "a2", nomeNormalizado: "aluno dois", tipoVaga: "BOLSA_INTEGRAL" }),
  ];

  it("casa aluno por nome normalizado e marca quem não casou", () => {
    const analitico: AnaliticoIsaac = {
      parcelas: [
        parcela({ idParcela: "p1", nomeIsaac: "ALUNO UM" }),
        parcela({ idParcela: "p2", nomeIsaac: "Ninguém Conhecido" }),
      ],
      mudancas: [],
      totais: { linhas: 2, mensalidades: 1490, mudancas: 0, base: 1490, taxa: 108.6, final: 1381.4 },
    };
    const preparo = prepararImportacao(analitico, RESUMO, alunos, new Map());
    expect(preparo.parcelas[0].alunoId).toBe("a1");
    expect(preparo.parcelas[0].motivoPendencia).toBeNull();
    expect(preparo.parcelas[1].alunoId).toBeNull();
    expect(preparo.parcelas[1].motivoPendencia).toBe("sem_aluno");
    expect(preparo.resumoContagens.semAluno).toBe(1);
  });

  it("alias tem precedência sobre o nome — é a correção manual já feita", () => {
    const analitico: AnaliticoIsaac = {
      parcelas: [parcela({ idParcela: "p1", nomeIsaac: "Apelido Qualquer" })],
      mudancas: [],
      totais: { linhas: 1, mensalidades: 745, mudancas: 0, base: 745, taxa: 54.3, final: 690.7 },
    };
    const aliases = new Map([["apelido qualquer", "a1"]]);
    const preparo = prepararImportacao(analitico, RESUMO, alunos, aliases);
    expect(preparo.parcelas[0].alunoId).toBe("a1");
  });

  it("nome duplicado no cadastro NÃO casa automaticamente — escolher um lançaria no aluno errado", () => {
    const gemeos: AlunoCadastro[] = [
      aluno({ id: "g1", nomeNormalizado: "maria silva" }),
      aluno({ id: "g2", nomeNormalizado: "maria silva" }),
    ];
    const analitico: AnaliticoIsaac = {
      parcelas: [parcela({ idParcela: "p1", nomeIsaac: "Maria Silva" })],
      mudancas: [],
      totais: { linhas: 1, mensalidades: 745, mudancas: 0, base: 745, taxa: 54.3, final: 690.7 },
    };
    const preparo = prepararImportacao(analitico, RESUMO, gemeos, new Map());
    expect(preparo.parcelas[0].alunoId).toBeNull();
    expect(preparo.parcelas[0].motivoPendencia).toBe("sem_aluno");
  });

  it("bloqueia a importação quando há mensalidade cobrada de bolsista", () => {
    const analitico: AnaliticoIsaac = {
      parcelas: [parcela({ idParcela: "p1", nomeIsaac: "Aluno Dois" })],
      mudancas: [],
      totais: { linhas: 1, mensalidades: 745, mudancas: 0, base: 745, taxa: 54.3, final: 690.7 },
    };
    const preparo = prepararImportacao(analitico, RESUMO, alunos, new Map());
    expect(preparo.parcelas[0].motivoPendencia).toBe("tipo_vaga_incompativel");
    expect(preparo.bloqueios.some((b) => b.o_que.includes("bolsista/isento"))).toBe(true);
  });

  it("só define categoria para a parcela que vira cobrança", () => {
    const analitico: AnaliticoIsaac = {
      parcelas: [
        parcela({ idParcela: "p1", nomeIsaac: "Aluno Um" }),
        parcela({ idParcela: "p2", nomeIsaac: "Aluno Um", valorBase: -690, valorMudanca: -690, valorMensalidade: 0 }),
        parcela({ idParcela: "p3", nomeIsaac: "Aluno Um", tipo: "material", produto: "Materia De Apoio Pedagogico Fund 2" }),
      ],
      mudancas: [],
      totais: { linhas: 3, mensalidades: 1490, mudancas: -690, base: 800, taxa: 108.6, final: 691.4 },
    };
    const preparo = prepararImportacao(analitico, RESUMO, alunos, new Map());
    expect(preparo.parcelas[0].categoriaNome).toBe("Mensalidades");
    expect(preparo.parcelas[1].categoriaNome).toBeNull(); // estorno não vira cobrança
    expect(preparo.parcelas[2].categoriaNome).toBe("Material didático — Fund II");
    expect(preparo.resumoContagens.estornos).toBe(1);
    expect(preparo.resumoContagens.viramCobranca).toBe(2);
  });
});
