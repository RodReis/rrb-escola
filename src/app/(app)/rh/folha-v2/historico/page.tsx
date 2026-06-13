import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
        title="Histórico de folhas"
        description="As folhas processadas ficam listadas na tela principal da Folha v2."
      />

      <Card>
        <p className="mb-3 text-sm text-ink/70">
          A folha legada (motor v1) foi descontinuada. Todas as folhas — abertas, em
          andamento e aprovadas — agora ficam centralizadas na Folha v2.
        </p>
        <Link
          href="/rh/folha-v2"
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline"
        >
          Ir para a Folha v2
          <ArrowRight size={14} />
        </Link>
      </Card>
    </div>
  );
}
