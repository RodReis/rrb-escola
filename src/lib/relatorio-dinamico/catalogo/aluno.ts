import type { ColunaDef, TipoColuna } from "../tipos";
import { fmtData, idade, juntar, normalizarTexto, primeiroNome, txt } from "../formatar";

export type AlunoBase = {
  matricula_codigo: string; nome: string; sexo: string | null; data_nascimento: string | null;
  naturalidade: string | null; nacionalidade: string | null; celular: string | null; cpf: string | null;
  rg: string | null; orgao_expedidor: string | null; data_expedicao: string | null;
  certidao_livro: string | null; certidao_folha: string | null; certidao_numero: string | null; certidao_cartorio: string | null;
  email: string | null; codigo_inep: string | null; etnia: string | null;
};
export type MatriculaBase = {
  codigo: string | null; ano_letivo: number; status: string; data_matricula: string | null;
  serie: string | null; segmento: string | null; turma: string | null; turno: string | null;
};
export type ResponsavelRow = {
  nome: string; cpf: string | null; telefone: string | null; celular: string | null; parentesco: string | null;
  email: string | null; responsavel_financeiro: boolean; responsavel_pedagogico: boolean;
};
export type ContatoRow = { nome: string; telefone: string | null; celular: string | null; parentesco: string | null; principal: boolean };
export type EnderecoRow = {
  logradouro: string; numero: string | null; complemento: string | null; bairro: string | null;
  cidade: string | null; uf: string | null; cep: string | null; principal: boolean;
};
export type MedicoRow = {
  alergia_descricao: string | null; necessidade_especial_descricao: string | null; doenca_grave_descricao: string | null;
  remedio_especial_descricao: string | null; tipo_sanguineo: string | null; plano_saude: string | null;
};
export type AlunoCtx = {
  aluno: AlunoBase;
  matricula: MatriculaBase;
  responsaveis: ResponsavelRow[];
  contatos: ContatoRow[];
  enderecos: EnderecoRow[];
  medico: MedicoRow | null;
  numeroChamada: number | null;
  hoje: Date;
};

export const RELACOES_ALUNO = ["responsaveis", "contatos", "enderecos", "medico", "chamada"] as const;

const SEGMENTO: Record<string, string> = { INFANTIL: "Educação Infantil", FUNDAMENTAL1: "Fundamental I", FUNDAMENTAL2: "Fundamental II", MEDIO: "Ensino Médio" };
const TURNO: Record<string, string> = { matutino: "Matutino", vespertino: "Vespertino", noturno: "Noturno", integral: "Integral" };
const STATUS: Record<string, string> = { ativa: "Ativa", cancelada: "Cancelada", transferida: "Transferida", concluida: "Concluída" };

const porParentesco = (c: AlunoCtx, alvo: "pai" | "mae") =>
  c.responsaveis.find((r) => normalizarTexto(r.parentesco) === alvo) ?? null;
const financeiro = (c: AlunoCtx) => c.responsaveis.find((r) => r.responsavel_financeiro) ?? null;
const pedagogico = (c: AlunoCtx) => c.responsaveis.find((r) => r.responsavel_pedagogico) ?? null;
const endereco = (c: AlunoCtx) => c.enderecos.find((e) => e.principal) ?? c.enderecos[0] ?? null;
const cidadeUf = (e: EnderecoRow | null) => (e ? juntar([e.cidade, e.uf]).replace(" / ", " - ") : "");
const digitos = (s: string) => s.replace(/\D/g, "");

function celulares(c: AlunoCtx): string {
  const vistos = new Set<string>();
  const itens: string[] = [];
  for (const p of [...c.responsaveis, ...c.contatos]) {
    // Cai para "telefone" quando "celular" está vazio: mesmo erro de cadastro
    // tratado nas colunas de pai/mãe/responsável (colsPessoa).
    const cel = txt(p.celular) || txt(p.telefone);
    if (!cel || vistos.has(digitos(cel))) continue;
    vistos.add(digitos(cel));
    itens.push([cel, primeiroNome(p.nome), p.parentesco ? `(${txt(p.parentesco)})` : ""].filter(Boolean).join(" - "));
  }
  return itens.join(" / ");
}

