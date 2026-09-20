import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import {
  CERTIFICADO_DEFAULTS,
  type CertificadoEscola,
  type CertificadoLeiaute,
  type LinhaAssinatura
} from "@/lib/documents/certificado-tipos";
import { getCredenciamentoVigente } from "@/lib/data/historico";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Dados do certificado de conclusão. Só o que é dele: a configuração e o
 * cabeçalho. Os alunos elegíveis vêm de `listarElegiveis`
 * (`@/lib/data/historico-elegiveis`) e o histórico do verso, de
 * `carregarHistoricosAction` — os dois documentos compartilham a fonte.
 */
export type CertificadoConfig = {
  tituloCertificado: string;
  textoInicio: string;
  descricaoCurso: string;
  baseLegal: string;
  textoCustomizado: string | null;
  mostrarHistorico: boolean;
  leiaute: CertificadoLeiaute;
  assinaturas: LinhaAssinatura[];
};

const CONFIG_PADRAO: CertificadoConfig = {
  tituloCertificado: "Certificado",
  textoInicio: "A Diretora da",
  descricaoCurso: "ENSINO MÉDIO",
  baseLegal:
    "sob a Resolução CEE/CEB N.01, de 14 de janeiro de 2022 de acordo com a Lei Nº 9394 de 20 de dezembro de 1996.",
  textoCustomizado: null,
  mostrarHistorico: true,
  leiaute: CERTIFICADO_DEFAULTS.leiaute,
  assinaturas: CERTIFICADO_DEFAULTS.assinaturas
};

export async function getCertificadoConfig(
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<CertificadoConfig> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("certificado_config")
    .select("*")
    .eq("escola_id", escolaId)
    .maybeSingle();

  if (!data) return CONFIG_PADRAO;

  const leiaute = (data.leiaute ?? {}) as Partial<CertificadoLeiaute>;
  const assinaturas = (data.assinaturas ?? []) as LinhaAssinatura[];

  return {
    tituloCertificado: (data.titulo_certificado as string) ?? CONFIG_PADRAO.tituloCertificado,
    textoInicio: (data.texto_inicio as string) ?? CONFIG_PADRAO.textoInicio,
    descricaoCurso: (data.descricao_curso as string) ?? CONFIG_PADRAO.descricaoCurso,
    baseLegal: (data.base_legal as string) ?? CONFIG_PADRAO.baseLegal,
    textoCustomizado: (data.texto_customizado as string) ?? null,
    mostrarHistorico: Boolean(data.mostrar_historico),
    // Merge com o padrão: config salva antes de um campo novo de leiaute
    // existir não o traria, e o gerador receberia undefined.
    leiaute: { ...CERTIFICADO_DEFAULTS.leiaute, ...leiaute },
    assinaturas: assinaturas.length > 0 ? assinaturas : CERTIFICADO_DEFAULTS.assinaturas
  };
}

/**
 * Cabeçalho do certificado, resolvido pela série e ano da turma que está
 * concluindo. Usa `getCredenciamentoVigente`, a mesma fonte do cabeçalho do
 * histórico: se o certificado lesse `escolas` direto, os dois documentos do
 * mesmo aluno sairiam com dados de escola diferentes.
 *
 * Sem série (nenhum filtro aplicado ainda) devolve um cabeçalho vazio — o
 * gerador omite as linhas ausentes em vez de imprimir "null".
 */
export async function getEscolaCertificado(
  serieId: string | null,
  ano: number
): Promise<CertificadoEscola> {
  const vazio: CertificadoEscola = {
    razaoSocial: "",
    nomeFantasia: "",
    cnpj: null,
    resolucao: null,
    endereco: null,
    cidade: null,
    uf: null,
    cep: null,
    logoPath: null
  };

  if (!serieId) return vazio;

  const credenciamento = await getCredenciamentoVigente(serieId, ano);
  if (!credenciamento) return vazio;

  return {
    razaoSocial: credenciamento.razaoSocial,
    nomeFantasia: credenciamento.nomeFantasia,
    cnpj: credenciamento.cnpj,
    resolucao: credenciamento.resolucao,
    endereco: credenciamento.endereco,
    cidade: credenciamento.cidade,
    uf: credenciamento.uf,
    cep: credenciamento.cep,
    logoPath: credenciamento.logoPath
  };
}
