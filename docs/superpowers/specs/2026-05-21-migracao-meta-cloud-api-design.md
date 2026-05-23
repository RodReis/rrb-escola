# Migração WhatsApp para Meta Cloud API — Design

**Data:** 2026-05-21
**Contexto:** Sub-projeto A da expansão do WhatsApp (ver nota de decomposição abaixo).

## Decomposição

O uso de WhatsApp na escola tem dois cenários:

- **Portaria** — notificação de entrada/saída do aluno ao responsável, com foto.
  ~1500 mensagens/dia. Iniciam conversa.
- **Comunicados e lembretes** — avisos esporádicos e cobrança de inadimplência.

O volume da portaria (1500/dia) torna inviável o provedor não-oficial (Evolution/Baileys),
que seria banido. A decisão foi **migrar tudo para a Meta Cloud API** (WhatsApp Business
oficial). Isso se divide em sub-projetos:

- **A (este spec):** migrar a camada de mensageria de Evolution para Meta Cloud API.
  Comunicados e lembretes passam a usar Meta. É a base.
- **B (futuro):** notificação de entrada/saída da portaria.
- **C (futuro):** filtro de comunicados por turma.

## Objetivo

Substituir a integração Evolution API pela Meta Cloud API (WhatsApp Business oficial) na
camada de mensageria. Comunicados e lembretes passam a enviar via templates aprovados
pela Meta.

## Contexto

- Camada atual: `src/lib/whatsapp/` — `evolution.ts` (cliente, `sendWhatsApp` +
  `sendWhatsAppMedia`), `send.ts` (`enviarWhatsApp` + log em `mensagens_whatsapp`),
  `telefone.ts` (normalização — sem mudança).
- Consumidores: `src/lib/comunicados/processar.ts` e `src/lib/lembretes/processar.ts`.
- A Frente 4b criou um template de lembrete editável (`escolas.lembrete_template`,
  tela `/configuracoes/lembretes`).
- A Meta Cloud API **não envia texto livre que inicie conversa** — exige um template
  pré-aprovado pela Meta. Texto livre só dentro da janela de 24h (resposta a quem
  escreveu recentemente).

## Decisões de escopo

- **Templates fixos no código** — comunicado e lembrete usam templates Meta aprovados,
  nomes em env. O admin não cria templates pelo sistema; a aprovação é feita uma vez no
  Meta Business Manager (fora do código).
- **Config via env** — token, phone number ID e nomes de template em variáveis de
  ambiente.
- **Evolution removido** — `evolution.ts` é apagado, envs `EVOLUTION_*` removidas.
- **Template editável de lembrete removido** — com a Meta, o texto do lembrete é um
  template aprovado fixo. A tela `/configuracoes/lembretes` perde o campo de texto,
  mantém só o toggle de envio automático. A coluna `escolas.lembrete_template` fica
  obsoleta (não é dropada, apenas ignorada).

## Arquitetura

### Cliente Meta — `src/lib/whatsapp/meta.ts` (novo, `server-only`)

Substitui `evolution.ts`. Chama
`POST https://graph.facebook.com/v21.0/{META_PHONE_NUMBER_ID}/messages`,
header `Authorization: Bearer {META_WHATSAPP_TOKEN}`.

Tipo de retorno: `MetaResult = { ok: true; providerMessageId: string } | { ok: false; reason: string }`.

Config lida do env por uma função `getConfig()` — se faltar `META_WHATSAPP_TOKEN` ou
`META_PHONE_NUMBER_ID`, retorna `{ ok: false, reason: "Meta WhatsApp não configurada" }`
(degrada graciosamente, igual ao padrão de `resend.ts`).

Duas funções exportadas:

**`sendTemplate({ telefone, templateName, idioma, variaveis, imagemUrl? })`**
- Envia uma mensagem de template aprovado — **inicia conversa**. Usado por comunicado e
  lembrete.
- `variaveis: string[]` — preenchem os parâmetros `{{1}}`, `{{2}}`… do corpo do template.
- `imagemUrl?: string` — quando o template tem header de imagem.
- Body Meta:
  `{ messaging_product: "whatsapp", to, type: "template", template: { name, language: { code: idioma }, components } }`.
- `components` é montado pela função pura `montarComponentsTemplate` (ver Testes).

**`sendText({ telefone, mensagem })`**
- Texto livre — só funciona dentro da janela de 24h. Não inicia conversa.
- Mantido para uso futuro (resposta a quem escreveu). Comunicado e lembrete **não** usam.

### Função pura — `montarComponentsTemplate(variaveis, imagemUrl?)`

