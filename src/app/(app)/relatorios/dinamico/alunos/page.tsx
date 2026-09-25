import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { catalogoMeta, filtrarColunasPorPermissao, getCatalogo } from "@/lib/relatorio-dinamico/catalogo";
import { listarEmpresasRelatorio, listarTemplates, opcoesAluno } from "@/lib/relatorio-dinamico/dados/opcoes";
import { RelatorioAlunosClient } from "./relatorio-alunos-client";

const MODULO = "relatorios.dinamico-aluno" as const;

export default async function RelatorioDinamicoAlunosPage() {
  const session = await requirePermission(MODULO, "read");
  const isAdmin = session.profile.perfil === "admin";
  const [templates, empresas, opcoes] = await Promise.all([listarTemplates("aluno"), listarEmpresasRelatorio(), opcoesAluno()]);
  const colunas = catalogoMeta(filtrarColunasPorPermissao(getCatalogo("aluno"), session.permissions, isAdmin));
  const pode = (a: "create" | "update" | "delete") => isAdmin || can(session.permissions, MODULO, a);

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "Relatórios", href: "/" }, { label: "Etiquetas / relatórios dinâmicos - aluno" }]}
        title="Emissão de Etiquetas/Relatórios Dinâmicos - Aluno"
      />
      <Panel className="p-6">
        <RelatorioAlunosClient colunas={colunas} templates={templates} empresas={empresas} opcoes={opcoes}
          permissoes={{ criar: pode("create"), editar: pode("update"), excluir: pode("delete") }} />
      </Panel>
    </div>
  );
}
