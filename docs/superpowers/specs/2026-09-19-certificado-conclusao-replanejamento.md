# Certificado de Conclusão — replanejamento

Data: 2026-09-19
Status: aprovado, substitui o plano de 2026-09-17

## Por que replanejar

A spec e o plano do certificado são de **17/09**. O Histórico Escolar foi
especificado em **18/09** e implementado logo depois — e a spec do histórico já
registrou a mudança de rumo:

> `certificado_historico` … **Essa parte fica obsoleta.** O histórico escolar
> passa a ser o módulo base, e o certificado vira consumidor: quando for
> implementado, lê `historico_escolar` em vez de manter grade própria.
> — `2026-09-18-historico-escolar-design.md:26-33`

O plano de 17/09 nunca foi atualizado. Executá-lo como está construiria um
segundo histórico, em jsonb, ao lado do que já está em produção.

## Estado verificado (2026-09-19)

**Histórico: implementado e em produção.**

| Camada | O que existe |
|---|---|
| Schema | 4 tabelas (`historico_escolar`, `historico_anos`, `historico_notas`, `historico_niveis_ensino`) + 4 migrations `202609180001`–`0004`, RLS por `escola_id` |
| Tipos | `src/lib/historico/tipos.ts` — `HistoricoData`, `HistoricoAno`, `HistoricoNota`, `HistoricoCredenciamento`, `HistoricoAluno` |
| Regras puras | `grade.ts` (`montarGrade`, `normalizarDisciplina`), `medias.ts`, `congelamento.ts`, `associacoes.ts`, `elegiveis.ts`, `filiacao.ts` — todos com teste |
| Dados | `src/lib/data/historico.ts` (`getHistoricoAluno`, `getCredenciamentoVigente`, …) e `historico-elegiveis.ts` (`listarElegiveis`) |
| Gerador | `historico-pdf.ts` → `renderHistoricos(alunos, opts): jsPDF` — síncrono, puro, A4 retrato, 1 página/aluno. 3 suítes de teste, incluindo fidelidade por coordenada |
| UI | `/historico/notas`, `/historico/associacoes`, `/historico/emissao` |
| RBAC | módulo `historico` registrado e seedado; menu com 3 filhos no topbar |

**Certificado: zero linhas.** Sem migration, sem rota, sem branch, sem issue e
sem PR no GitHub. Os breadcrumbs das telas de histórico já dizem
"Histórico e **Certificado**" (`notas/page.tsx:26`, `emissao/page.tsx:41`) — a
casa estava reservada.

## O que muda em relação ao plano de 17/09

O plano antigo tem 10 tasks e 3.682 linhas. Mais da metade recria o histórico.

| Task de 17/09 | Destino |
|---|---|
| 1 — migração `certificado_historico` + tipos de histórico | **Corta a parte de histórico.** Sobra só `certificado_config` |
| 2 — extrair `pdf-utils.ts` | **Mantém**, reduzida (os helpers estão num arquivo só, não duplicados) |
| 3 — montador do texto do corpo | **Mantém integralmente.** É o núcleo real do certificado |
| 4 — gerador pág. 1 | **Mantém**, ajustado para `doc` compartilhado |
| 5 — gerador pág. 2 (grade, registro) ≈430 linhas | **Corta.** `renderHistoricos` já faz, com fidelidade testada |
| 6 — camada de dados | **Reduz** a config + escola. Elegíveis e filiação já existem |
| 7 — Server Actions | **Reduz** a salvar config. `carregarHistoricosAction` já existe |
| 8 — tela com 5 abas | **Mantém**, com 4 abas (a de histórico sai) |
| 9 — editor de grade ≈550 linhas | **Corta.** É a tela `/historico/notas` |
| 10 — verificação no app | **Mantém** |

Resultado: de 10 tasks para 6, e some a tabela `certificado_historico`.

## Decisões deste replanejamento

