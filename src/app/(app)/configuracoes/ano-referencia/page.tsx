import { CalendarClock, CheckCircle2 } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { AnoReferenciaToggle } from "@/components/configuracoes/ano-referencia-toggle";

export const dynamic = "force-dynamic";

const SUCESSOS: Record<string, string> = {
  salvo: "Ano de referência atualizado.",
};

export default async function AnoReferenciaConfigPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await requirePermission("configuracoes.escola", "read");
  const sp = await searchParams;
  const supabase = await createServerClient();

  const { data: escola } = await supabase
    .from("escolas")
    .select("ano_referencia_atual")
    .eq("id", session.profile.escola_id)
    .maybeSingle();

  const sucessoKey = Object.keys(SUCESSOS).find((k) => sp[k]);
  const sucMsg = sucessoKey ? SUCESSOS[sucessoKey] : null;

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "Configurações" }, { label: "Mudança do ano de referência" }]}
        title="Mudança do ano de referência"
        description="Define o ano letivo que o sistema usa como padrão em toda tela e documento."
      />

      {sucMsg && (
        <div className="flex items-center gap-2 rounded-ui bg-success/10 p-3 text-sm font-semibold text-success">
          <CheckCircle2 size={16} /> {sucMsg}
        </div>
      )}

      <Panel className="grid gap-4">
        <div className="flex items-center gap-2">
          <CalendarClock size={16} className="text-brand" />
          <h2 className="font-bold text-ink">Ano de referência</h2>
        </div>

        <label className="max-w-xs">
          Ano de referência atual
          <input value={escola?.ano_referencia_atual ?? "—"} readOnly disabled />
        </label>

        <AnoReferenciaToggle />
      </Panel>

      <Panel className="grid gap-3 text-sm text-ink/80">
        <div>
          <h3 className="font-bold text-ink">Por quê realizar a mudança de referência?</h3>
          <p>
            A mudança de referência é necessária, pois o ano letivo atual é utilizado em
            diversas funções do sistema, inclusive sendo este o ano já selecionado
            automaticamente pelo sistema.
          </p>
        </div>
        <div>
          <h3 className="font-bold text-ink">Quando devo realizar a mudança de referência?</h3>
          <p>
            A mudança de referência deve ser feita sempre após conclusão do ano letivo
            corrente. Geralmente é feita após fechamento das notas finais do ano. Sugerimos
            que a mudança de referência seja feita no início de cada ano letivo.
          </p>
        </div>
        <div>
          <h3 className="font-bold text-ink">O que acontece após a mudança de referência?</h3>
          <p>
            Após a mudança de referência o sistema considerará o novo ano letivo como sendo
            o atual, desta forma todas as funcionalidades considerarão o ano letivo
            selecionado sendo o atual.
          </p>
        </div>
      </Panel>
    </div>
  );
}
