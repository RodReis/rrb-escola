# WhatsApp Inbox (Fase 6) — Follow-up pós-merge

Itens triados na revisão final da branch `feat/whatsapp-inbox` como **aceitáveis para single-school**, a endereçar depois. Nenhum bloqueia o merge.

## Segurança / privacidade

- **TTL de URL de mídia recebida (recomendado priorizar).** `src/lib/whatsapp/inbox-receive.ts` gera signed URL da imagem recebida com validade de **1 ano**. Fotos de responsáveis/alunos são sensíveis. Encurtar o TTL e renovar sob demanda (ou servir via rota autenticada).

## Multi-tenant (só relevante quando houver mais de uma escola)

- **Realtime sem filtro de escola.** `src/components/whatsapp/inbox-client.tsx` assina `pipeline_conversa`/`pipeline_conversa_mensagem` sem `filter: escola_id=eq.…` (o board do pipeline filtra). Hoje inócuo (RLS no canal + escola única); adicionar o filtro ao virar multi-tenant.
- **`casarConversa` lê responsáveis de todas as escolas.** `inbox-receive.ts` consulta `responsaveis_aluno` sem escopo de escola (a tabela não tem `escola_id`); com admin client isso ignora RLS. Escopar via join `responsaveis_aluno → alunos.escola_id` no multi-tenant.
- **`atribuirConversaAction` não valida escola do perfil.** `assigned_to` aceita id cru do client; FK garante existência mas não a escola. Validar que o perfil pertence à escola da sessão.

## Dívida técnica (baixa prioridade)

- **`any` no tipo `SupabaseAdmin`** (`inbox-receive.ts`) e **`supabase as any`** na rota do webhook — tipar quando houver tipos gerados do schema.
- **Extensão `.jpg` fixa** no path do upload de mídia recebida (o `contentType` real é preservado; só o path fica `.jpg`).
- **`JSON.parse(rawBody)` sem try/catch** na rota do webhook (body já autenticado por HMAC; Meta sempre manda JSON).
- **Guard do evento DELETE no realtime** (`inbox-client.tsx`) sai antes do branch DELETE — branch morto (conversas são arquivadas, não deletadas no MVP).
