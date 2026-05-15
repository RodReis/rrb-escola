export type StudentSheet = {
  id: string;
  matricula_codigo: string;
  nome: string;
  sexo: string | null;
  data_nascimento: string | null;
  naturalidade: string | null;
  celular: string | null;
  cpf: string | null;
  rg: string | null;
  certidao_nascimento: string | null;
  certidao_livro: string | null;
  certidao_folha: string | null;
  certidao_numero: string | null;
  certidao_cartorio: string | null;
  email: string | null;
  codigo_inep: string | null;
  etnia: string | null;
  informacoes_adicionais: string | null;
  foto_url: string | null;
  enderecos_aluno: Array<{
    id: string;
    logradouro: string;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
    cep: string | null;
  }>;
  contatos_aluno: Array<{
    id: string;
    nome: string;
    telefone: string | null;
    celular: string | null;
    parentesco: string | null;
  }>;
  responsaveis_aluno: Array<{
    id: string;
    nome: string;
    cpf: string | null;
    telefone: string | null;
    celular: string | null;
    parentesco: string | null;
    email: string | null;
  }>;
  pessoas_autorizadas: Array<{
    id: string;
    nome: string;
    telefone: string | null;
    observacao: string | null;
  }>;
  informacoes_medicas: {
    id: string;
    alergia: boolean;
    necessidade_especial: boolean;
    necessita_apoio: boolean;
    doenca_grave: boolean;
    remedio_especial: boolean;
    tipo_sanguineo: string | null;
    medico: string | null;
    telefone_medico: string | null;
    plano_saude: string | null;
    telefone_plano: string | null;
  } | null;
  autorizacoes_aluno: {
    id: string;
    nao_entregar_boletim: boolean;
    assinar_comunicados: boolean;
    requerer_prova_substitutiva: boolean;
  } | null;
  matriculas: Array<{
    id: string;
    codigo: string | null;
    data_matricula: string;
    ano_letivo: number;
    idade_na_matricula: number | null;
    status: string;
    observacoes: string | null;
    series: { nome: string } | null;
    turmas: { nome: string } | null;
    planos: { nome: string } | null;
  }>;
};
