/**
 * Regras de decisão do importador: o que vira cobrança, o que vai para a fila
 * de pendências e se o repasse fecha.
 *
 * Função pura, separada da action, porque é aqui que mora o julgamento — e
 * julgamento precisa de teste. A RPC `importar_repasse_isaac` não decide nada:
 * recebe o resultado disto já mastigado e só grava.
 *
 * Ref: docs/superpowers/specs/2026-09-21-financeiro-isaac-multicnpj-design.md
 */
import type { AnaliticoIsaac, ParcelaAnalitico } from "./parse-analitico";
import { mudancasPorTipo, separarTiposMudanca } from "./parse-analitico";
import { normalizarNomeIsaac } from "./normalizar-nome";
import { linhaPorTipo, type ResumoIsaac } from "./parse-resumo";

export type TipoVaga =
  | "NORMAL"
  | "BOLSA_50_PORCENTO"
  | "BOLSA_INTEGRAL"
  | "FILHO_PROFESSORA"
  | "FILHO_PROFESSORA_INTEGRAL"
  | "PERMUTA"
  | "ISENTO";

export type MotivoPendencia = "sem_aluno" | "tipo_vaga_incompativel" | "permuta_manual" | "aluno_cancelado";

/**
 * Tipos de vaga que NÃO deveriam ter mensalidade cobrada pelo isaac.
 *
 * FILHO_PROFESSORA está aqui e não junto de BOLSA_50_PORCENTO apesar de os dois
 * terem `percentual_bolsa = 50`: o desconto do filho de professora é aplicado na
 * FOLHA DE PAGAMENTO, não no isaac — o aluno não é cobrado pelo isaac de forma
 * alguma. Os dois tipos compartilham o percentual mas não o fluxo de cobrança,
 * então `percentual_bolsa` não serve como critério de roteamento aqui.
 */
const SEM_MENSALIDADE_NO_ISAAC: ReadonlySet<TipoVaga> = new Set<TipoVaga>([
  "BOLSA_INTEGRAL",
  "FILHO_PROFESSORA_INTEGRAL",
  "FILHO_PROFESSORA",
  "ISENTO",
]);

/** Aluno do cadastro, como a camada de dados entrega para o casamento. */
export type AlunoCadastro = {
  id: string;
  /** Já normalizado com `normalizarNomeIsaac` — os dois lados têm que usar a mesma função. */
  nomeNormalizado: string;
  tipoVaga: TipoVaga | null;
  valorMensalidadePraticado: number | null;
  /** Data (YYYY-MM-DD) do cancelamento da matrícula do ano corrente, ou null se ativa/sem cancelamento. */
  matriculaCanceladaEm: string | null;
};

export type ParcelaPreparada = {
  idParcela: string;
  alunoId: string | null;
  nomeIsaac: string;
  produto: string;
  tipo: ParcelaAnalitico["tipo"];
  competencia: string;
  valorMensalidade: number;
  valorMudanca: number;
  valorBase: number;
  taxa: number;
  valorFinal: number;
  tipoMudanca: string | null;
  motivoPendencia: MotivoPendencia | null;
  /** Categoria de receita da cobrança. Null quando a parcela não vira cobrança. */
  categoriaNome: string | null;
};

export type Divergencia = {
  o_que: string;
  esperado: number;
  obtido: number;
  /** true = impede a importação. */
  bloqueia: boolean;
  /**
   * "dinheiro" formata como moeda; "contagem" mostra o número cru. Sem isso a
   * tela exibia "2 parcelas de bolsista" como "R$ 2,00".
   */
  unidade?: "dinheiro" | "contagem";
};

export type PreparoImportacao = {
  parcelas: ParcelaPreparada[];
  /** Impedem a gravação. */
  bloqueios: Divergencia[];
  /** Mostradas na pré-visualização, não impedem. */
  avisos: Divergencia[];
  resumoContagens: {
    total: number;
    viramCobranca: number;
    semAluno: number;
    tipoVagaIncompativel: number;
    permutaManual: number;
    estornos: number;
  };
};

/**
 * Categoria de receita da parcela. Material é categorizado por SEGMENTO (não
 * por editora: a editora é renegociada todo ano e quebraria a série histórica
 * do razão, o segmento é estável). O segmento sai do nome do produto, que é o
 * único lugar onde o isaac o informa.
 */
export function categoriaDaParcela(parcela: ParcelaAnalitico): string {
  if (parcela.tipo !== "material") return "Mensalidades";
  const p = parcela.produto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/(infantil|maternal)/.test(p)) return "Material didático — Infantil";
  if (/fund\s*2|fund\s*ii|[6-9]\s*o?\s*ano/.test(p)) return "Material didático — Fund II";
  if (/fund\s*1|fund\s*i|[1-5]\s*o?\s*ano/.test(p)) return "Material didático — Fund I";
  if (/(medio|serie)/.test(p)) return "Material didático — Médio";
  return "Material didático";
}

