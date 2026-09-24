import {
  detectarTransferenciasInternas,
  type MovimentoConta,
  type ParAmbiguo,
  type ParInterno,
} from "@/lib/conciliacao/transferencia-interna";
import { classificarPorRegra, type DebitoParaRegra, type Regra } from "@/lib/conciliacao/classificar-regra";

/**
 * Pipeline de classificação de débitos. Função pura: recebe tudo, devolve os
 * baldes. Quem lê e grava é o sync.
 *
 * A ORDEM é o ponto do módulo, e está travada por teste:
 *   1. transferência entre contas próprias (estrutural)
 *   2. documento é CNPJ próprio sem par  -> conta própria fora do sistema (a Caixa, D2)
 *   3. regra de contraparte              -> SUGESTÃO, nunca lançamento (D1)
 *   4. o resto                           -> fila manual
 *
 * Se a etapa 3 rodasse antes da 1, o Pix entre os dois CNPJs — que tem documento
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
};

export function classificarDebitos(entrada: EntradaPipeline): ResultadoPipeline {
  const { pares, ambiguos } = detectarTransferenciasInternas(entrada.debitos, entrada.creditos);

  const resolvidos = new Set(pares.map((p) => p.debitoId));
  const ambiguosIds = new Set(ambiguos.map((a) => a.debitoId));

  const contaPropriaSemPar: ContaPropriaSemPar[] = [];
  const sugestoes: Sugestao[] = [];
  const aClassificar: string[] = [];

  for (const debito of entrada.debitos) {
    if (resolvidos.has(debito.id) || ambiguosIds.has(debito.id)) continue;

    const documento = entrada.documentos[debito.id] ?? null;

    if (documento !== null && entrada.documentosProprios.has(documento)) {
      contaPropriaSemPar.push({ debitoId: debito.id, documento });
      continue;
    }

    const paraRegra: DebitoParaRegra = {
      id: debito.id,
      contaId: debito.contaId,
      data: debito.data,
      valor: debito.valor,
      descricao: entrada.descricoes[debito.id] ?? "",
      documento,
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

  return { transferenciasInternas: pares, ambiguos, contaPropriaSemPar, sugestoes, aClassificar };
}
