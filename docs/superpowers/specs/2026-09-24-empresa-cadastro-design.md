# Cadastro de Empresa — logo, endereço, assinaturas, outras informações

## Contexto

A entidade que representa cada CNPJ (mantenedora/escola) é a tabela `companies`,
editada em RH › Empresas (`src/components/rh/company-form.tsx`). Ela já é usada
por: RH/folha (`company_id` em payroll), isaac (`isaac_unidade.company_id`),
Sicoob (`contas_bancarias.company_id`), e pelo cabeçalho do histórico escolar e
certificado (via `historico_niveis_ensino.company_id` → `getCredenciamentoVigente`).

Hoje a tabela `companies` tem: `name`, `cnpj`, `endereco`, `cidade`, `uf`, `cep`,
`resolucao`, `telefones`, `email`, `logo_path` (nunca gravado), `secretario_nome`,
`secretario_cargo`, `diretor_nome`, `diretor_cargo`.

Faltam: upload de logo funcional, endereço estruturado (número/complemento/bairro),
site, whatsapp, nome fantasia, INEP, mantenedora, e assinaturas de coordenação e
financeiro. O histórico ignora `logo_path` e usa um arquivo fixo
`/historico/logo-epg.png`; o certificado já faz fallback para esse mesmo arquivo
quando `logo_path` está vazio.

Este documento cobre apenas essa frente. Não altera lógica de folha, isaac,
Sicoob ou permissões existentes além do necessário para os campos novos.

## Decisões

- **Localização da tela:** permanece em RH › Empresas, reorganizada em abas.
  Não há mudança de rota, menu ou permissão (`rh.empresas`).
- **Assinaturas:** 4 cargos fixos — Secretário(a), Diretor(a), Coordenação,
  Financeiro — cada um com nome e cargo (texto livre, com valor padrão).
  Não há lista dinâmica, imagem de assinatura nem número de registro.
- **Outras informações:** Portaria/Resolução (reaproveita `resolucao`), E-mail,
  Site, WhatsApp, Telefone, Nome fantasia, Código INEP, Entidade mantenedora.
  Fora de escopo: Setransp, Portaria de progressão parcial.
- **Endereço:** estruturado em Logradouro, Número, Complemento, Bairro, Cidade,
  UF, CEP. Sem busca automática por CEP (endereço cadastrado uma vez, baixa
  frequência de mudança não justifica dependência de API externa).
- **Logo:** reaproveita o padrão já usado por `escolas` (bucket `escola-logos`,
  `uploadEscolaLogoAction`/`removeEscolaLogoAction`), com bucket/prefixo próprios
  para `companies`.

## Modelo de dados

Migration nova, aditiva, sem dropar nada:

```sql
alter table companies
  add column if not exists numero text,
  add column if not exists complemento text,
  add column if not exists bairro text,
  add column if not exists site text,
  add column if not exists whatsapp text,
  add column if not exists nome_fantasia text,
  add column if not exists codigo_inep text,
  add column if not exists mantenedora text,
  add column if not exists coordenacao_nome text,
  add column if not exists coordenacao_cargo text not null default 'Coordenador(a)',
  add column if not exists financeiro_nome text,
  add column if not exists financeiro_cargo text not null default 'Financeiro';
```

- `endereco` (já existente) permanece como Logradouro — sem migração de dado,
  sem renomear coluna (menor diff, evita quebrar leituras existentes).
- `logo_path` já existe; nenhuma mudança de schema.
- `telefones` (já existente, singular texto livre) vira o campo Telefone da UI.

## Upload de logo

- Bucket: reaproveita `escola-logos` (já público), com caminho
  `companies/<company_id>/<timestamp>.<ext>`. Ajustar a policy de storage do
  bucket se ela hoje só aceitar o prefixo `<escola_id>/`.
- Regras iguais às de escola: máx. 2MB, extensões jpeg/png/webp/svg.
- Duas Server Actions novas em `src/lib/actions/rh.ts`:
  - `uploadCompanyLogoAction(companyId, file)` — grava em storage e atualiza
    `companies.logo_path`.
  - `removeCompanyLogoAction(companyId)` — remove do storage e limpa a coluna.
- Permissão: mesma `rh.empresas` já usada pelas outras actions de companies.

## UI

`src/components/rh/company-form.tsx` (tela de Editar; a tela de Criar continua
só com Razão social e CNPJ):

- **Topo:** logo (com "Atualizar foto"/"Remover imagem"), Razão social,
  Nome fantasia, CNPJ.
- **Abas** (componente de abas já existente em `src/components/ui`):
  1. **Endereço:** Logradouro, Número, Complemento, Bairro, Cidade, UF, CEP.
  2. **Assinaturas:** 4 blocos nome+cargo (Secretário, Diretor, Coordenação,
     Financeiro).
  3. **Outras informações:** Portaria/Resolução, E-mail, Site, WhatsApp,
     Telefone, Código INEP, Entidade mantenedora.
- Validação via zod em `src/lib/validation/rh.ts`, estendendo o schema
  existente com os campos novos (todos opcionais exceto os já obrigatórios).
- Toda cor via token/classe Tailwind tokenizada — sem hex cru, conforme
  CLAUDE.md do projeto.

## Efeito nos consumidores de `companies`

- **Histórico** (`src/components/historico/emissao-form.tsx`,
  `src/lib/documents/historico-pdf.ts`): passa a buscar o logo via
  `companies.logo_path` (resolvido para URL pública do storage), com fallback
  para `/historico/logo-epg.png` quando vazio. Remove o fetch hardcoded atual.
- **Certificado** (`src/lib/data/certificados.ts`,
  `src/lib/documents/certificado-pdf.ts`): já faz esse fallback; passa a
  encontrar o logo real assim que `logo_path` for preenchido — sem mudança de
  código, só de dado.
- **`mapCredenciamento`** (`src/lib/data/historico.ts`): passa a usar
  `nome_fantasia` quando preenchido, mantendo `name` (razão social) como
  fallback.

## Fora de escopo

- Busca de CEP (ViaCEP ou similar).
- Setransp, Portaria de progressão parcial.
- Assinatura como imagem digitalizada, número de registro de assinatura.
- Múltiplas pessoas por cargo (ex.: coordenador por nível de ensino).
- Qualquer mudança em RBAC/menu além dos campos desta tela.

## Testes

- Validação zod dos campos novos (aceita vazio, rejeita tipo errado).
- `uploadCompanyLogoAction`/`removeCompanyLogoAction`: rejeita arquivo grande
  demais e extensão inválida; grava/limpa `logo_path` corretamente.
- Fallback do logo no histórico: com `logo_path` vazio usa o arquivo padrão;
  com `logo_path` preenchido usa a URL do storage.
- `npm run typecheck && npm run build` verdes antes de fechar a fase.

## Critério de aceite

- Tela RH › Empresas › Editar mostra as 3 abas com todos os campos.
- Upload/remoção de logo funciona e reflete no histórico e certificado.
- Nenhuma mudança de comportamento em folha, isaac ou Sicoob.
