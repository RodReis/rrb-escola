import {
  detectarTransferenciasInternas,
  type MovimentoConta,
  type ParAmbiguo,
  type ParInterno,
} from "@/lib/conciliacao/transferencia-interna";
import { classificarPorRegra, type DebitoParaRegra, type Regra } from "@/lib/conciliacao/classificar-regra";
import {
  casarPrevistos,
  type BaixaAmbigua,
  type BaixaUnica,
  type PrevistoAberto,
} from "@/lib/conciliacao/baixa-previsto";

/**
 * Pipeline de classificação de débitos. Função pura: recebe tudo, devolve os
 * baldes. Quem lê e grava é o sync.
 *
 * A ORDEM é o ponto do módulo, e está travada por teste:
 *   1. transferência entre contas próprias (estrutural)
 *   2. documento é CNPJ próprio sem par  -> conta própria fora do sistema (a Caixa, D2)
 *   3. baixa de previsto                 -> título a pagar aberto, valor exato
 *   4. regra de contraparte              -> SUGESTÃO, nunca lançamento (D1)
 *   5. o resto                           -> fila manual
 *
 * Se a etapa 3/4 rodasse antes da 1, o Pix entre os dois CNPJs — que tem documento
 * e se repete todo mês — viraria candidato a regra de fornecedor, e toda
 * transferência interna passaria a virar despesa nos dois CNPJs.
 */

export type Sugestao = {
  debitoId: string;
  regraId: string;
  categoriaId: string;
  companyId: string | null;
  classeDespesa: "fixa" | "variavel" | null;
};

export type ContaPropriaSemPar = { debitoId: string; documento: string };

export type ResultadoPipeline = {
  transferenciasInternas: ParInterno[];
  ambiguos: ParAmbiguo[];
  contaPropriaSemPar: ContaPropriaSemPar[];
  baixasUnicas: BaixaUnica[];
  baixasAmbiguas: BaixaAmbigua[];
  sugestoes: Sugestao[];
  aClassificar: string[];
};

export type EntradaPipeline = {
  debitos: MovimentoConta[];
  creditos: MovimentoConta[];
  /** id do débito -> documento da contraparte (null quando o extrato não traz) */
  documentos: Record<string, string | null>;
  /** id do débito -> descrição do banco */
  descricoes: Record<string, string>;
  regras: Regra[];
  contasProprias: Set<string>;
  documentosProprios: Set<string>;
  /** Títulos a pagar em aberto. Ausente = etapa 3 desligada. */
  previstos?: PrevistoAberto[];
  /** id da conta -> company_id dela; usado para não casar título de outra empresa. */
  companyPorConta?: Record<string, string | null>;
};

export function classificarDebitos(entrada: EntradaPipeline): ResultadoPipeline {
  const { pares, ambiguos } = detectarTransferenciasInternas(entrada.debitos, entrada.creditos);

  const resolvidos = new Set(pares.map((p) => p.debitoId));
  const ambiguosIds = new Set(ambiguos.map((a) => a.debitoId));

  const contaPropriaSemPar: ContaPropriaSemPar[] = [];
  const restantes: MovimentoConta[] = [];

  for (const debito of entrada.debitos) {
    if (resolvidos.has(debito.id) || ambiguosIds.has(debito.id)) continue;

    const documento = entrada.documentos[debito.id] ?? null;
    if (documento !== null && entrada.documentosProprios.has(documento)) {
      contaPropriaSemPar.push({ debitoId: debito.id, documento });
      continue;
    }
    restantes.push(debito);
  }

  const { unicas, ambiguas } = casarPrevistos(
    restantes.map((d) => ({
      id: d.id,
      companyId: entrada.companyPorConta?.[d.contaId] ?? null,
      data: d.data,
      valor: d.valor,
      documento: entrada.documentos[d.id] ?? null,
    })),
    entrada.previstos ?? [],
  );
  const comBaixa = new Set([...unicas.map((b) => b.debitoId), ...ambiguas.map((b) => b.debitoId)]);

  const sugestoes: Sugestao[] = [];
  const aClassificar: string[] = [];

  for (const debito of restantes) {
    if (comBaixa.has(debito.id)) continue;

    const paraRegra: DebitoParaRegra = {
      id: debito.id,
      contaId: debito.contaId,
      data: debito.data,
      valor: debito.valor,
      descricao: entrada.descricoes[debito.id] ?? "",
      documento: entrada.documentos[debito.id] ?? null,
    };

    const regra = classificarPorRegra(paraRegra, entrada.regras);
    if (regra) {
      sugestoes.push({
        debitoId: debito.id,
        regraId: regra.id,
        categoriaId: regra.categoriaId,
        companyId: regra.companyId,
        classeDespesa: regra.classeDespesa,
      });
      continue;
    }

    aClassificar.push(debito.id);
  }

  return {
    transferenciasInternas: pares,
    ambiguos,
    contaPropriaSemPar,
    baixasUnicas: unicas,
    baixasAmbiguas: ambiguas,
    sugestoes,
    aClassificar,
  };
}
