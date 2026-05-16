# RH Fase 1 — Empresas e Funcionários (Design)

**Data:** 2026-05-16
**Status:** Spec aprovada (aguardando review)
**Fase:** 1 de 4 (módulo Recursos Humanos)

## Contexto

Módulo de Recursos Humanos será construído em 4 fases sobre as tabelas `companies`, `employees`, `payroll`, `despesas` (seedadas via `scripts/schemas-new.sql` + `*_rows.sql`).

**Fases:**
1. **Empresas + Funcionários** (esta spec) — CRUD com soft delete, filtros, vínculo employee↔company
2. Folha de pagamento — lançar/editar payroll mensal, fechamento, relatórios
3. Despesas — lançamento, listagem por mês/categoria
4. DRE consolidado — dashboard receitas − (payroll + despesas)

## Objetivo desta fase

Permitir admin/secretaria gerenciar empresas (2 CNPJs distintos) e funcionários (vinculados a uma empresa, categorizados por segmento escolar), reusando o design system do projeto (`PageHeader`, `DataTableShell`, `FilterChips`, `StatusPill`).

## Escopo

**Inclui:**
- CRUD empresas (2 registros tipicamente, mas suporta N)
- CRUD funcionários com soft delete (`ativo`)
- Filtros por categoria escolar, empresa, status contrato, busca textual
- Validação formato CPF/CNPJ (sem dígito verificador)
- Auth gating (admin/secretaria conforme operação)
- Topbar dropdown "RH"

**Não inclui:**
- Importação em massa (manual via CRUD)
- Folha de pagamento (Fase 2)
- Holerites, relatórios fiscais
- Validação algorítmica de CPF/CNPJ
- Histórico de mudanças/auditoria

## Migrations

```sql
-- soft delete + campos extras
alter table public.companies add column if not exists ativo boolean not null default true;
alter table public.companies add column if not exists updated_at timestamptz default now();

alter table public.employees add column if not exists ativo boolean not null default true;
alter table public.employees add column if not exists email text;
alter table public.employees add column if not exists telefone text;
alter table public.employees add column if not exists cargo text;
alter table public.employees add column if not exists status_contrato text
  check (status_contrato in ('CLT','PJ','Estagio','Temporario'));

create index if not exists idx_employees_ativo on public.employees (ativo);
create index if not exists idx_employees_school_category on public.employees (school_category);
```

Arquivo: `supabase/migrations/<timestamp>_rh_employees_extras.sql`

## Estrutura de arquivos

### Rotas (`src/app/(app)/rh/`)
```
empresas/
  page.tsx                   lista cards 2 empresas + KPIs + ação "Nova"
  nova/page.tsx              form criar (admin)
  [id]/page.tsx              detalhe empresa + lista funcionários da empresa
  [id]/editar/page.tsx       form editar (admin)
funcionarios/
  page.tsx                   lista global + filtros chips + search + dropdowns
  novo/page.tsx              form criar (admin/secretaria)
  [id]/editar/page.tsx       form editar (admin/secretaria)
```

### Data (`src/lib/data/rh.ts`)
```ts
listCompanies(opts?: { includeInactive?: boolean })
getCompanyById(id: string)
getCompanySummary(id: string)  // counts por categoria + ativos/inativos

listEmployees(filters: {
  companyId?: string;
  segmento?: string;          // school_category
  search?: string;             // nome/cpf/email ilike
  statusContrato?: string;
  includeInactive?: boolean;
})
getEmployeeById(id: string)
getEmployeeSegmentCounts(filters?)  // p/ chips
```

### Actions (`src/lib/actions/rh.ts`)
```ts
createCompanyAction(formData)
updateCompanyAction(formData)
toggleCompanyAction(formData)
createEmployeeAction(formData)
updateEmployeeAction(formData)
toggleEmployeeAction(formData)
```

Cada action:
1. `requirePerfil([...])` no início
2. `safeParse` com schema Zod
3. Mutation Supabase
4. `revalidatePath` rotas afetadas
5. `redirect` com flash query param

