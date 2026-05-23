# Integracao da Portaria Facial

Esta fase deixa o app pronto para receber eventos de um modulo de camera/reconhecimento facial.

## Endpoint

`POST /api/portaria/evento`

Para sincronizar referencias faciais autorizadas:

`GET /api/portaria/biometrias`

## Autenticacao

Enviar uma das opcoes:

```http
Authorization: Bearer dev-gate-token-change-me
```

ou:

```http
x-gate-api-token: dev-gate-token-change-me
```

O valor vem de `GATE_API_TOKEN`.

Para evitar eventos duplicados da mesma camera em poucos segundos, configure:

```env
GATE_EVENT_COOLDOWN_SECONDS=120
```

Dentro desse intervalo, uma nova `entrada` repetida do mesmo aluno e uma nova `saida` repetida do mesmo aluno sao ignoradas. Entrada e saida continuam independentes.

## Payload

```json
{
  "aluno_id": "40000000-0000-0000-0000-000000000001",
  "tipo": "entrada",
  "dispositivo_id": "50000000-0000-0000-0000-000000000001",
  "origem": "facial",
  "confianca": 98.7,
  "observacao": "Reconhecido pela camera principal",
  "foto_base64": "<imagem capturada em base64, opcional>"
}
```

`foto_base64`: foto capturada na portaria, em base64 (JPEG ou PNG). Quando presente, a imagem e subida no Storage e enviada junto da notificacao WhatsApp; se ausente ou se o upload falhar, a notificacao e enviada sem foto.

`tipo` aceita `entrada` ou `saida`.

## Sincronizacao de biometrias

O endpoint `GET /api/portaria/biometrias` retorna somente alunos ativos, com consentimento biometrico autorizado e referencia facial ativa.

Exemplo:

```bash
curl http://localhost:3001/api/portaria/biometrias \
  -H "Authorization: Bearer dev-gate-token-change-me"
```

Resposta:

```json
{
  "ok": true,
  "generated_at": "2026-05-14T10:00:00.000Z",
  "expires_in_seconds": 1800,
  "total": 1,
  "records": [
    {
      "id": "id-da-biometria",
      "aluno_id": "id-do-aluno",
      "matricula_codigo": "1361",
      "nome": "ALICE CABRINY ALVES DE ALMEIDA",
      "modelo": "captura-web-v1",
      "foto_referencia_url": "url-assinada-temporaria",
      "data_cadastro": "2026-05-14T10:00:00.000Z"
    }
  ]
}
```

## Efeitos

- Cria registro em `eventos_acesso`.
- Se for `entrada`, registra/atualiza frequencia do dia como presente.
- Se houver preferencia ativa no aluno, registra a notificacao em `mensagens_whatsapp` e realiza o envio via Meta Cloud API usando template aprovado.
- Se o evento for duplicado dentro do cooldown, retorna `duplicated: true` e nao cria nova mensagem.

## Exemplo curl

```bash
curl -X POST http://localhost:3001/api/portaria/evento \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-gate-token-change-me" \
  -d "{\"aluno_id\":\"40000000-0000-0000-0000-000000000001\",\"tipo\":\"entrada\",\"origem\":\"facial\",\"confianca\":98.7}"
```
