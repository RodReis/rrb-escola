import type { HistoricoAluno, HistoricoCredenciamento } from "@/lib/historico/tipos";

/**
 * Tipos do certificado de conclusão. Os dados do aluno e da escola derivam do
 * histórico escolar (`@/lib/historico/tipos`) em vez de serem redeclarados: os
 * dois documentos saem da mesma fonte e não podem divergir.
 */

/**
 * Uma linha de assinatura do rodapé. `ehAluno` marca a linha cujo nome não é
 * fixo na config — é preenchido por página com o nome do aluno daquele
 * certificado, porque um lote emite vários alunos de uma vez com a mesma
 * config de assinaturas. `ehSecretario`/`ehDiretor` marcam as linhas cujo
 * nome, quando vazio, é sugerido a partir do cadastro da escola
 * (`companies.secretario_nome`/`diretor_nome`) assim que ela é conhecida.
 */
export type LinhaAssinatura = {
  nome: string;
  cargo: string;
  ehAluno?: boolean;
  ehSecretario?: boolean;
  ehDiretor?: boolean;
};

export type CertificadoLeiaute = {
  orientacao: "landscape" | "portrait";
  /**
   * Margem em milímetros — é a unidade em que a secretária pensa. O gerador
   * converte para pontos, porque o documento nasce em `pt` (ver
   * `certificado-pdf.ts`).
   */
  margemMm: number;
  fonteCorpoPt: number;
  mostrarLogos: boolean;
  mostrarMoldura: boolean;
};

export type CertificadoOptions = {
  tituloCertificado: string;
  textoInicio: string;
  descricaoCurso: string;
  baseLegal: string;
  anoConclusao: number;
  /** ISO `YYYY-MM-DD`. */
  dataEmissao: string;
  /** Quando preenchido, substitui o parágrafo padrão. Aceita `{{aluno}}` etc. */
  textoCustomizado: string | null;
  /** Liga o histórico escolar como verso (página par). */
  mostrarHistorico: boolean;
  leiaute: CertificadoLeiaute;
  assinaturas: LinhaAssinatura[];
};

/**
 * O aluno do certificado é o do histórico mais o vínculo da matrícula.
 * `filiacao` já vem como string única ("PAI e MÃE"), montada por
 * `@/lib/historico/filiacao`.
 */
export type CertificadoAluno = HistoricoAluno & {
  matriculaId: string;
  serie: string;
  turma: string;
  anoLetivo: number;
};

/**
 * Cabeçalho do certificado. Vem de `companies` via `getCredenciamentoVigente`,
 * a mesma fonte do cabeçalho do histórico — por isso é um subconjunto do
 * credenciamento, e não um tipo paralelo.
 *
 * Nota: `companies` não tem coluna de mantenedora; `razaoSocial` e
 * `nomeFantasia` recebem ambos `companies.name`.
 */
export type CertificadoEscola = Pick<
  HistoricoCredenciamento,
  | "razaoSocial"
  | "nomeFantasia"
  | "cnpj"
  | "resolucao"
  | "endereco"
  | "cidade"
  | "uf"
  | "cep"
  | "logoPath"
  | "secretarioNome"
  | "secretarioCargo"
  | "diretorNome"
  | "diretorCargo"
>;

export type CertificadoData = {
  escola: CertificadoEscola;
  aluno: CertificadoAluno;
};

export const CERTIFICADO_DEFAULTS: {
  leiaute: CertificadoLeiaute;
  assinaturas: LinhaAssinatura[];
} = {
  leiaute: {
    orientacao: "landscape",
    margemMm: 15,
    fonteCorpoPt: 11,
    mostrarLogos: true,
    mostrarMoldura: true
  },
  assinaturas: [
    { nome: "", cargo: "Aluno(a)", ehAluno: true },
    { nome: "", cargo: "Secretária", ehSecretario: true },
    { nome: "", cargo: "Diretora", ehDiretor: true }
  ]
};
