# Histórico Escolar — design

Data: 2026-09-18
Status: aprovado, pronto para plano de implementação

## Problema

A escola não emite histórico escolar pelo sistema. O documento é montado fora,
redigitando dados que já existem em `matriculas`, `notas` e `avaliacoes`, e
misturando-os com anos cursados em escolas anteriores, que o sistema não guarda
em lugar nenhum.

O modelo de referência é o histórico da aluna MANUELA MARGARIDA BARROS
(`docs/referencias/historico-manuela.pdf`): A4 retrato, cabeçalho com dados da
mantenedora e logo, grade de disciplinas × séries, tabela de estabelecimentos por
série e duas assinaturas.

## Objetivo

Três telas que, juntas, permitem cadastrar o histórico de um aluno (anos na EPG
pré-preenchidos, escolas anteriores digitadas) e emitir o PDF fiel ao modelo,
individual ou para uma turma inteira.

## Relação com o certificado de conclusão

A spec `2026-09-17-certificado-conclusao-design.md` (aprovada, sem código
escrito) modelava o histórico como snapshot interno do certificado, na tabela
`certificado_historico`. **Essa parte fica obsoleta.** O histórico escolar passa a
ser o módulo base, e o certificado vira consumidor: quando for implementado, lê
`historico_escolar` em vez de manter grade própria.

Decisão do usuário em 2026-09-18. A spec do certificado deve ser atualizada
quando ele entrar na fila — não faz parte deste trabalho.

## Decisões

| Decisão | Escolha | Por quê |
|---|---|---|
| Fonte dos dados | Híbrido | Anos na EPG saem de `matriculas` + `notas_consolidadas`; escolas anteriores são digitadas. Evita redigitar o que o sistema já tem |
| Congelamento | Ao vivo até o ano fechar | Ano em curso reflete correções de nota; ano com resultado final vira snapshot e nunca mais recalcula. Documento legal não pode mudar sozinho |
| Papel da associação série/empresa | Empresa+vigência **e** nível de ensino | Define o CNPJ/credenciamento do cabeçalho e o agrupamento de colunas do PDF (Fund1/Fund2/Médio) |
| Motor do PDF | jsPDF + jspdf-autotable | Já instalados (`jspdf@4.2.1`, `jspdf-autotable@5.0.7`). Grade densa é inviável no motor .docx |
| Persistência do PDF | Só download | Dado fica no banco, reemite quando quiser. Zero storage |
| Lote | PDF único, 1 aluno por página | Imprime a turma de uma vez, sem zip |
| Fidelidade | Coordenadas extraídas do modelo | Layout replicado em pontos, não aproximado |

### Descartado

**Inchar `companies` com endereço, telefone e resolução de reconhecimento.** Ela é
do RH/folha (`cnpj`, `name`, `ativo`), usada por `employees` e `folha_contratos`.
Adicionar campos acadêmicos ali acopla dois domínios sem necessidade. O
credenciamento vive em tabela própria, ligada a `companies` por FK.

**Modelar carga horária e dias letivos como dado de primeira classe** em `series`
e `calendario_letivo`. Mais correto a longo prazo, mas é outro projeto: mexe em
vários módulos e ainda deixaria os anos anteriores ao sistema vazios.

## Dados

Cinco tabelas novas. Nenhuma tabela existente é alterada estruturalmente.

### `historico_credenciamentos` — dados de cabeçalho da mantenedora

```
id, escola_id, company_id references companies(id)
razao_social text, nome_fantasia text, cnpj text
resolucao text            -- "RENOVAÇÃO DE RECONHECIMENTO, RESOLUÇÃO CEE/CEB Nº 518/2024"
endereco text, cidade text, uf text, cep text
telefones text, email text
logo_path text            -- asset em public/
created_at, updated_at
```

`companies` fornece a identidade jurídica; esta tabela, o que o documento precisa
imprimir e o RH não tem.

### `historico_niveis_ensino` — a tela "Associação Série/Turma e Empresa"

```
id, escola_id, serie_id references series(id)
credenciamento_id references historico_credenciamentos(id)
nivel nivel_ensino        -- enum: infantil | fund1 | fund2 | medio
ano_inicio int, ano_fim int
created_at, updated_at
unique (escola_id, serie_id, ano_inicio)
```

Resolve duas coisas ao mesmo tempo: qual credenciamento imprimir no cabeçalho de
um histórico daquela série naquele ano, e a que nível a série pertence — que
define as colunas da grade. Validação na Server Action: dois ranges de anos não
podem se sobrepor para a mesma série.

### `historico_escolar` — um por aluno + nível

```
id, escola_id, aluno_id references alunos(id)
nivel nivel_ensino
observacoes text
created_at, updated_at
unique (escola_id, aluno_id, nivel)
```