Monta o array `components` do payload Meta:
- Se `imagemUrl` presente → adiciona um component `header` do tipo `image`.
- Sempre adiciona um component `body` com os `parameters` de texto (um por variável).
- Função pura, testável isoladamente.

### Camada de envio — `src/lib/whatsapp/send.ts` (modificado)

`enviarWhatsApp` deixa de receber `mensagem` livre e passa a receber um template:

```
EnviarWhatsAppParams = {
  telefone: string;
  templateName: string;
  variaveis: string[];
  imagemUrl?: string;
  textoLog: string;      // texto legível para gravar no log mensagens_whatsapp
  alunoId?: string;
  referenciaTipo?: string;
  referenciaId?: string;
}
```

- `textoLog` — como o template é renderizado pela Meta, o sistema não tem o texto final;
  grava em `mensagens_whatsapp.mensagem` uma versão legível montada pelo chamador (para
  exibição na tela de detalhe do comunicado / histórico).
- Mantém o parâmetro opcional `supabaseClient` (Frente 4b — para o contexto de cron).
- Chama `meta.sendTemplate`; grava log `pendente` → `enviada`/`falha`, igual hoje.

### Consumidores

**`src/lib/comunicados/processar.ts`** — envia via template `META_TEMPLATE_COMUNICADO`.
A mensagem do comunicado vira a variável `{{1}}`. `imagemUrl` do comunicado vai no header
do template (se houver). `textoLog` = a própria mensagem do comunicado.

**`src/lib/lembretes/processar.ts`** — envia via template `META_TEMPLATE_LEMBRETE`.
Variáveis: nome do responsável, nome do aluno, valor, vencimento (na ordem do template).
`textoLog` = uma frase legível montada com esses dados, para o histórico.
Deixa de usar `montar-mensagem.ts`.

### Remoções

- `src/lib/whatsapp/evolution.ts` — apagado.
- `src/lib/lembretes/montar-mensagem.ts` + `.test.ts` — apagados (a Meta monta o texto a
  partir do template aprovado; o sistema só fornece as variáveis).
- `src/lib/actions/lembretes.ts` — `salvarConfigLembretesAction` deixa de gravar
  `lembrete_template` (grava só `lembrete_auto_ativo`).
- Tela `/configuracoes/lembretes` e `config-lembretes-form.tsx` — removem o textarea do
  template e a lista de placeholders; mantêm o toggle e o botão de envio manual.

## Variáveis de ambiente

**Adicionar:**
```
META_WHATSAPP_TOKEN=
META_PHONE_NUMBER_ID=
META_TEMPLATE_LEMBRETE=lembrete_cobranca
META_TEMPLATE_COMUNICADO=comunicado_escola
```

**Remover** (do `.env.local` e da Vercel):
```
EVOLUTION_API_URL
EVOLUTION_API_KEY
EVOLUTION_INSTANCE
```

## Templates Meta (pré-requisito externo — feito pelo usuário no Meta Business Manager)

Dois templates, categoria "Utility", idioma `pt_BR`, a aprovar antes de usar em produção:

1. **`lembrete_cobranca`** — corpo com 4 variáveis:
   `Olá {{1}}, a mensalidade de {{2}} no valor de {{3}}, vencida em {{4}}, está em aberto. Por favor, regularize. Em caso de dúvida, entre em contato com a escola.`

2. **`comunicado_escola`** — corpo com 1 variável (a mensagem inteira), header de imagem
   opcional:
   `{{1}}`

Sem os templates aprovados, a Meta rejeita o envio — a camada degrada graciosamente
(log `falha`, sem quebrar o app).

## Banco de dados

Sem migração. `mensagens_whatsapp` permanece igual. `escolas.lembrete_template` fica
obsoleta — não é dropada (evita migração desnecessária); o código simplesmente para de
ler/escrever nessa coluna.

## Testes

Unit (Vitest):
- `montarComponentsTemplate` — com imagem (header + body); sem imagem (só body);
  variáveis vazias; várias variáveis na ordem correta.
- `telefone.ts` — testes existentes permanecem (normalização não muda).

O cliente `meta.ts` (I/O HTTP) e os `processar.ts` são validados manualmente com token
e templates configurados.

## Fora de escopo

- Notificação de entrada/saída da portaria (Sub-projeto B).
- Filtro de comunicados por turma (Sub-projeto C).
- Cadastro/gestão de templates Meta pelo sistema (templates são fixos, aprovados na Meta).
- Recebimento de mensagens / webhook de entrada da Meta.
- Drop da coluna `escolas.lembrete_template`.