/**
 * Decide o destino de uma parcela. Só parcela de MENSALIDADE passa pela
 * checagem de tipo_vaga — material nunca é bloqueado por isso, porque
 * bolsista de mensalidade continua comprando apostila.
 */
export function decidirPendencia(
  parcela: ParcelaAnalitico,
  aluno: AlunoCadastro | null,
): MotivoPendencia | null {
  if (aluno === null) return "sem_aluno";
  if (parcela.tipo !== "mensalidade") return null;
  // Estorno e ajuste de centavo não são cobrança de ninguém: não há o que
  // revisar, a linha só precisa ficar registrada no espelho.
  if (parcela.valorBase <= 0) return null;

  // Competencia é "YYYY-MM"; cancelamento_data é "YYYY-MM-DD". Compara por
  // prefixo de mês: competência posterior ao mês do cancelamento não gera
  // cobrança — a escola não deveria mais receber por esse aluno.
  if (aluno.matriculaCanceladaEm && parcela.competencia > aluno.matriculaCanceladaEm.slice(0, 7)) {
    return "aluno_cancelado";
  }

  const tipoVaga = aluno.tipoVaga ?? "NORMAL";

  // PERMUTA não tem percentual fixo no schema (cada caso é negociado), então
  // toda mensalidade de permutante é revisada à mão em vez de assumir um valor.
  if (tipoVaga === "PERMUTA") return "permuta_manual";

  // Beneficiário com mensalidade cobrada pelo isaac = divergência entre o
  // cadastro da escola e o do isaac. Não vira receita automaticamente.
  if (SEM_MENSALIDADE_NO_ISAAC.has(tipoVaga)) return "tipo_vaga_incompativel";

  return null;
}

/**
 * Checagem de fechamento (passo 8 do spec): o dinheiro que o isaac diz ter
 * transferido tem que bater com a soma das transferências. Independe de quantas
 * parcelas viraram cobrança — é conferência do repasse, não do nosso cadastro.
 */
export function conferirFechamento(
  analitico: AnaliticoIsaac,
  resumo: ResumoIsaac,
): Divergencia[] {
  const divergencias: Divergencia[] = [];
  const centavos = (x: number) => Math.round(x * 100);

  const somaTransferencias = resumo.transferencias.reduce((acc, t) => acc + t.valor, 0);
  if (centavos(somaTransferencias) !== centavos(resumo.total)) {
    divergencias.push({
      o_que: "soma das transferências ≠ total do resumo",
      esperado: resumo.total,
      obtido: somaTransferencias,
      bloqueia: true,
    });
  }

  const somaLinhas = resumo.linhas.reduce((acc, l) => acc + l.valor, 0);
  if (centavos(somaLinhas) !== centavos(resumo.total)) {
    divergencias.push({
      o_que: "soma das linhas do resumo ≠ total do resumo",
      esperado: resumo.total,
      obtido: somaLinhas,
      bloqueia: true,
    });
  }

  // O analítico não conhece o crédito de curto prazo: ele só existe no resumo.
  // Por isso a ponte é `valor final do analítico − crédito = total do resumo`.
  const credito = linhaPorTipo(resumo, "Débito da parcela do crédito de curto prazo") ?? 0;
  const esperadoDoAnalitico = Math.round((analitico.totais.final + credito) * 100) / 100;
  if (centavos(esperadoDoAnalitico) !== centavos(resumo.total)) {
    divergencias.push({
      o_que: "valor final do analítico (menos crédito) ≠ total do resumo",
      esperado: resumo.total,
      obtido: esperadoDoAnalitico,
      bloqueia: true,
    });
  }

  // Cada linha do resumo tem contrapartida no analítico.
  const porTipo = mudancasPorTipo(analitico);
  const mensalidadesResumo = linhaPorTipo(resumo, "Mensalidades");
  if (mensalidadesResumo !== null && centavos(analitico.totais.mensalidades) !== centavos(mensalidadesResumo)) {
    divergencias.push({
      o_que: "mensalidades do analítico ≠ do resumo",
      esperado: mensalidadesResumo,
      obtido: analitico.totais.mensalidades,
      bloqueia: true,
    });
  }

  const taxaResumo = linhaPorTipo(resumo, "Taxa isaac");
  if (taxaResumo !== null && centavos(analitico.totais.taxa) !== centavos(-taxaResumo)) {
    divergencias.push({
      o_que: "taxa do analítico ≠ do resumo",
      esperado: -taxaResumo,
      obtido: analitico.totais.taxa,
      bloqueia: true,
    });
  }

  // Parcela de tipo composto traz UM valor já somado para os dois efeitos
  // ("Edição de desconto / Novo contrato" = 876,65, que é 890,00 − 13,35), sem
  // dizer quanto cabe a cada um. O resumo separa; o analítico não. Enquanto
  // houver uma dessas, a conferência por tipo não fecha por construção — então
  // ela vira aviso, e o bloqueio fica por conta de mensalidades e taxa, que
  // continuam exatos e são o que fecha o dinheiro.
  const tiposCompostos = new Set<string>();
  for (const p of analitico.parcelas) {
    const tipos = separarTiposMudanca(p.tipoMudanca);
    if (tipos.length > 1) for (const t of tipos) tiposCompostos.add(t);
  }

  for (const rotulo of ["Novo contrato", "Recebido na escola", "Cancelado"]) {
    const noResumo = linhaPorTipo(resumo, rotulo);
    if (noResumo === null) continue;
    const noAnalitico = porTipo.get(rotulo) ?? 0;
    if (centavos(noAnalitico) !== centavos(noResumo)) {
      divergencias.push({
        o_que: `"${rotulo}" do analítico ≠ do resumo`,
        esperado: noResumo,
        obtido: noAnalitico,
        bloqueia: !tiposCompostos.has(rotulo),
      });
    }
  }

  // Contagem informada no cabeçalho do resumo: confere, mas não bloqueia — é
  // um número de exibição do isaac, não parte da conta do dinheiro.
  if (resumo.cobrancasInformadas !== null && resumo.cobrancasInformadas !== analitico.totais.linhas) {
    divergencias.push({
      o_que: "nº de cobranças do resumo ≠ nº de parcelas do analítico",
      esperado: resumo.cobrancasInformadas,
      obtido: analitico.totais.linhas,
      bloqueia: false,
      unidade: "contagem",
    });
  }

  return divergencias;
}

