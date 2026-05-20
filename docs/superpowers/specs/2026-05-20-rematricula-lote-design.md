# Re-matrícula em Lote — Design Spec

**Data:** 2026-05-20  
**Status:** Aprovado

---

## Contexto

Re-matrícula individual já existe (ver `2026-05-20-rematricula-design.md`).  
Este spec cobre o fluxo em **lote**: secretária seleciona uma turma e re-matricula todos os alunos elegíveis de uma vez, com série destino escolhida manualmente e resultado detalhado por aluno.

---

## Fluxo do Wizard (4 steps)

Rota base: `/matriculas/rematricula-lote`

| Step | URL | Conteúdo |
|------|-----|----------|
| 1 | `?step=1` | Seleciona ano letivo origem + turma |
| 2 | `?step=2&ano=AAAA&turma_id=X` | Seleciona série destino |
| 3 | `?step=3&ano=AAAA&turma_id=X&serie_dest_id=Y` | Lista alunos candidatos + checkboxes + submit |
| resultado | `/matriculas/rematricula-lote/resultado` | Summary ok/erros por aluno |

Cada step é Server Component. Navegação entre steps via `<form>` GET (step 1 e 2) ou POST via Server Action (step 3).  
Steps 2 e 3 validam params no servidor — param inválido ou ausente redireciona para step 1.

---

## Candidatos elegíveis (Step 3)

Query `listAlunosCandidatosLote(turma_id, ano_letivo)`:

```sql
SELECT a.id, a.nome, m.id AS matricula_id
FROM alunos a
JOIN matriculas m ON m.aluno_id = a.id
WHERE m.turma_id = $1
  AND m.ano_letivo = $2
  AND m.status = 'ativa'
  AND NOT EXISTS (
    SELECT 1 FROM matriculas m2
    WHERE m2.aluno_id = a.id
      AND m2.ano_letivo = $2 + 1
      AND m2.status = 'ativa'
  )
ORDER BY a.nome ASC;
```

Alunos já re-matriculados para `ano+1` são excluídos da lista (nunca aparecem).  
Se lista vier vazia, step 3 exibe estado vazio: "Nenhum aluno elegível nesta turma para re-matrícula."

---

## Server Action

**`rematricularLoteAction(formData: FormData)`** em `src/lib/actions/academics.ts`

### Inputs
- `ano_letivo: string` (número)
- `serie_dest_id: string` (uuid)
- `matricula_ids: string[]` (uuid[], checkboxes selecionados)

### Lógica

1. `requirePermission("matriculas", "write")` — falha toda operação
2. Validar que `matricula_ids` não está vazio
3. Para cada `matricula_id`:
   - Chamar `supabase.rpc("rematriculate", { p_matricula_id, p_serie_dest_id })`
   - Em sucesso: push `{ nome, novaMatriculaId }` para array `ok`
   - Em erro: push `{ nome, motivo }` para array `errors` (não aborta os demais)
4. Serializar resultado como JSON e salvar em cookie `rematricula_lote_result` (max-age 60s, httpOnly)
5. `redirect("/matriculas/rematricula-lote/resultado")`

### Recuperar nome do aluno para o resultado
Antes do loop, buscar mapa `{ matricula_id → nome }` via query única para evitar N+1.

---

## RPC — Atualização de `rematriculate`

Adicionar parâmetro opcional `p_serie_dest_id`:

