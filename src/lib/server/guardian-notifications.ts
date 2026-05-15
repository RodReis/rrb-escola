type SendGuardianNotificationInput = {
  notificationId: string;
  canal: string;
  telefoneDestino: string | null | undefined;
  mensagem: string;
  alunoId: string;
  eventoAcessoId: string;
};

type SendGuardianNotificationResult = {
  status: "simulada" | "enviada" | "erro";
  providerMessageId?: string | null;
  erro?: string | null;
};

export async function sendGuardianNotification(input: SendGuardianNotificationInput): Promise<SendGuardianNotificationResult> {
  const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL;
  const webhookToken = process.env.WHATSAPP_WEBHOOK_TOKEN;

  if (!input.telefoneDestino) {
    return { status: "erro", erro: "Telefone de destino nao configurado." };
  }

  if (!webhookUrl) {
    return { status: "simulada", providerMessageId: null, erro: null };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(webhookToken ? { Authorization: `Bearer ${webhookToken}` } : {})
      },
      body: JSON.stringify({
        id: input.notificationId,
        canal: input.canal,
        telefone_destino: input.telefoneDestino,
        mensagem: input.mensagem,
        aluno_id: input.alunoId,
        evento_acesso_id: input.eventoAcessoId
      })
    });

    if (!response.ok) {
      const text = await response.text();
      return { status: "erro", erro: text || `Webhook retornou HTTP ${response.status}.` };
    }

    const payload = (await response.json().catch(() => null)) as { id?: string; message_id?: string } | null;
    return { status: "enviada", providerMessageId: payload?.message_id ?? payload?.id ?? null, erro: null };
  } catch (error) {
    return { status: "erro", erro: error instanceof Error ? error.message : "Falha ao enviar notificacao." };
  }
}