| Decisão | Escolha | Por quê |
|---|---|---|
| Fonte do histórico | `historico_escolar` via `carregarHistoricosAction` | Decisão de 18/09 já registrada. Evita dois históricos divergentes |
| Verso do certificado | `renderHistoricos` intacto, A4 **retrato**, como pág. 2 | jsPDF aceita orientação por página. Preserva a fidelidade por coordenada já testada; diff zero no gerador do histórico |
| Rota e RBAC | `/historico/certificado`, módulo `historico` | Módulo já existe e está seedado; nenhuma migration de RBAC. Breadcrumbs já anunciam |
| Snapshot | Nenhum novo | `historico_anos.congelado` já é o mecanismo de congelamento |
| Config do certificado | `certificado_config`, 1 linha por escola | Único dado novo: texto, base legal, leiaute, assinaturas |

### Descartado

**`certificado_historico` (jsonb).** Substituída pelas tabelas normalizadas do
histórico. Era a peça central do plano de 17/09.

**Histórico redesenhado em paisagem para o verso.** Exigiria exportar os blocos
privados de `historico-pdf.ts`, refazer as 14 âncoras de
`historico-coordenadas.ts` e manter dois layouts do mesmo documento. O ganho é
estético; o custo é um segundo gerador para manter.

**Módulo RBAC `certificados` próprio.** Daria permissão granular (emitir
certificado sem editar notas), mas custa migration + 3 pontos de registro. Se a
granularidade for pedida depois, é uma migration isolada.

## Arquitetura

Reuso, não reconstrução:

```
carregarHistoricosAction(alunoIds, "medio")  ──► HistoricoData[]   (já existe)
listarElegiveis(filtro)                      ──► AlunoElegivel[]   (já existe)
getCertificadoConfig()                       ──► CertificadoConfig (novo)

               ▼
renderCertificados(alunos, opts, historicos)  (novo, síncrono, puro)
   │
   ├─ pág. ímpar  [paisagem]  cabeçalho, título, corpo, data, assinaturas  (novo)
   └─ pág. par    [retrato ]  renderHistoricos → páginas anexadas          (reuso)
```

**Invariante mantida do plano antigo:** preview e emissão chamam a mesma função.

## Dados

Uma tabela nova. Nenhuma alteração estrutural em tabela existente.

### `certificado_config` — uma linha por escola

```
id, escola_id (unique)
titulo_certificado, texto_inicio, descricao_curso, base_legal
texto_customizado text null
mostrar_historico boolean
leiaute jsonb      -- orientação, margens, fonte, logos, moldura
assinaturas jsonb  -- [{nome, cargo}]
created_at, updated_at
```

RLS por `escola_id`, no formato das tabelas do histórico.

Sem coluna de registro nº/livro/folha: `historico_escolar.observacoes` já existe,
e numeração de registro estava fora de escopo na spec original.

## Dívidas do histórico que o certificado herda

Três defeitos reais, encontrados no mapeamento. Entram como tasks porque o
certificado imprime exatamente esses campos.

1. **`nacionalidade`, `orgao_expedidor` e `data_expedicao` não são lidas.**
   A migration `202609180004` criou as três colunas em `alunos`, mas
   `src/lib/data/historico.ts:189` não as pede no select e `:268-271` hardcoda
   `null`, com comentário obsoleto em `:179-181` dizendo que não existem. O PDF
   do histórico imprime esses campos em branco mesmo com dado no banco. O
   certificado precisa de `nacionalidade` no parágrafo do corpo.
   Correção: uma linha no select e três no mapeamento.

2. **`data_nascimento` sai como ISO cru.** `historico-pdf.ts:174` imprime
   `a.dataNascimento` direto. O certificado precisa de `dd/mm/aaaa`; o
   formatador do certificado corrige nos dois documentos.

3. **Logo hardcoded.** `emissao-form.tsx:45` busca
   `/historico/logo-epg.png` do diretório público e ignora
   `credenciamento.logoPath`, que já vem carregado no tipo. Fora do caminho
   crítico do certificado — fica registrado, não corrigido aqui.

## Fora de escopo

- Salvar o PDF emitido em `documentos_aluno` (só download, como o histórico)
- Numeração automática de registro nº, livro e folha
- Assinatura digital ou QR de validação
- Histórico de emissões e reimpressão auditada
- Certificado para níveis que não sejam Ensino Médio
- Corrigir o logo hardcoded do histórico (dívida 3 acima)
