# Re-matrícula com revisão por aluno + indicador de aluno novato — Design Spec

**Data:** 2026-09-17
**Status:** Em revisão

---

## Contexto

Re-matrícula individual e em lote já existem (specs `2026-05-20-rematricula-design.md` e
`2026-05-20-rematricula-lote-design.md`), mas têm dois problemas:

1. **Bug de produção**: a RPC `rematriculate` nunca preenche `turma_id` no INSERT, mas
   `matriculas.turma_id` é `NOT NULL` sem default. Toda chamada falha com violação de
   constraint, que cai no fallback genérico `"Erro ao processar re-matrícula. Tente novamente."`
   (reproduzido na ficha da aluna Manuela Margarida Barros). **Não será corrigido isoladamente**
   — o novo design resolve a causa raiz ao exigir `turma_id` explícito em toda chamada da RPC.
2. **Falta de revisão**: hoje a re-matrícula (individual e em lote) calcula a série seguinte
   automaticamente e cria a matrícula na hora, sem chance de a secretária ajustar série, turma
   ou ano letivo antes de confirmar (necessário para casos de repetência ou mudança de turno).

Além disso, não há hoje forma de identificar um "aluno novato" (aluno sem nenhuma matrícula
anterior) na lista de Alunos nem no fluxo de matrícula.

---

## Comportamento esperado

### 1. Indicador de aluno novato

- **Lista de Alunos** (`/alunos`): badge "Novato" na linha do aluno quando ele possui apenas
  uma matrícula (a do ano letivo corrente) e nenhuma outra. Filtro adicional "Somente novatos"
  nos filtros existentes (`StudentFilters`).
- **Combobox de aluno na matrícula** (`StudentCombobox`, usado em `/matriculas/[id]` e outros
  formulários que selecionam aluno): ao selecionar um aluno, exibir inline "Aluno novato" ou
  "Já matriculado anteriormente" abaixo do campo.

### 2. Re-matrícula individual — tela de revisão

- Botão "Re-matricular" na ficha do aluno e no detalhe da matrícula deixa de chamar a action
  direto. Passa a ser um link para `/matriculas/[id]/rematricular`.
- Nova página server-rendered com formulário client (`RematricularForm`):
  - **Série destino**: `<select>` pré-selecionado com a próxima série por `ordem`, editável.
  - **Turma destino**: `<select>` dependente da série + ano escolhidos (filtra turmas
    `ativo=true` da série no ano destino). Se não houver turma cadastrada para a combinação,
    mostrar aviso e desabilitar submit.
  - **Ano letivo destino**: `<input type="number">`, default `ano_atual + 1`, editável (cobre
    repetência — aluno permanece na mesma série, ano-alvo é o mesmo ano corrente + 1 mas série
    igual à atual).
  - Botão "Confirmar re-matrícula" envia os 3 valores explícitos à action.
- Guards de elegibilidade (matrícula ativa, não já matriculado no ano destino) continuam
  verificados na RPC antes do INSERT.

### 3. Re-matrícula em lote — step 3 vira tabela editável

- Mantém o wizard de navegação (step 1: ano+turma origem; step 3: revisão e confirmação).
- **Step 2 é removido** — selecionar uma única "série destino" para todo o lote deixa de fazer
  sentido quando cada aluno pode ter série/turma/ano diferentes.
- **Step 3** vira uma tabela com uma linha por aluno candidato:
  - Checkbox "incluir" (default marcado)
  - Select de série destino (default: próxima por `ordem`)
  - Select de turma destino (dependente da série escolhida naquela linha; carregado via
    `turmas` do ano destino)
  - Input de ano destino (default `ano+1`, editável por linha)
- Submit único envia um array de objetos `{ matricula_id, serie_dest_id, turma_dest_id,
  ano_dest }` para a action em lote.
- Página de resultado (sucesso/erro por aluno) mantém o formato atual.

### 4. RPC `rematriculate` — assinatura nova

```sql
rematriculate(
  p_matricula_id  uuid,
  p_serie_dest_id uuid,   -- agora obrigatório
  p_turma_dest_id uuid,   -- novo, obrigatório
  p_ano_dest      integer DEFAULT NULL  -- default: ano atual da matrícula + 1
)
```

- Remove o cálculo automático de "próxima série por ordem" da RPC — isso passa a ser
  responsabilidade da UI (sugestão de default), a RPC sempre recebe valores explícitos.
- Novo guard: `p_turma_dest_id` deve pertencer à mesma escola e à mesma série (`turmas.serie_id
  = p_serie_dest_id`) — senão `RAISE EXCEPTION 'invalid_turma_dest'`.
- Guard existente `already_enrolled` passa a comparar contra `p_ano_dest` em vez de
  `ano_letivo + 1` fixo.
- `INSERT INTO matriculas (..., turma_id, ...)` agora preenche `turma_id` corretamente —
  resolve o bug de produção.

### Mapeamento de erros (action)

| Exceção RPC | Mensagem exibida |
|---|---|
| `not_found` | "Matrícula não encontrada." |
| `not_active` | "Só é possível re-matricular matrículas ativas." |
| `invalid_serie_dest` | "Série destino inválida." |
| `invalid_turma_dest` | "Turma destino inválida para a série selecionada." |
| `already_enrolled` | "Aluno já possui matrícula ativa para o ano {ano_dest}." |
| genérica | "Erro ao processar re-matrícula. Tente novamente." |

---

## Arquivos a criar/modificar

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/YYYYMMDD_rematriculate_turma_ano_dest.sql` | Nova assinatura da RPC (turma + ano obrigatórios) |
| `src/lib/actions/academics.ts` | `rematricularAlunoAction` recebe `{serieDestId, turmaDestId, anoDest}`; `rematricularLoteAction` recebe array por aluno |
| `src/app/(app)/matriculas/[id]/rematricular/page.tsx` | Nova página de revisão individual |
| `src/components/matriculas/rematricular-form.tsx` | Novo client component (form com selects dependentes) |
| `src/components/students/reenroll-button.tsx` | Vira `ButtonLink` para a nova rota (remove chamada direta à action) |
| `src/components/matriculas/rematricula-lote-step3.tsx` | Reescrito como tabela editável por aluno |
| `src/components/matriculas/rematricula-lote-step2.tsx` | Removido (step 2 deixa de existir) |
| `src/app/(app)/matriculas/rematricula-lote/page.tsx` | Ajusta roteamento de steps (1 → 3) |
| `src/lib/data/enrollments.ts` | `listAlunosCandidatosLote` passa a incluir `serie_id` atual de cada aluno (para calcular default de série destino por linha) |
| `src/lib/data/students.ts` | Novo helper para identificar "novato" (contagem de matrículas por aluno) na listagem |
| `src/components/students/student-filters.tsx` | Novo filtro "Somente novatos" |
| `src/components/matriculas/student-combobox.tsx` | Exibe indicador novato/já matriculado ao selecionar |

---

## Fora de escopo

- Correção do bug de produção como hotfix isolado (será resolvido pela nova RPC).
- Cópia de dados médicos/autorizações na re-matrícula (já fora de escopo original).
- Geração automática de cobranças na re-matrícula.
- Desfazer lote após execução.
- Alterar plano por aluno durante a re-matrícula (mantém o plano atual — não pedido).
