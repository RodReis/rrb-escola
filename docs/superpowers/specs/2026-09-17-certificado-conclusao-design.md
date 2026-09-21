# Certificado de conclusão — design

Data: 2026-09-17
Status: ⚠️ **parcialmente obsoleta.** Ver
[2026-09-19-certificado-conclusao-replanejamento.md](2026-09-19-certificado-conclusao-replanejamento.md)

> A seção **Dados** (tabela `certificado_historico`, snapshot jsonb da grade) e o
> **Pré-preenchimento** ficaram obsoletos quando o módulo Histórico Escolar foi
> implementado em 18/09 — decisão registrada em
> [2026-09-18-historico-escolar-design.md:26-33](2026-09-18-historico-escolar-design.md).
> O certificado passa a ler `historico_escolar`.
>
> Continuam válidos: o problema, o objetivo, a arquitetura em 3 camadas, a
> invariante preview/emissão, o desenho da tela e o tratamento de erros.

## Problema

A escola emite certificados de conclusão em Word, um por aluno, redigitando dados
que já existem no sistema. O documento real (PDF de referência fornecido pelo
usuário) tem duas páginas em paisagem: o certificado e, no verso, o histórico
escolar com a grade de componentes curriculares e um bloco lateral de registro.

Não existe nada de certificado no código hoje.

## Objetivo

Uma tela de parâmetros com preview, onde a secretária configura o certificado uma
vez, confere na tela e emite para a turma inteira num PDF único.

## Decisões

| Decisão | Escolha | Por quê |
|---|---|---|
| Motor | jsPDF, layout no código | Grade do histórico, registro lateral, paisagem e moldura são inviáveis no motor .docx atual |
| Escopo | Certificado + histórico (2 páginas) | O histórico é o verso do certificado do Ensino Médio; sem ele o documento não serve ao EM |
| Elegíveis | Matrículas ativas do filtro + seleção manual | Não existe regra de aprovação consolidada e confiável no sistema |
| Dados do histórico | Híbrido: pré-preenche do sistema, secretária completa | Anos 2022–2024 são anteriores ao sistema; C.H. e dias letivos não existem em nenhuma tabela |
| Persistência do histórico | Snapshot em tabela própria | Certificado emitido é documento legal: não deve mudar se uma nota for corrigida depois |
| Emissão | Lote e individual, ambos com histórico, tudo parametrizado | Pedido explícito do usuário |

### Descartado

**Modelar carga horária, dias letivos e resultado final como dado acadêmico de
primeira classe** (colunas em `series`, `disciplinas`, `calendario_letivo`,
`matriculas`). Mais correto no longo prazo e serviria boletim e transferência, mas
é outro projeto: mexe em tabelas de vários módulos e ainda deixaria 2022–2024
vazios. O snapshot resolve o problema real agora.

## Arquitetura

Rota `/secretaria/certificados` em `src/app/(app)/`. Link manual no array do
[topbar.tsx](src/components/layout/topbar.tsx) — os menus são hardcoded, RBAC só
filtra — e permissão nova `certificados.emitir`.

Três camadas:

1. **Dados** — `src/lib/data/certificados.ts`. Carrega config da escola, lista
   alunos elegíveis do filtro, monta `CertificadoData` por aluno.
2. **Gerador** — `src/lib/documents/certificado-pdf.ts`. Função pura
   `renderCertificados(alunos: CertificadoData[], opts: CertificadoOptions): jsPDF`.
   Não conhece React nem Supabase.
3. **UI** — `page.tsx` (server: config, séries, turmas), `certificado-form.tsx`
   (client: abas e estado), `certificado-preview.tsx` (client: iframe com blob URL).

**Invariante central:** preview e emissão chamam a mesma função. Preview é
`renderCertificados([primeiroSelecionado], opts)` num iframe; emitir é
`renderCertificados(todosSelecionados, opts).save()`. O que se vê é o que sai.

## Dados

Duas tabelas novas. Nenhuma tabela existente é alterada estruturalmente.

### `certificado_config` — uma linha por escola

```
id, escola_id (unique)
texto_inicio, descricao_curso, base_legal, titulo_certificado
mostrar_historico boolean, registro_em_branco boolean
leiaute jsonb      -- orientação, margens, fonte, moldura, exibição de logos
assinaturas jsonb  -- [{nome, cargo, ordem}]
created_at, updated_at
```

RLS por `escola_id`, no mesmo formato de `templates_documentos`.

### `certificado_historico` — uma linha por matrícula

```
id, escola_id, matricula_id (unique), aluno_id
ensino_anterior jsonb  -- {nivel, escola, cidade, uf, ano}
grade jsonb            -- [{componente, parte, series: [{serie, media, ch}], chTotal}]
series_resumo jsonb    -- [{serie, ano, estabelecimento, cidade, uf, resultado, chAnual, diasLetivos}]
observacoes text
registro_numero, registro_livro, registro_folha
preenchido_em, created_at, updated_at
```

RLS por `escola_id`.

### Colunas em `alunos`

- `nacionalidade text default 'BRASILEIRA'`
- Filiação: derivada de `responsaveis_aluno.parentesco` (pai/mãe) com fallback
  editável na tela. Sem tabela nova.