export function prepararImportacao(
  analitico: AnaliticoIsaac,
  resumo: ResumoIsaac,
  alunos: AlunoCadastro[],
  aliases: Map<string, string>,
): PreparoImportacao {
  const porNome = new Map<string, AlunoCadastro>();
  for (const aluno of alunos) {
    // Nome repetido no cadastro não pode casar automaticamente: escolher um dos
    // dois lançaria a mensalidade no aluno errado. Marca como ambíguo removendo
    // do índice — a parcela cai na fila como "sem_aluno".
    if (porNome.has(aluno.nomeNormalizado)) {
      porNome.delete(aluno.nomeNormalizado);
      continue;
    }
    porNome.set(aluno.nomeNormalizado, aluno);
  }
  const porId = new Map(alunos.map((a) => [a.id, a]));

  const parcelas: ParcelaPreparada[] = [];
  const contagens = {
    total: 0,
    viramCobranca: 0,
    semAluno: 0,
    tipoVagaIncompativel: 0,
    permutaManual: 0,
    estornos: 0,
  };

  for (const parcela of analitico.parcelas) {
    contagens.total += 1;
    const chave = normalizarNomeIsaac(parcela.nomeIsaac);
    // Alias tem precedência: é a correção manual que alguém já fez.
    const alunoId = aliases.get(chave) ?? porNome.get(chave)?.id ?? null;
    const aluno = alunoId === null ? null : porId.get(alunoId) ?? null;
    const motivo = decidirPendencia(parcela, aluno);

    const viraCobranca = aluno !== null && motivo === null && parcela.valorBase > 0;
    if (viraCobranca) contagens.viramCobranca += 1;
    if (motivo === "sem_aluno") contagens.semAluno += 1;
    if (motivo === "tipo_vaga_incompativel") contagens.tipoVagaIncompativel += 1;
    if (motivo === "permuta_manual") contagens.permutaManual += 1;
    if (parcela.valorBase < 0) contagens.estornos += 1;

    parcelas.push({
      idParcela: parcela.idParcela,
      alunoId: aluno?.id ?? null,
      nomeIsaac: parcela.nomeIsaac,
      produto: parcela.produto,
      tipo: parcela.tipo,
      competencia: parcela.competencia,
      valorMensalidade: parcela.valorMensalidade,
      valorMudanca: parcela.valorMudanca,
      valorBase: parcela.valorBase,
      taxa: parcela.taxa,
      valorFinal: parcela.valorFinal,
      tipoMudanca: parcela.tipoMudanca,
      motivoPendencia: motivo,
      categoriaNome: viraCobranca ? categoriaDaParcela(parcela) : null,
    });
  }

  const conferencia = conferirFechamento(analitico, resumo);
  const bloqueios = conferencia.filter((d) => d.bloqueia);
  const avisos = conferencia.filter((d) => !d.bloqueia);

  // Divergência entre o cadastro da escola e o do isaac é decisão humana:
  // ou o tipo_vaga daqui está errado, ou o isaac está cobrando quem não devia.
  // Importar por cima esconderia o problema no livro-razão.
  if (contagens.tipoVagaIncompativel > 0) {
    bloqueios.push({
      o_que: `${contagens.tipoVagaIncompativel} parcela(s) de mensalidade para aluno bolsista/isento`,
      esperado: 0,
      obtido: contagens.tipoVagaIncompativel,
      bloqueia: true,
      unidade: "contagem",
    });
  }

  return { parcelas, bloqueios, avisos, resumoContagens: contagens };
}
