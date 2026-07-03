import { Webhook, Save, Send, Code2, FlaskConical } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { testWebhookAction, updateWebhookAction } from "@/lib/actions/webhook";

export default async function WebhookConfigPage() {
  const session = await requirePermission("configuracoes.webhook", "read");
  const supabase = await createServerClient();

  const { data: escola } = await supabase
    .from("escolas")
    .select("webhook_url, webhook_ativo")
    .eq("id", session.profile.escola_id)
    .maybeSingle();

  const url = escola?.webhook_url ?? "";
  const ativo = !!escola?.webhook_ativo;

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "Configurações" }, { label: "Webhook" }]}
        title="Webhook de notificações críticas"
        description="Envia POST para URL externa quando notificação crítica é criada. Conecte Make/Zapier/N8N/Email."
      />

      <Panel className="grid gap-4">
        <div className="flex items-center gap-2">
          <Webhook size={16} className="text-brand" />
          <h2 className="font-bold text-ink">Configuração</h2>
        </div>

        <form action={updateWebhookAction} className="grid gap-4">
          <label>
            URL do webhook
            <input
              type="url"
              name="webhook_url"
              defaultValue={url}
              placeholder="https://hook.make.com/abc123..."
              className="font-mono text-sm"
            />
          </label>
          <label className="flex items-center gap-3 rounded-ui border border-line bg-surface p-3">
            <input name="webhook_ativo" type="checkbox" defaultChecked={ativo} className="h-4 w-4" />
            <span className="font-semibold text-ink">Ativar webhook</span>
            <span className="ml-auto text-xs text-ink/60">
              Quando ativo, envia POST a cada notificação crítica
            </span>
          </label>
          <div className="flex justify-end">
            <button className="ds-button ds-button-primary">
              <Save size={14} /> Salvar
            </button>
          </div>
        </form>
      </Panel>

      {url && (
        <Panel className="grid gap-3">
          <h3 className="flex items-center gap-2 font-bold text-ink">
            <FlaskConical size={16} className="text-brand" />
            Testar webhook
          </h3>
          <p className="text-sm text-ink/60">
            Dispara um POST de teste com severidade crítica para a URL configurada.
          </p>
          <form action={testWebhookAction}>
            <button className="ds-button ds-button-secondary">
              <Send size={14} /> Enviar teste
            </button>
          </form>
        </Panel>
      )}

      <Panel className="grid gap-3">
        <h3 className="flex items-center gap-2 font-bold text-ink">
          <Code2 size={16} className="text-brand" />
          Payload enviado
        </h3>
        <pre className="overflow-x-auto rounded-ui bg-muted/40 p-4 text-xs text-ink">
{`{
  "escola": "Nome da escola",
  "escola_id": "uuid",
  "emitido_em": "2026-05-17T12:34:56.789Z",
  "tipo": "cobranca_vencendo | aniversario_hoje | inadimplencia_alta | ...",
  "titulo": "Título da notificação",
  "descricao": "Detalhes",
  "href": "/alunos/abc123" (opcional),
  "severidade": "critico"
}`}
        </pre>
      </Panel>
    </div>
  );
}
