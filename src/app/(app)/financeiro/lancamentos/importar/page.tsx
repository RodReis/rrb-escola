import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ImportarPrevistoForm } from "@/components/finance/importar-previsto-form";
import { requirePermission } from "@/lib/auth/session";

export default async function ImportarPrevistoPage() {
  await requirePermission("financeiro.lancamentos", "create");
  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "Livro-Razão", href: "/financeiro/lancamentos" }, { label: "Importar previsto" }]}
        title="Importar planilha de contas a pagar"
        description="A planilha é organizada em seções (ex.: FORNECEDORES, IMPOSTOS) com o nome do item, contato ou data, e o valor. Cada linha vira um título em aberto; reenviar o mesmo arquivo não duplica."
      />
      <Panel>
        <ImportarPrevistoForm />
      </Panel>
    </div>
  );
}