### Pré-preenchimento

Ao abrir o histórico de um aluno sem linha em `certificado_historico`, monta um
rascunho a partir de:

- `matriculas` — anos cursados na escola, série de cada ano
- `notas`, `avaliacoes`, `disciplinas` — médias por disciplina e ano

Ficam em branco para digitação: carga horária, dias letivos, resultado final,
escola de origem do ensino anterior, registro nº/livro/folha, observações.

Salvou, vira snapshot: não recalcula mais.

## A tela

Duas colunas: parâmetros em abas à esquerda, preview à direita. O preview
atualiza 400ms após qualquer mudança, sempre do primeiro aluno selecionado.

**Filtros** — ano letivo, filtrar por série ou turma, série/turma, data de
emissão, título do certificado. Abaixo, a lista de elegíveis: checkbox por aluno,
marcar todos no cabeçalho, contador, e status do histórico por aluno
(preenchido / pendente).

**Conteúdo** — conteúdo customizado (sim/não), início do texto, ano de conclusão,
descrição do curso, base legal. Com "não", o parágrafo é montado do template
padrão com os campos do aluno em negrito. Com "sim", textarea livre com
placeholders (`{{aluno}}`, `{{ano}}`, …).

**Histórico escolar** — mostrar/ocultar, registro em branco (sim/não). Com
"mostrar": seletor de aluno, editor de grade daquele aluno (componentes × séries,
C.H., resultado, dias letivos, estabelecimentos, observações) pré-preenchido,
filtro de quais séries entram na grade, botão salvar.

**Opções de leiaute** — orientação (paisagem por padrão), margens, fonte e
tamanho, exibição de logos e brasões, moldura.

**Assinatura** — linhas de assinatura (nome + cargo), adicionar, remover,
reordenar. Padrão: Aluno, Secretária, Diretora.

**Rodapé fixo** — "Salvar como padrão" e "Emitir selecionados (N)".

### Emissão em lote

Valida antes de gerar. Com histórico ligado e algum selecionado pendente,
bloqueia e lista quem falta, oferecendo emitir apenas os prontos. Gera um PDF
único de 2N páginas, nomeado `certificados-<serie>-<ano>.pdf`.

## Gerador

jsPDF paisagem A4 (297×210mm), seguindo o padrão de
[export-boletim-button.tsx](src/components/pdf/export-boletim-button.tsx). Os
helpers `urlToDataUrl` e `imgFitInBox`, hoje duplicados em vários
`export-*-button.tsx`, são extraídos para `src/lib/documents/pdf-utils.ts`.

Funções internas, uma por bloco, todas no formato `(doc, y, data, opts) => y`:

- `renderCabecalho` — brasão à esquerda, logos e dados da mantenedora ao centro,
  brasão à direita
- `renderTitulo`
- `renderCorpo` — parágrafo justificado com campos em negrito
- `renderDataLocal`
- `renderAssinaturas` — N linhas distribuídas na largura
- `renderHistorico` — página 2: grade via `jspdf-autotable` (já é dependência),
  caixas de estabelecimentos, observações
- `renderRegistro` — caixa lateral direita da página 2, desenhada à parte
  (autotable não faz layout lateral)

`renderCorpo` é a parte de maior risco: jsPDF não tem rich text. O parágrafo é
montado como lista de `{texto, negrito}` e desenhado palavra a palavra com quebra
manual. Se o resultado não ficar aceitável, o plano B é `doc.html()` com HTML.

## Erros

| Situação | Comportamento |
|---|---|
| Logo ou brasão não carrega | Renderiza sem a imagem; não quebra |
| Aluno sem nome ou data de nascimento | Marcado como inválido na lista, fica fora do lote, `toast.warning` nomeando quem |
| Histórico pendente com "mostrar" ligado | Bloqueia antes de gerar, lista os pendentes |
| Falha no jsPDF | `toast.error`; emissão não tem efeito colateral no banco |

## Teste

`certificado-pdf.test.ts` (vitest): monta dois alunos fake, chama
`renderCertificados` e verifica que o documento tem 4 páginas com histórico e 2
sem, e que o parágrafo do corpo não estoura a largura útil. Sem snapshot de PDF
binário.

## Fases

1. **Fundação** — migração das duas tabelas e da coluna em `alunos`;
   `src/lib/data/certificados.ts`; extração de `pdf-utils.ts`. Sem UI.
2. **Gerador** — `certificado-pdf.ts` completo e seu teste. Validável sem tela.
3. **Tela** — rota, abas, seleção de alunos, preview, salvar config, link no
   topbar, permissão RBAC.
4. **Histórico editável** — editor de grade, pré-preenchimento, salvar snapshot,
   validação de pendentes.
5. **Lote** — PDF único multi-aluno, bloqueios, nome de arquivo.

Cada fase fecha com `npm run typecheck && npm run build` verdes. `npm run test`
antes do PR. Branch `feat/certificados`, um commit por fase.

## Fora de escopo

- Salvar o PDF emitido em `documentos_aluno` (hoje é só download)
- Numeração automática de registro nº, livro e folha
- Assinatura digital ou QR de validação
- Histórico de emissões e reimpressão auditada