```sql
CREATE OR REPLACE FUNCTION rematriculate(
  p_matricula_id uuid,
  p_serie_dest_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mat        matriculas%ROWTYPE;
  v_next_serie series%ROWTYPE;
  v_nova_id    uuid;
BEGIN
  SELECT * INTO v_mat FROM matriculas WHERE id = p_matricula_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_mat.status <> 'ativa' THEN RAISE EXCEPTION 'not_active'; END IF;

  IF p_serie_dest_id IS NOT NULL THEN
    -- Lote: usa série destino explícita
    SELECT * INTO v_next_serie FROM series WHERE id = p_serie_dest_id AND escola_id = v_mat.escola_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'invalid_serie_dest'; END IF;
  ELSE
    -- Individual: próxima série por ordem
    SELECT * INTO v_next_serie
    FROM series
    WHERE escola_id = v_mat.escola_id AND ativo = true
      AND ordem > (SELECT ordem FROM series WHERE id = v_mat.serie_id)
    ORDER BY ordem ASC
    LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'no_next_serie'; END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM matriculas
    WHERE aluno_id = v_mat.aluno_id
      AND ano_letivo = v_mat.ano_letivo + 1
      AND status = 'ativa'
  ) THEN
    RAISE EXCEPTION 'already_enrolled';
  END IF;

  INSERT INTO matriculas (aluno_id, escola_id, serie_id, plano_id, ano_letivo, data_matricula, status)
  VALUES (v_mat.aluno_id, v_mat.escola_id, v_next_serie.id, v_mat.plano_id, v_mat.ano_letivo + 1, CURRENT_DATE, 'ativa')
  RETURNING id INTO v_nova_id;

  UPDATE matriculas SET status = 'concluida' WHERE id = p_matricula_id;

  RETURN v_nova_id;
END;
$$;
```

Migration: `supabase/migrations/YYYYMMDD_update_rematriculate_serie_dest.sql`

---

## Tratamento de Erros por Aluno

| Exceção RPC | Mensagem no resultado |
|-------------|----------------------|
| `not_found` | "Matrícula não encontrada" |
| `not_active` | "Matrícula não está ativa" |
| `already_enrolled` | "Já possui matrícula ativa em {ano+1}" |
| `invalid_serie_dest` | "Série destino inválida" |
| Exception genérica | "Erro inesperado" |

---

## Página de Resultado

Lê cookie `rematricula_lote_result`, exibe summary e limpa cookie.

```
✓ 23 alunos re-matriculados com sucesso
✗ 2 erros

Tabela "Sucesso": Nome | Link "Ver matrícula"
Tabela "Erros":   Nome | Motivo

[Botão: Ver matrículas {ano+1}] → /matriculas?ano={ano+1}
[Botão: Nova re-matrícula em lote] → /matriculas/rematricula-lote
```

Se cookie ausente/expirado ao acessar `/resultado` diretamente: redirect para step 1.

---

## Permissões

`requirePermission("matriculas", "write")` no início da Server Action. Páginas do wizard não exigem check adicional — apenas leitura de dados públicos da escola.

---

## Arquivos a Criar/Modificar

| Arquivo | Tipo | Mudança |
|---------|------|---------|
| `supabase/migrations/YYYYMMDD_update_rematriculate_serie_dest.sql` | SQL | Adiciona `p_serie_dest_id` à RPC |
| `src/lib/data/students.ts` ou `matriculas.ts` | Data | `listAlunosCandidatosLote(turma_id, ano_letivo)` |
| `src/lib/actions/academics.ts` | Action | `rematricularLoteAction` |
| `src/app/(app)/matriculas/rematricula-lote/page.tsx` | Server Component | Wizard controller (step routing) |
| `src/app/(app)/matriculas/rematricula-lote/resultado/page.tsx` | Server Component | Página de resultado |
| `src/components/matriculas/rematricula-lote-step1.tsx` | Server Component | Form: ano + turma |
| `src/components/matriculas/rematricula-lote-step2.tsx` | Server Component | Form: série destino |
| `src/components/matriculas/rematricula-lote-step3.tsx` | Server Component | Lista alunos + checkboxes |

---

## Fora de Escopo

- Override de plano por aluno (todos mantêm plano atual)
- Override de série por aluno (todos vão para a mesma série destino)
- Re-matrícula cross-turma (filtro é sempre por turma)
- Desfazer lote após execução (re-matrícula individual pode ser desfeita manualmente)
