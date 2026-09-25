import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { catalogoMeta, filtrarColunasPorPermissao, getCatalogo } from "@/lib/relatorio-dinamico/catalogo";
import { listarEmpresasRelatorio, listarTemplates, opcoesRh } from "@/lib/relatorio-dinamico/dados/opcoes";
import { RelatorioRhClient } from "./relatorio-rh-client";

const MODULO = "relatorios.dinamico-funcionario" as const;

export default async function RelatorioDinamicoFuncionariosPage() {
  const session = await requirePermission(MODULO, "read");
  const isAdmin = session.profile.perfil === "admin";
  const [templates, empresas, opcoes] = await Promise.all([listarTemplates("funcionario"), listarEmpresasRelatorio(), opcoesRh()]);
  const colunas = catalogoMeta(filtrarColunasPorPermissao(getCatalogo("funcionario"), session.permissions, isAdmin));
  const pode = (a: "create" | "update" | "delete") => isAdmin || can(session.permissions, MODULO, a);

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "Relatórios", href: "/" }, { label: "Etiquetas / relatórios dinâmicos - funcionário" }]}
        title="Emissão de Etiquetas/Relatórios Dinâmicos - Funcionário"
      />
      <Panel className="p-6">
        <RelatorioRhClient entidade="funcionario" colunas={colunas} templates={templates} empresas={empresas} opcoes={opcoes}
          permissoes={{ criar: pode("create"), editar: pode("update"), excluir: pode("delete") }} />
      </Panel>
    </div>
  );
}
