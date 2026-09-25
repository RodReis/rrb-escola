import { formatarDataCurta, formatarDataExtenso } from "./certificado-texto";

export type DeclaracaoModelo = { titulo: string; texto: string; fecho: string };

export type DadosDeclaracao = {
  nomeAluno: string;
  matricula: string | null;
  dataNascimento: string | null;
  naturalidade: string | null;
  filiacao: string | null;
  anoLetivo: number;
  serieCorrente: string;
  turma: string;
  turno: string;
  proximaSerie: string | null;
  nomeEmpresa: string;
  cidadeEmpresa: string | null;
  dataEmissaoIso: string;
};

export type DeclaracaoResolvida = { titulo: string; texto: string; fecho: string };

/**
 * `alunos.naturalidade` é salva como "Cidade - UF" (texto livre, ver
 * `certidao-*`/histórico). Parse best-effort: sem " - " devolve tudo como
 * cidade e UF vazia, em vez de quebrar.
 */
function parseNaturalidade(naturalidade: string | null): { cidade: string; uf: string } {
  if (!naturalidade) return { cidade: "", uf: "" };
  const partes = naturalidade.split(" - ");
  if (partes.length >= 2) return { cidade: partes[0].trim(), uf: partes[1].trim() };
  return { cidade: naturalidade.trim(), uf: "" };
}

function valoresParaTokens(dados: DadosDeclaracao): Record<string, string> {
  const { cidade, uf } = parseNaturalidade(dados.naturalidade);
  const dataExtenso = formatarDataExtenso(dados.dataEmissaoIso);

  return {
    NOME_ALUNO: dados.nomeAluno,
    MATRICULA: dados.matricula ?? "",
    DATA_NASCIMENTO: formatarDataCurta(dados.dataNascimento),
    CIDADE: cidade,
    UF: uf,
    FILIACAO: dados.filiacao ?? "",
    ANO_LETIVO: String(dados.anoLetivo),
    SERIE_CORRENTE: dados.serieCorrente,
    TURMA: dados.turma,
    TURNO: dados.turno,
    PROXIMA_SERIE: dados.proximaSerie ?? "",
    EMPRESA: dados.nomeEmpresa,
    DATA_POR_EXTENSO_COM_CIDADE: dados.cidadeEmpresa ? `${dados.cidadeEmpresa}, ${dataExtenso}` : dataExtenso,
    DATA_POR_EXTENSO_SEM_CIDADE: dataExtenso
  };
}

export const PARAMETROS_SUPORTADOS: readonly string[] = [
  "NOME_ALUNO", "MATRICULA", "DATA_NASCIMENTO", "CIDADE", "UF", "FILIACAO",
  "ANO_LETIVO", "SERIE_CORRENTE", "TURMA", "TURNO", "PROXIMA_SERIE",
  "EMPRESA", "DATA_POR_EXTENSO_COM_CIDADE", "DATA_POR_EXTENSO_SEM_CIDADE"
];

const REGEX_TOKEN = /\[([A-Z_]+)\]/g;

export function validarParametros(texto: string): { valido: true } | { valido: false; tokenInvalido: string } {
  const suportados = new Set(PARAMETROS_SUPORTADOS);
  const re = new RegExp(REGEX_TOKEN);
  let achado: RegExpExecArray | null;
  while ((achado = re.exec(texto)) !== null) {
    if (!suportados.has(achado[1])) {
      return { valido: false, tokenInvalido: achado[0] };
    }
  }
  return { valido: true };
}

function substituirTokens(texto: string, valores: Record<string, string>): string {
  return texto.replace(REGEX_TOKEN, (match, chave: string) => valores[chave] ?? match);
}

export function resolverDeclaracao(modelo: DeclaracaoModelo, dados: DadosDeclaracao): DeclaracaoResolvida {
  const valores = valoresParaTokens(dados);
  return {
    titulo: substituirTokens(modelo.titulo, valores),
    texto: substituirTokens(modelo.texto, valores),
    fecho: substituirTokens(modelo.fecho, valores)
  };
}