### Validação (`src/lib/validation/rh.ts`)
```ts
CompanySchema = z.object({
  name: z.string().min(3),
  cnpj: z.string().regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, "CNPJ inválido")
});

EmployeeSchema = z.object({
  company_id: z.string().uuid(),
  name: z.string().min(3),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "CPF inválido"),
  email: z.string().email().optional().or(z.literal("")),
  telefone: z.string().optional(),
  cargo: z.string().optional(),
  school_category: z.enum(["admin","fund1","fund2","medio"]).optional(),
  status_contrato: z.enum(["CLT","PJ","Estagio","Temporario"]).optional(),
  birth_date: z.string().optional(),
  hire_date: z.string().optional()
});
```

### Components (`src/components/rh/`)
```
company-form.tsx       <ClientComponent>  form criar/editar empresa
company-card.tsx       <Server>           card empresa com mini KPIs
employee-form.tsx      <ClientComponent>  form criar/editar funcionário
employee-filters.tsx   <ClientComponent>  chips categoria + search + dropdowns
```

### Auth helper
Em `src/lib/auth/session.ts` adicionar:
```ts
export async function requirePerfil(perfis: string[]) {
  const session = await requireSession();
  if (!perfis.includes(session.profile.perfil)) {
    redirect("/acesso-negado");
  }
  return session;
}
```

Criar página `/acesso-negado` simples (PageHeader + mensagem + botão voltar).

### Topbar
Novo componente `src/components/layout/rh-dropdown.tsx` clonando estrutura de `secretaria-dropdown.tsx`:
- Items: `Empresas` (`/rh/empresas`), `Funcionários` (`/rh/funcionarios`)
- Ícone: `Briefcase` (lucide)
- Adicionar no `topbar.tsx` após `SecretariaDropdown`

## UI — Empresas

### `/rh/empresas` (lista)
- `PageHeader`:
  - breadcrumb: `[{ label: "RH" }, { label: "Empresas" }]`
  - title: `"Empresas"`
  - counter: total
  - description: `"Cadastro de pessoas jurídicas para vinculação de funcionários."`
  - actions: `<ButtonLink href="/rh/empresas/nova" variant="primary">Nova empresa</ButtonLink>` (só admin)
  - kpis: Total, Funcionários totais, Ativos, Inativos
- Grid 2 colunas (`md:grid-cols-2`) de `CompanyCard`:
  - Header: nome + CNPJ + `StatusPill` (ativa/inativa)
  - Mini KPIs inline: Funcionários, Admin, Fund. I, Fund. II, Médio (counts)
  - Footer: Link `Ver funcionários →`, menu ⋯ (Editar, Desativar/Ativar — admin only)

### `/rh/empresas/[id]` (detalhe)
- `PageHeader`:
  - breadcrumb: `[{ label: "RH" }, { label: "Empresas", href: "/rh/empresas" }, { label: nome }]`
  - title: nome empresa
  - counter: CNPJ
  - description: `"Funcionários vinculados a esta empresa."`
  - actions: `<ButtonLink href="/rh/funcionarios/novo?company={id}">Adicionar funcionário</ButtonLink>`
  - kpis: Funcionários, Ativos, Inativos
- `DataTableShell` com:
  - Toolbar: `FilterChips` (categoria) + `SearchInline`
  - Tabela: Funcionário, Categoria, Cargo, Contato, Status — links p/ `/rh/funcionarios/[id]/editar`

### `/rh/empresas/nova` e `/[id]/editar`
- `PageHeader` simples
- Form (`<CompanyForm>`):
  - Campos: Nome (text required), CNPJ (text com máscara `99.999.999/9999-99`)
  - Editar adiciona toggle Ativa
  - Botões: Cancelar (volta `/rh/empresas`), Salvar (primary)

## UI — Funcionários

### `/rh/funcionarios` (lista global)
- `PageHeader`:
  - breadcrumb: `[{ label: "RH" }, { label: "Funcionários" }]`
  - title: `"Funcionários"`
  - counter: total filtrado
  - description: `"Cadastro completo dos funcionários vinculados às empresas da escola."`
  - actions: `<ButtonLink href="/rh/funcionarios/novo">Novo funcionário</ButtonLink>` (admin/secretaria)
  - kpis: Total, Ativos, Admin, Docentes (fund1+fund2+medio)