function telefones(c: AlunoCtx): string {
  return juntar([...c.responsaveis, ...c.contatos].map((p) => p.telefone));
}

function col(
  key: string, label: string, grupo: string, relacoes: readonly string[],
  resolve: (c: AlunoCtx) => string, tipo: TipoColuna = "texto"
): ColunaDef<AlunoCtx> {
  return { key, label, grupo, relacoes, resolve, tipo };
}

type Pessoa = ResponsavelRow | null;
function colsPessoa(prefixo: string, sufixo: string, grupo: string, pegar: (c: AlunoCtx) => Pessoa): ColunaDef<AlunoCtx>[] {
  const r = ["responsaveis"] as const;
  return [
    col(`${prefixo}.nome`, `Nome ${sufixo}`, grupo, r, (c) => txt(pegar(c)?.nome)),
    col(`${prefixo}.cpf`, `CPF ${sufixo}`, grupo, r, (c) => txt(pegar(c)?.cpf)),
    // Cai para "telefone" quando "celular" está vazio: erro de cadastro comum
    // (número de celular digitado no campo Telefone da ficha do responsável).
    col(`${prefixo}.celular`, `Celular ${sufixo}`, grupo, r, (c) => txt(pegar(c)?.celular) || txt(pegar(c)?.telefone)),
    col(`${prefixo}.telefone`, `Telefone ${sufixo}`, grupo, r, (c) => txt(pegar(c)?.telefone)),
    col(`${prefixo}.email`, `E-mail ${sufixo}`, grupo, r, (c) => txt(pegar(c)?.email)),
  ];
}

const P = "Dados pessoais", C = "Certidão", M = "Matrícula", E = "Endereço", CT = "Contatos", MD = "Saúde";
const END = ["enderecos"] as const, MED = ["medico"] as const;

