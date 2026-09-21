# auth-event-hook

Edge function que registra eventos de autenticação do Supabase em `auth_evento_log`.

Complementa o log da aplicação (Server Actions em `src/lib/actions/auth.ts` e
`users.ts`): captura eventos que **não** passam pelo formulário da app — tentativas
via API direta do Supabase, magic links, recuperação de senha.

## Deploy

```bash
# 1. Secret de proteção do hook
supabase secrets set AUTH_HOOK_SECRET=$(openssl rand -hex 32)

# 2. Deploy (sem verificação de JWT — o hook não envia token de usuário)
supabase functions deploy auth-event-hook --no-verify-jwt
```

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetados automaticamente no
runtime das edge functions — não precisam ser setados.

## Registro do Hook

No Dashboard → **Authentication → Hooks** (ou via Management API), aponte o hook
desejado para a URL da função:

```
https://<project-ref>.functions.supabase.co/auth-event-hook?secret=<AUTH_HOOK_SECRET>
```

Recomendado registrar nos eventos de **sign-in** e **password** disponíveis no
seu plano. O `secret` na query (ou header `x-hook-secret`) é validado pela função;
requisições sem o secret correto recebem `401`.

## Eventos mapeados

| action do hook                              | evento gravado   |
|---------------------------------------------|------------------|
| `login`                                     | `login_ok`       |
| `login_failed`, `user_repeated_signup`      | `login_falha`    |
| `logout`                                    | `logout`         |
| `user_recovery_requested`, `user_updated_password` | `senha_alterada` |
| `user_deleted`                              | `dado_excluido`  |

## Consulta

Apenas `admin` da própria escola lê o log (RLS). Para auditoria operacional:

```sql
select created_at, evento, email, ip, detalhe
from auth_evento_log
where evento = 'login_falha'
order by created_at desc
limit 100;
```
