import type { SicoobExtratoItem } from "@/lib/sicoob/extrato";

/**
 * Documento da contraparte de um movimento do extrato.
 *
 * Medido em produção em 24/09/2026 sobre 1.294 itens: `cpfCnpj` aparece em 2;
 * o documento de verdade vem em `descInfComplementar`, entre os delimitadores
 * `|@`, e só nos dois tipos de Pix emitido — 786 dos 1.169 débitos. Título
 * compensado, cheque, convênios e tributos não trazem contraparte nenhuma.
 *
 * Dois formatos:
 *   "Pagamento Pix|@01.816.875 0001-29|@"  -> CNPJ completo, 14 dígitos
 *   "Pagamento Pix|@***.246.701-**|@"      -> CPF mascarado PELO BANCO, 6 dígitos
 *
 * A máscara do CPF é estável (o mesmo CPF gera sempre a mesma string), então os
 * 6 dígitos servem de chave de regra. São as posições 4 a 9 do documento, o que
 * permite cruzar com o cadastro aplicando a mesma máscara — sem guardar CPF de
 * terceiro em lugar nenhum.
 */
export function extrairDocumentoContraparte(item: SicoobExtratoItem): string | null {
  const complementar = item.descInfComplementar;

  if (typeof complementar === "string") {
    const entre = complementar.match(/\|@([^|]*)/)?.[1];
    if (entre !== undefined) {
      const digitos = entre.replace(/\D/g, "");
      if (digitos.length > 0) return digitos;
    }
  }

  if (typeof item.cpfCnpj === "string") {
    const digitos = item.cpfCnpj.replace(/\D/g, "");
    if (digitos.length > 0) return digitos;
  }

  return null;
}

/**
 * Máscara do banco aplicada a um documento completo, para cruzar o cadastro
 * com o que vem do extrato. CPF vira os 6 dígitos do meio; CNPJ fica inteiro.
 */
export function chaveDeDocumento(documento: string): string {
  const d = documento.replace(/\D/g, "");
  return d.length === 11 ? d.slice(3, 9) : d;
}
