import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function HistoricoPage() {
  await requirePermission("rh.folha-v2", "read");

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "RH", href: "/rh/funcionarios" },
          { label: "Folha v2", href: "/rh/folha-v2" },
          { label: "Histórico" },
        ]}
        title="Histórico — Folha Legada"
        description="Registros da folha anterior (motor v1 / payroll)."
      />

      <Card>
        <p className="mb-3 text-sm text-ink/70">
          O histórico de pagamentos anteriores está disponível na tela da folha legada.
          Essa tela utiliza o motor v1 (<code className="text-xs bg-muted px-1 rounded">payroll</code>) e é somente-leitura para fins de consulta.
        </p>
        <Link
          href="/financeiro/folha"
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline"
        >
          <ExternalLink size={14} />
          Abrir folha legada (v1)
        </Link>
      </Card>
    </div>
  );
}
