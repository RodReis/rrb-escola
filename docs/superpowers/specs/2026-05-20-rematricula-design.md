# Re-matrícula individual — Design Spec

**Data:** 2026-05-20  
**Status:** Aprovado

---

## Contexto

O sistema cria matrículas individualmente mas não possui fluxo para renovar ao ano seguinte.  
Secretárias precisam criar nova matrícula manualmente, copiando dados da atual, o que gera erros e omissões.  
Esta spec cobre o fluxo **individual** (via ficha do aluno e detalhe da matrícula).  
Lote fica para sprint futura.

---

## Comportamento esperado

1. Usuário clica em **"Re-matricular"** na ficha do aluno ou no detalhe da matrícula.
2. Sistema cria nova matrícula para `ano_letivo + 1` com a próxima série na ordem.
3. Matrícula antiga muda para `status = 'concluida'`.
4. Usuário é redirecionado para a nova matrícula com banner de confirmação.
5. Secretária atribui turma e confirma plano na nova ficha.

---

## Server Action

**`rematricularAlunoAction(matriculaId: string)`** em `src/lib/actions/academics.ts`

### Lógica (sequencial, transação via RPC Supabase)

1. Buscar matrícula atual pelo `id` → campos: `aluno_id, escola_id, plano_id, serie_id, ano_letivo, status`
2. Guard: `status !== 'ativa'` → return `{ error: "Matrícula não está ativa." }`
3. Buscar `series` da escola ordenado por `ordem` ASC
4. Encontrar próxima série: `series[indexOf(serie_id) + 1]`
5. Guard: próxima série não existe → return `{ error: "Não há série seguinte cadastrada." }`
6. Guard: já existe matrícula `ativa` do aluno para `ano_letivo + 1` → return `{ error: "Aluno já tem matrícula ativa para {ano+1}." }`
7. Dentro de transação (RPC `rematriculate` ou chamadas sequenciais com rollback manual):
   - `INSERT INTO matriculas` com `aluno_id, escola_id, plano_id, serie_id=nova_serie.id, turma_id=null, ano_letivo=atual+1, data_matricula=hoje, status='ativa', idade_na_matricula=null, observacoes=null`
   - `UPDATE matriculas SET status='concluida' WHERE id=matriculaId`
8. Return `{ novaMatriculaId: string }`

### Implementação técnica

Usar `supabase.rpc()` **não** é necessário se o cliente de servidor tiver service-role key — duas queries sequenciais são suficientes. Em caso de falha no UPDATE, deletar o INSERT (rollback manual simples).

Alternativa: criar função `rematriculate(p_matricula_id uuid)` no Supabase que executa tudo em uma transação PL/pgSQL. Preferível para garantir atomicidade.

**Decisão:** Usar RPC para atomicidade real.

---

## Migration / RPC

Criar migration `add_rematriculate_rpc.sql`:

```sql
CREATE OR REPLACE FUNCTION rematriculate(p_matricula_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mat        matriculas%ROWTYPE;
  v_next_serie series%ROWTYPE;
  v_nova_id    uuid;
BEGIN
  -- Fetch current enrollment
  SELECT * INTO v_mat FROM matriculas WHERE id = p_matricula_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_mat.status <> 'ativa' THEN RAISE EXCEPTION 'not_active'; END IF;

  -- Find next serie by ordem
  SELECT * INTO v_next_serie
  FROM series
  WHERE escola_id = v_mat.escola_id AND ativo = true
    AND ordem > (SELECT ordem FROM series WHERE id = v_mat.serie_id)
  ORDER BY ordem ASC
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_next_serie'; END IF;

  -- Guard: already enrolled next year
  IF EXISTS (
    SELECT 1 FROM matriculas
    WHERE aluno_id = v_mat.aluno_id
      AND ano_letivo = v_mat.ano_letivo + 1
      AND status = 'ativa'
  ) THEN
    RAISE EXCEPTION 'already_enrolled';
  END IF;

  -- Create new enrollment
  INSERT INTO matriculas (aluno_id, escola_id, serie_id, plano_id, ano_letivo, data_matricula, status)
  VALUES (v_mat.aluno_id, v_mat.escola_id, v_next_serie.id, v_mat.plano_id, v_mat.ano_letivo + 1, CURRENT_DATE, 'ativa')
  RETURNING id INTO v_nova_id;

  -- Close old enrollment
  UPDATE matriculas SET status = 'concluida' WHERE id = p_matricula_id;

  RETURN v_nova_id;
END;
$$;
```

---

## Guards e erros

| Condição | Mensagem exibida |
|---|---|
| Matrícula não encontrada | "Matrícula não encontrada." |
| Status ≠ ativa | "Só é possível re-matricular matrículas ativas." |
| Não há próxima série | "Não há série seguinte cadastrada. Cadastre a próxima série antes de re-matricular." |
| Aluno já tem ativa no próximo ano | "Aluno já possui matrícula ativa para {ano+1}." |
| Erro inesperado | "Erro ao processar re-matrícula. Tente novamente." |

---

## UI — Pontos de entrada

### 1. Ficha do aluno (`/alunos/[id]`)

- Componente: `StudentHeaderActions` → `QuickDocumentActions`
- Adição: botão **"Re-matricular"** no header (visível apenas se `matriculaAtiva !== null`)
- Estilo: `ds-button ds-button-secondary` com ícone `RefreshCcw` do lucide-react
- Ao clicar: chama `rematricularAlunoAction(matriculaAtiva.id)` → em caso de sucesso, `router.push('/matriculas/[nova-id]?rematricula=1')`
- Exibição de erros: `toast.error(mensagem)`

### 2. Detalhe da matrícula (`/matriculas/[id]`)

- Localização: botões no `<header>` da página (ao lado de "Ficha do aluno")
- Adição: botão **"Re-matricular"** (visível apenas se `enrollment.status === 'ativa'`)
- Precisa ser client component para chamar action — extrair `ReenrollButton` como `"use client"` component
- Mesmo comportamento: action → redirect

### Banner de confirmação

Em `/matriculas/[id]`, se `searchParams.rematricula === '1'`:
```tsx
<div className="rounded-ui border border-moss/40 bg-moss/10 px-4 py-3 text-sm text-moss">
  Matrícula {enrollment.ano_letivo} criada com sucesso. Atribua a turma e confirme o plano.
</div>
```

---

## Permissões

Requer permissão `matriculas:write` (mesma da criação de matrícula). Verificar via `requirePermission("matriculas", "write")` no server action.

---

## Arquivos a criar/modificar

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/YYYYMMDD_add_rematriculate_rpc.sql` | Nova função RPC |
| `src/lib/actions/academics.ts` | `rematricularAlunoAction` |
| `src/components/students/reenroll-button.tsx` | Novo client component para ficha do aluno |
| `src/app/(app)/alunos/[id]/page.tsx` | Passar `matriculaAtiva` ao `ReenrollButton` |
| `src/app/(app)/matriculas/[id]/page.tsx` | Adicionar `ReenrollButton` no header + banner |

---

## Fora de escopo

- Re-matrícula em lote (sprint futura)
- Cópia de informações médicas ou autorizações (permanecem na ficha do aluno, não na matrícula)
- Geração automática de cobranças (secretária gera manualmente após atribuir turma)