- `DataTableShell`:
  - Toolbar `<EmployeeFilters>`:
    - `FilterChips` por `school_category`: Todos/Admin/Fund. I/Fund. II/Médio (counts)
    - `SearchInline` (nome, CPF, email — debounce 300ms)
    - `FilterDropdown` Empresa (2 opções + Todas)
    - `FilterDropdown` Contrato (CLT/PJ/Estagio/Temporario/Todos)
    - Toggle "Incluir inativos" (só admin)
  - Tabela colunas:
    | Col | Conteúdo |
    |-----|----------|
    | Funcionário | Avatar iniciais + nome + CPF |
    | Empresa | nome curto |
    | Categoria | StatusPill neutral c/ label categoria |
    | Cargo | text |
    | Contato | email / telefone stack |
    | Contrato | StatusPill colorido (CLT=success, PJ=brand, Estágio=warning, Temp=danger) |
    | Status | StatusPill success/danger Ativo/Inativo |
    | Ações | menu ⋯ (Editar, Desativar/Ativar) |

### `/rh/funcionarios/novo` e `/[id]/editar`
- `PageHeader` simples
- Form (`<EmployeeForm>`):
  - Grid 2 cols (em md+):
    - Empresa (select required, prefill via `?company=`), Nome (required), CPF (máscara required)
    - Email, Telefone (máscara `(99) 99999-9999`), Cargo
    - Categoria (select admin/fund1/fund2/medio), Contrato (select CLT/PJ/Estagio/Temporario)
    - Data nascimento, Data admissão
  - Editar adiciona toggle Ativo
  - Botões: Cancelar, Salvar

## Permissões

| Operação | Admin | Secretaria | Outros |
|----------|-------|------------|--------|
| Listar empresas | ✅ | ✅ | ✅ |
| Criar/editar/desativar empresa | ✅ | ❌ | ❌ |
| Listar funcionários | ✅ | ✅ | ✅ |
| Criar/editar/desativar funcionário | ✅ | ✅ | ❌ |
| Ver inativos | ✅ | ❌ | ❌ |

## Tratamento de erros

- **CPF/CNPJ duplicado** (`code === '23505'`) → flash message amigável
- **Validação Zod falha** → flash com primeiro erro do `safeParse`
- **Sem permissão** → redirect `/acesso-negado`
- **Empresa com funcionários ao desativar** → permitir (soft delete), apenas oculta da lista padrão

## Empty states

- `/rh/empresas` vazio: ícone `Building2` + "Nenhuma empresa cadastrada" + CTA "Nova empresa"
- `/rh/funcionarios` vazio: ícone `UsersRound` + "Nenhum funcionário encontrado" + CTA conforme filtro (limpar ou criar)
- Empresa sem funcionários: "Nenhum funcionário vinculado" + CTA "Adicionar funcionário"

## Decisões e justificativas

| Decisão | Razão |
|---------|-------|
| Server Components + Server Actions | Match padrão do projeto (Alunos, Matrículas, Financeiro) |
| Soft delete em ambas tabelas | Mantém histórico para Fase 2 (payroll precisa employees inativos) |
| Páginas separadas p/ criar/editar (não modal) | Consistência com `/alunos/novo` |
| Validação só de formato CPF/CNPJ | Decisão usuário; algoritmo fica p/ fase futura |
| Dropdown "RH" no topbar | Agrupa Fases 2 (folha) e 3 (despesas) futuras |
| `requirePerfil` novo helper | Reutilizável p/ fases futuras |

## Testes manuais (smoke)

- [ ] Criar empresa nova (admin) — sucesso, aparece lista
- [ ] Tentar criar empresa (secretaria) — 403 `/acesso-negado`
- [ ] CNPJ inválido → erro inline
- [ ] CNPJ duplicado → erro "já cadastrado"
- [ ] Criar funcionário, vincular empresa, ver na lista
- [ ] Filtro chip categoria altera URL e lista
- [ ] Search nome filtra (debounce)
- [ ] Desativar funcionário → some da lista padrão
- [ ] Toggle "Incluir inativos" → aparecem
- [ ] Detalhe empresa lista só funcionários dela
- [ ] Edição preserva valores existentes
- [ ] Topbar dropdown RH navega corretamente

## Dependências

- `react-imask` ou implementar máscara simples (CPF, CNPJ, telefone) — recomendado: helper inline em `src/lib/format/masks.ts` (não adicionar lib só pra isso)

## Próximos passos

1. Aprovar spec
2. Gerar implementation plan via `writing-plans`
3. Implementar em ordem: migrations → data → auth helper → components → pages empresas → pages funcionários → topbar dropdown