### `historico_anos` — um por ano/série cursado, interno ou externo

```
id, historico_id references historico_escolar(id) on delete cascade
ano int
serie_id references series(id)   -- null quando externo
serie_nome text                  -- sempre preenchido; rótulo impresso
origem origem_historico          -- enum: interna | externa
instituicao text, cidade text, uf text   -- externo
resultado resultado_historico    -- enum: aprovado | reprovado | cursando | transferido
media_aprovacao numeric(4,2)
carga_horaria int, dias_letivos int
faltas int, percentual_frequencia numeric(5,2)
congelado boolean not null default false
created_at, updated_at
unique (historico_id, ano)
```

### `historico_notas` — nota por disciplina naquele ano

```
id, historico_ano_id references historico_anos(id) on delete cascade
disciplina_id references disciplinas(id)   -- null quando externa
disciplina_nome text not null              -- sempre preenchido
nota numeric(4,2), carga_horaria int, faltas int
ordem int not null default 0
```

RLS por `escola_id` em todas, no mesmo formato das tabelas existentes. As tabelas
filhas (`historico_anos`, `historico_notas`) herdam via join com o pai.

### Regra do congelamento

Um ano com `origem = 'interna'` e `congelado = false` **não lê**
`historico_notas`. As médias são calculadas na leitura, a partir de
`notas_consolidadas` (média das bimestrais daquela matrícula e disciplina).

Quando a secretária grava esse ano com `resultado != 'cursando'`, a Server Action
copia as médias calculadas para `historico_notas` e seta `congelado = true`. A
partir daí o ano nunca mais recalcula, mesmo que uma nota seja corrigida depois.

Ano externo nasce com `congelado = true` — não há o que calcular.

Não há botão separado de "encerrar ano": o resultado final é o gatilho. Menos UI,
mesma semântica.

## Arquitetura

Rota base `/secretaria/historico` em `src/app/(app)/`. Link manual no array do
[topbar.tsx](src/components/layout/topbar.tsx) — os menus são hardcoded, RBAC só
filtra. Permissões novas: `historico.editar` e `historico.emitir`, registradas em
`src/lib/auth/permissions.ts` (MODULOS + ROTA_PARA_MODULO) e no seed de
`role_permissoes`.

Quatro camadas:

1. **Dados** — `src/lib/data/historico.ts`. Monta `HistoricoData` por aluno:
   credenciamento vigente, dados do aluno, anos, e resolve as notas (congeladas
   lê da tabela, ao vivo calcula de `notas_consolidadas`).
2. **Ações** — `src/lib/actions/historico.ts`. Salvar histórico completo, salvar
   associação, listar elegíveis para emissão.
3. **Gerador** — `src/lib/documents/historico-pdf.ts`. Função pura
   `renderHistoricos(alunos: HistoricoData[], opts): jsPDF`. Não conhece React
   nem Supabase.
4. **UI** — três rotas, componentes em `src/components/historico/`.

**Invariante:** emissão individual e em lote chamam a mesma função. Individual é
`renderHistoricos([aluno], opts)`; lote é `renderHistoricos(todos, opts)`, uma
página por aluno.

## As telas

### 1. Entrada de Notas — `/secretaria/historico/notas`

Header: combobox de aluno (reusa `student-combobox.tsx`) e select de nível
(Fund1 / Fund2 / Médio). Com os dois escolhidos, carrega ou cria o
`historico_escolar`. Um botão Gravar no topo salva tudo numa Server Action.

Quatro abas:

**Aluno selecionado** — read-only: nome, CPF, matrícula, filiação, nascimento,
naturalidade, nacionalidade. De `alunos` + `responsaveis_aluno`.

**Anos e escolas** — formulário (ano, série, resultado, média de aprovação,
instituição, CH, faltas, dias letivos, % frequência) e tabela dos anos já
cadastrados. Anos internos aparecem pré-preenchidos com badge "EPG" e resultado
editável; externos são digitados do zero.

**Notas** — seleciona um ano da lista e edita disciplina × nota × CH × faltas.
Ano interno não-congelado mostra as médias calculadas em cinza, read-only, com a
nota "calculado das avaliações; congela ao encerrar o ano". Ano externo ou
congelado: linhas editáveis, combobox de disciplina mais campo livre.

**Observação** — textarea, grava em `historico_escolar.observacoes`.

### 2. Associação Série/Turma e Empresa — `/secretaria/historico/associacoes`

Formulário: série, credenciamento, nível, ano início, ano fim → Gravar. Tabela
abaixo com as associações e ação de remover. Rejeita ranges sobrepostos para a
mesma série, com mensagem apontando o conflito.

### 3. Emissão — `/secretaria/historico/emissao`

Filtros: ano de referência, modo (série / série+turma / aluno) e o alvo. Lista os
alunos com status por linha (pronto / sem histórico), checkbox por aluno e marcar
todos no cabeçalho.