export const COLUNAS_ALUNO: ColunaDef<AlunoCtx>[] = [
  col("aluno.nome", "Nome Aluno", P, [], (c) => txt(c.aluno.nome)),
  col("aluno.matricula", "Matrícula", P, [], (c) => txt(c.aluno.matricula_codigo)),
  col("aluno.sexo", "Sexo", P, [], (c) => txt(c.aluno.sexo)),
  col("aluno.nascimento", "Data de Nascimento", P, [], (c) => fmtData(c.aluno.data_nascimento), "data"),
  col("aluno.idade", "Idade", P, [], (c) => idade(c.aluno.data_nascimento, c.hoje), "numero"),
  col("aluno.cpf", "CPF do Aluno", P, [], (c) => txt(c.aluno.cpf)),
  col("aluno.rg", "RG do Aluno", P, [], (c) => txt(c.aluno.rg)),
  col("aluno.orgao", "Órgão Expedidor", P, [], (c) => txt(c.aluno.orgao_expedidor)),
  col("aluno.expedicao", "Data de Expedição", P, [], (c) => fmtData(c.aluno.data_expedicao), "data"),
  col("aluno.naturalidade", "Naturalidade", P, [], (c) => txt(c.aluno.naturalidade)),
  col("aluno.nacionalidade", "Nacionalidade", P, [], (c) => txt(c.aluno.nacionalidade)),
  col("aluno.etnia", "Cor/Raça", P, [], (c) => txt(c.aluno.etnia)),
  col("aluno.inep", "Código INEP", P, [], (c) => txt(c.aluno.codigo_inep)),
  col("aluno.email", "E-mail do Aluno", P, [], (c) => txt(c.aluno.email)),
  col("aluno.celular", "Celular do Aluno", P, [], (c) => txt(c.aluno.celular)),
  col("cert.livro", "Certidão - Livro", C, [], (c) => txt(c.aluno.certidao_livro)),
  col("cert.folha", "Certidão - Folha", C, [], (c) => txt(c.aluno.certidao_folha)),
  col("cert.numero", "Certidão - Número", C, [], (c) => txt(c.aluno.certidao_numero)),
  col("cert.cartorio", "Certidão - Cartório", C, [], (c) => txt(c.aluno.certidao_cartorio)),
  col("mat.codigo", "Código da Matrícula", M, [], (c) => txt(c.matricula.codigo)),
  col("mat.ano", "Ano da Matrícula", M, [], (c) => String(c.matricula.ano_letivo), "numero"),
  col("mat.serie", "Série", M, [], (c) => txt(c.matricula.serie)),
  col("mat.turma", "Turma", M, [], (c) => txt(c.matricula.turma)),
  col("mat.turno", "Turno", M, [], (c) => TURNO[c.matricula.turno ?? ""] ?? txt(c.matricula.turno)),
  col("mat.segmento", "Segmento", M, [], (c) => SEGMENTO[c.matricula.segmento ?? ""] ?? txt(c.matricula.segmento)),
  col("mat.status", "Situação da Matrícula", M, [], (c) => STATUS[c.matricula.status] ?? txt(c.matricula.status)),
  col("mat.data", "Data da Matrícula", M, [], (c) => fmtData(c.matricula.data_matricula), "data"),
  col("mat.chamada", "Nº de Chamada", M, ["chamada"], (c) => (c.numeroChamada ? String(c.numeroChamada) : ""), "numero"),
  col("end.logradouro", "Logradouro", E, END, (c) => txt(endereco(c)?.logradouro)),
  col("end.numero", "Número", E, END, (c) => txt(endereco(c)?.numero)),
  col("end.complemento", "Complemento", E, END, (c) => txt(endereco(c)?.complemento)),
  col("end.bairro", "Bairro", E, END, (c) => txt(endereco(c)?.bairro)),
  col("end.cidade", "Cidade", E, END, (c) => txt(endereco(c)?.cidade)),
  col("end.uf", "UF", E, END, (c) => txt(endereco(c)?.uf)),
  col("end.cidadeUf", "Cidade Endereço", E, END, (c) => cidadeUf(endereco(c))),
  col("end.cep", "CEP", E, END, (c) => txt(endereco(c)?.cep)),
  col("end.completo", "Endereço Completo", E, END, (c) => {
    const e = endereco(c);
    if (!e) return "";
    const rua = [e.logradouro, e.numero, e.complemento].map(txt).filter(Boolean).join(", ");
    return [rua, txt(e.bairro), cidadeUf(e), e.cep ? `CEP ${txt(e.cep)}` : ""].filter(Boolean).join(" - ");
  }),
  ...colsPessoa("pai", "do Pai", "Pai", (c) => porParentesco(c, "pai")),
  ...colsPessoa("mae", "da Mãe", "Mãe", (c) => porParentesco(c, "mae")),
  // Sufixo abreviado ("Resp. Financeiro" em vez de "do Responsável Financeiro"):
  // rótulo cheio (33 caracteres) não cabia na largura da etiqueta antes do
  // valor, cortando o número de telefone. Grupo mantém o nome completo.
  ...colsPessoa("rf", "Resp. Financeiro", "Responsável Financeiro", financeiro),
  ...colsPessoa("rp", "Resp. Pedagógico", "Responsável Pedagógico", pedagogico),
  col("cont.celulares", "Celulares", CT, ["responsaveis", "contatos"], celulares),
  col("cont.telefones", "Telefones", CT, ["responsaveis", "contatos"], telefones),
  col("med.alergia", "Alergias", MD, MED, (c) => txt(c.medico?.alergia_descricao)),
  col("med.necessidade", "Necessidade Especial", MD, MED, (c) => txt(c.medico?.necessidade_especial_descricao)),
  col("med.doenca", "Doença Grave", MD, MED, (c) => txt(c.medico?.doenca_grave_descricao)),
  col("med.remedio", "Medicação Especial", MD, MED, (c) => txt(c.medico?.remedio_especial_descricao)),
  col("med.sangue", "Tipo Sanguíneo", MD, MED, (c) => txt(c.medico?.tipo_sanguineo)),
  col("med.plano", "Plano de Saúde", MD, MED, (c) => txt(c.medico?.plano_saude)),
];
