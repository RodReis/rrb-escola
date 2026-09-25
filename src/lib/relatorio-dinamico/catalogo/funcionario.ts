import type { ColunaDef, TipoColuna } from "../tipos";
import type { ModuloCodigo } from "@/lib/auth/permissions";
import { fmtData, fmtMoeda, idade, txt } from "../formatar";

export type FuncBase = {
  name: string; cpf: string; birth_date: string | null; hire_date: string | null; email: string | null;
  telefone: string | null; cargo: string | null; school_category: string | null; status_contrato: string | null; ativo: boolean;
};
export type FuncionarioCtx = {
  func: FuncBase;
  empresa: { name: string; nome_fantasia: string | null; cnpj: string } | null;
  contrato: { salario_base: number | null; valor_hora_aula: number | null; aulas_semanais: number | null; data_desligamento: string | null } | null;
  atribuicoes: { disciplina: string; turma: string; serie: string }[];
  usuarioEmail: string | null;
  hoje: Date;
};

export const RELACOES_FUNCIONARIO = ["contrato"] as const;

const CATEGORIA: Record<string, string> = { admin: "Administrativo", fund1: "Fundamental I", fund2: "Fundamental II", medio: "Ensino Médio" };
const SALARIAL: ModuloCodigo = "rh.folha-v2";

export function colF(
  key: string, label: string, grupo: string, relacoes: readonly string[],
  resolve: (c: FuncionarioCtx) => string, tipo: TipoColuna = "texto", permissao?: ModuloCodigo
): ColunaDef<FuncionarioCtx> {
  return { key, label, grupo, relacoes, resolve, tipo, permissao };
}

const D = "Dados pessoais", V = "Vínculo", EM = "Empresa", CT = "Contrato";
const CTR = ["contrato"] as const;

export const COLUNAS_FUNCIONARIO: ColunaDef<FuncionarioCtx>[] = [
  colF("func.nome", "Nome", D, [], (c) => txt(c.func.name)),
  colF("func.cpf", "CPF", D, [], (c) => txt(c.func.cpf)),
  colF("func.nascimento", "Data de Nascimento", D, [], (c) => fmtData(c.func.birth_date), "data"),
  colF("func.idade", "Idade", D, [], (c) => idade(c.func.birth_date, c.hoje), "numero"),
  colF("func.email", "E-mail", D, [], (c) => txt(c.func.email)),
  colF("func.telefone", "Telefone", D, [], (c) => txt(c.func.telefone)),
  colF("func.cargo", "Cargo", V, [], (c) => txt(c.func.cargo)),
  colF("func.categoria", "Categoria", V, [], (c) => CATEGORIA[c.func.school_category ?? ""] ?? ""),
  colF("func.vinculo", "Tipo de Contrato", V, [], (c) => txt(c.func.status_contrato)),
  colF("func.situacao", "Situação", V, [], (c) => (c.func.ativo ? "Ativo" : "Inativo")),
  colF("func.admissao", "Data de Admissão", V, [], (c) => fmtData(c.func.hire_date), "data"),
  colF("emp.nome", "Empresa", EM, [], (c) => txt(c.empresa?.nome_fantasia || c.empresa?.name)),
  colF("emp.razao", "Razão Social", EM, [], (c) => txt(c.empresa?.name)),
  colF("emp.cnpj", "CNPJ da Empresa", EM, [], (c) => txt(c.empresa?.cnpj)),
  colF("ctr.salario", "Salário Base", CT, CTR, (c) => fmtMoeda(c.contrato?.salario_base ?? null), "numero", SALARIAL),
  colF("ctr.horaAula", "Valor Hora-Aula", CT, CTR, (c) => fmtMoeda(c.contrato?.valor_hora_aula ?? null), "numero", SALARIAL),
  colF("ctr.aulas", "Aulas Semanais", CT, CTR, (c) => txt(c.contrato?.aulas_semanais), "numero"),
  colF("ctr.desligamento", "Data de Desligamento", CT, CTR, (c) => fmtData(c.contrato?.data_desligamento ?? null), "data"),
];