Emitir gera um PDF único, uma página por aluno, download direto. Alunos sem
histórico são bloqueados com aviso nominal, e a tela oferece emitir apenas os
prontos — em vez de gerar páginas em branco.

## O PDF

A4 retrato, 595 × 842 pt. Todas as coordenadas abaixo foram extraídas do modelo
de referência via pdfjs e são o contrato de layout.

**Cabeçalho** (y 810 → 738, x = 22): nome fantasia bold 8pt, depois razão social,
CNPJ, resolução, endereço, telefones e e-mail em regular 8pt, entrelinha 12pt.
Logo de 157.6 × 88 pt em x = 408.5, topo y = 734
(`docs/referencias/logo-epg.png`, extraído do modelo, publicado como asset).

**Títulos:** `HISTÓRICO ESCOLAR` bold 14pt centrado em y = 708; o nível
(`Ensino Fundamental`) bold 14pt em y = 692; `RESULTADOS REALIZADOS NO ENSINO
FUNDAMENTAL` bold 8pt centrado em y = 606.

**Bloco de identificação** (y 670 → 622): caixas com rótulo 6pt acima e valor
bold 7pt abaixo. Colunas fixas — Aluno x = 22, CPF x = 418.4, Matrícula
x = 497.7; Filiação em largura total; Nascimento x = 22, Naturalidade x = 101.3,
Nacionalidade x = 259.9, RG x = 339.1, Órgão Expedidor x = 418.4, Data de
Expedição x = 497.7.

**Grade principal** (y 595 → 379): coluna Disciplinas de x = 22 a ~139. Séries a
partir de x = 142.8, passo 46.7 pt. Linhas de disciplina com 11 pt de altura,
fonte 7pt. Rodapé da grade: Resultado Final, Carga Horária Anual e Dias Letivos,
rótulo e valores em bold.

**C.H. por disciplina só aparece de Fund2 em diante.** No modelo, 1º a 5º ANO têm
apenas a coluna Média; 6º a 9º têm Média e C.H. lado a lado; a última coluna é
C.H. Total em x ≈ 556. O campo existe no banco para todos os níveis, mas o
layout do Fund1 não o exibe.

**Tabela de estabelecimentos** (y 364 → 256): Série x = 22, Ano x = 139.7,
Estabelecimento x = 166.3, Cidade x = 410.5, UF x = 549.3. Nove linhas fixas (1º
ao 9º), com "-" nas séries não cursadas — a tabela não colapsa.

**Rodapé:** cidade e data em 10pt alinhados à direita em y = 89; duas assinaturas
em y = 39 com o cargo em y = 29, centradas em x ≈ 160 e x ≈ 434, com linha
horizontal acima de cada uma. Nomes e cargos vêm do credenciamento.

**Unificação de disciplinas:** as linhas da grade são unificadas por nome
normalizado (maiúsculas, sem acento), não por `disciplina_id` — senão
"MATEMÁTICA" da EPG e "Matemática" de uma escola externa viram duas linhas. A
grafia impressa é a do primeiro ano em que a disciplina aparece.

## Testes

Vitest, padrão do repositório.

- `historico-grade.test.ts` — unificador de disciplinas: nomes com acentuação e
  caixa diferentes colapsam numa linha; disciplina presente em só um ano gera "-"
  nos demais; ordem das colunas segue a ordem das séries do nível.
- `historico-pdf.test.ts` — `renderHistoricos` com dois anos internos e um
  externo não lança e gera uma página; três alunos geram três páginas.
- `historico-fidelidade.test.ts` — gera o PDF com os dados da Manuela e compara
  as coordenadas extraídas (mesmo pipeline pdfjs usado para levantar o layout)
  contra a tabela de referência, com tolerância de 1 pt. Trava regressão de
  layout.
- `historico-congelamento.test.ts` — gravar ano com resultado diferente de
  'cursando' copia as médias para `historico_notas` e seta `congelado`; reabrir
  não recalcula; alterar uma nota depois não muda o histórico.

## Ordem de construção

1. Migration (enums, cinco tabelas, RLS, permissões)
2. `src/lib/data/historico.ts` e `src/lib/actions/historico.ts`
3. Tela 2 — associações (mais simples; as outras dependem dela)
4. Tela 1 — entrada de notas
5. Gerador de PDF e testes
6. Tela 3 — emissão

## Fora de escopo

- Armazenar o PDF emitido em storage.
- Certificado de conclusão — consome este módulo depois, em trabalho próprio.
- Educação Infantil: o enum `nivel_ensino` a prevê e o modelo a suporta, mas não
  há layout desenhado para ela. O modelo de referência é do Fundamental.
- Transferência e declaração de escolaridade.
