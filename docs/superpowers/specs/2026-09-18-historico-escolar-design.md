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

Rota base `/secretaria/historico` (implementado como `/historico` — não existe
prefixo `/secretaria` neste projeto) em `src/app/(app)/`. Link manual no array do
[topbar.tsx](src/components/layout/topbar.tsx) — os menus são hardcoded, RBAC só
filtra. Permissões novas: `historico.editar` e `historico.emitir` (implementado
como módulo `historico` + ações padrão read/create/update/delete — não há
permissões nomeadas neste RBAC), registradas em
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

## Execução real (18–19/09/2026)

O módulo foi construído conforme o plano (migração, telas, gerador de PDF) e
depois estendido para dois problemas que só apareceram em uso: o layout do PDF
não batia com o modelo oficial em detalhe, e a base não tinha histórico algum
anterior a 2026 nem os alunos que já haviam saído da escola.

### Correções de layout (fidelidade ao modelo)

- **`c56e2f6c`** — a grade saía sem bordas e o rodapé (resultado final, carga
  horária, dias letivos) sobrepunha a última linha de disciplina em turmas com
  muitas disciplinas (Fund2/Médio, ≥15 linhas). Reescrito o cálculo de altura
  da grade em `src/lib/documents/historico-pdf.ts` para reservar o espaço do
  rodapé antes de desenhar as linhas, e adicionadas as linhas de grade
  (`historico-coordenadas.ts`). Teste de fidelidade adicionado para o caso
  denso (21 disciplinas).
- **`d66754ea`** — cabeçalho (mantenedora, logo), filiação e as duas
  assinaturas estavam faltando no PDF gerado; só a grade e a tabela de
  estabelecimentos saíam. Corrigido em `historico-pdf.ts`; extraída
  `src/lib/historico/filiacao.ts` para decidir pai/mãe/responsável a partir dos
  dados de `responsaveis_aluno`.

Resultado: **7 testes de layout** em
`src/lib/documents/historico-layout.test.ts`, incluindo o caso denso.

### Importação em massa dos PDFs históricos (2009–2025)

`scripts/importar_historico_pdf.mjs` (criado em `19c0309b`, evoluído em
`c9c6259b`, `03ae80e1`, `9d9895c4`) lê os 136 PDFs oficiais em
`~/OneDrive/Desktop/histo/<ano>/*.pdf` — a mesma fonte usada depois para a
correção do ano letivo (`[[project_ano_letivo_correcao]]`) — e faz upsert em
`historico_escolar`/`historico_anos`/`historico_notas` por
`(historico_id, ano)`, então rodar de novo não duplica.

Problemas encontrados e corrigidos durante a importação, cada um só visível
depois de rodar contra os PDFs reais:

1. **`c9c6259b`** — ano importado nascia sem `congelado = true`, então a regra
   de "ano ao vivo recalcula, ano fechado não" fazia esses anos históricos
   desaparecerem do PDF na primeira leitura seguinte.
2. **`03ae80e1`** — `listarElegiveis` (`src/lib/data/historico-elegiveis.ts`)
   filtrava só `status = 'ativa'`. Um ano letivo encerrado tem toda matrícula
   como `'concluida'`, então pedir a emissão de qualquer ano passado voltava
   vazia — só 2026 funcionava. Passou a aceitar `'ativa'` e `'concluida'`.
   Nessa mesma correção, a importação passou a aceitar a pasta raiz
   `histo/` inteira (descendo um nível por `<ano>/`), em vez de uma pasta por
   vez.
3. **`65cdfeb8`** — as associações série↔empresa (tela de Associações) só
   cobriam 2026. Sem associação para o ano, a emissão não achava a empresa
   credenciada e o PDF saía sem cabeçalho, cidade ou assinaturas para
   qualquer ano anterior. `scripts/associacoes_retroativas.mjs` criou uma
   faixa por série cobrindo o período real de cada uma (ex.: 1º ANO
   2015–2025), sem duplicar as 5 associações de 2026 já existentes. A empresa
   nunca é adivinhada pelo nome (o PDF diz "EPG TRINDADE", o cadastro guarda
   a razão social) — resolvida por `--empresa` explícito, pela empresa já
   usada nas associações existentes, ou pela única ativa.
4. **`9d9895c4`** — 163 pessoas dos PDFs não casavam com nenhum aluno da
   base porque a base só continha alunos ativos: ex-alunos nunca haviam sido
   migrados, não estavam escondidos, não existiam como registro. A importação
   passou a cadastrar automaticamente quem aparece no PDF mas não existe na
   base, como aluno **inativo** (`ativo = false`), preenchendo nome, CPF,
   matrícula, nascimento, naturalidade, nacionalidade, RG, órgão expedidor,
   data de expedição e filiação (`responsaveis_aluno`, sem inferir
   parentesco — o documento não distingue pai/mãe e a ordem varia). Sem
   matrícula: a tabela `matriculas` exige `turma_id`, plano e valor, que o
   histórico não informa e que não deveria ser inventado sob risco de sujar
   relatórios financeiros. Matrícula já ocupada por outro aluno vira
   `EX-<cpf>` para não colidir. A tela de Lista de Alunos ganhou filtro
   **Situação** (Ativos / Ex-alunos / Todos).

### Números finais (base local, `histo/` completa reimportada)

| Métrica | Valor |
|---|---|
| Alunos com histórico | 445 |
| Anos de histórico (`historico_anos`) | 1.729 |
| Notas (`historico_notas`) | 15.203 |
| Anos internos resolvendo empresa credenciada | 1.327 / 1.327 |
| Ex-alunos cadastrados a partir do PDF (`ativo = false`) | **68** |
| Anos cobertos | 2009–2026 (2026 vem embutido nos PDFs de 2025, que trazem a trajetória completa do aluno) |

### Pendência conhecida: 302 anos de histórico órfãos

Consulta pós-incidente encontrou 302 registros em `historico_anos` (origem
`'interna'`) sem matrícula correspondente em `ano_letivo` igual. **Não é
efeito colateral da correção do ano letivo nem das 14 remoções de duplicata**
— é o grupo A do defeito de ano letivo (`[[project_ano_letivo_correcao]]`),
deliberadamente fora de escopo: para esses alunos o histórico (fonte de
verdade) está sempre um ano à frente da matrícula. Ex.: aluno 1131 tem
histórico `2021/2º ANO` mas matrícula `2020/2º ANO`; só 2026 coincide nos
dois, e coincide justamente porque a duplicata de 2025 desse aluno foi
removida na correção cirúrgica.

Efeito prático: a emissão por ano letivo não encontra esses alunos no ano que
o histórico registra (achar a matrícula pelo `ano_letivo` da UI falha; o PDF
em si, quando gerado, sai correto porque lê direto do histórico). Corrigir
exigiria revisitar o grupo A, o que o usuário decidiu não fazer por criar
matrículas fantasma em 2027 para ex-alunos já formados.
