# Certificado de Conclusão — plano de implementação (replanejado)

> **Substitui** `2026-09-17-certificado-conclusao.md`, escrito antes do módulo
> Histórico Escolar existir. Aquele plano recria o histórico; este o consome.
>
> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development
> (recomendado) ou superpowers:executing-plans. Steps usam checkbox (`- [ ]`).

**Goal:** Tela de parâmetros com preview onde a secretária configura o
certificado de conclusão e emite, num PDF único, para a turma inteira — com o
histórico escolar já existente como verso.

**Architecture:** O certificado é uma página nova (paisagem) + o histórico atual
(retrato) anexado como verso. Gerador puro `certificado-pdf.ts`, que não conhece
React nem Supabase e delega o verso a `renderHistoricos`. Camada de dados só para
a config. Elegíveis, filiação, grade e o PDF do histórico já existem.

**Spec:** [docs/superpowers/specs/2026-09-19-certificado-conclusao-replanejamento.md](../specs/2026-09-19-certificado-conclusao-replanejamento.md)
**Spec original (parcialmente obsoleta):** [2026-09-17-certificado-conclusao-design.md](../specs/2026-09-17-certificado-conclusao-design.md)

## Global Constraints

- **Português (PT-BR)** em UI, colunas e mensagens.
- **Cor só via token** no JSX/CSS. Não vale para o PDF: jsPDF exige RGB numérico.
- **Sem serifa na UI.** O PDF do certificado usa `times` (documento oficial); o do
  histórico usa as fontes internas do jsPDF — não mexer nisso.
- **Nunca usar `confirm()` nativo.** Usar `useConfirm` ou `ConfirmButton`.
- **Trava por task:** `npm run typecheck && npm run build` verdes antes do commit.
  `npm run test` antes do PR.
- **Branch dedicada:** `feat/certificados`. Um commit por task.
- **Migrações:** `2026MMDDNNNN_<descricao>.sql`. Validar por review e `db push` —
  **não** rodar `supabase db reset --local` (quebrado neste repo, ordem de
  `inss_brackets`).
- **Escola padrão:** `DEFAULT_SCHOOL_ID` de `@/lib/constants`.
- **RBAC:** reusa o módulo `historico`, que já existe e está seedado. **Não**
  criar módulo novo, **não** editar `MODULOS`. Só a rota entra em
  `ROTA_PARA_MODULO` — e mesmo isso é opcional, porque o mapeamento é
  longest-prefix e `/historico` já cobre `/historico/certificado`.
- **Toda Server Action começa com `requirePermission("historico", acao)`.**

---

## File Structure

**Criados:**

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/202609190001_certificado_config.sql` | Tabela `certificado_config` + RLS |
| `src/lib/documents/pdf-utils.ts` | `urlToDataUrl`, `imgFitInBox` — extraídos do boletim |
| `src/lib/documents/certificado-tipos.ts` | `CertificadoOptions`, `CertificadoAluno`, `CertificadoEscola`, `CertificadoData`, `CERTIFICADO_DEFAULTS` |
| `src/lib/documents/certificado-texto.ts` | Montagem do parágrafo em segmentos `{texto, negrito}`. Puro |
| `src/lib/documents/certificado-texto.test.ts` | Teste do montador |
| `src/lib/documents/certificado-pdf.ts` | `renderCertificados()` |
| `src/lib/documents/certificado-pdf.test.ts` | Teste do gerador |
| `src/lib/data/certificados.ts` | Config + dados da escola para o cabeçalho |
| `src/lib/actions/certificados.ts` | Server Action: salvar config |
| `src/app/(app)/historico/certificado/page.tsx` | Server Component |
| `src/components/historico/certificado-form.tsx` | Client: abas e orquestração |
| `src/components/historico/certificado-preview.tsx` | Iframe com blob URL, debounce 400ms |

**Modificados:**

| Arquivo | Mudança |
|---|---|
| `src/lib/data/historico.ts` | Lê `nacionalidade`, `orgao_expedidor`, `data_expedicao` (dívida 1) |
| `src/lib/documents/historico-pdf.ts` | `data_nascimento` formatada (dívida 2); `renderHistoricos` aceita `doc` opcional |
| `src/components/pdf/export-boletim-button.tsx` | Passa a importar de `pdf-utils` |
| `src/components/layout/topbar.tsx` | 4º filho no item Histórico Escolar |
| `src/lib/auth/permissions.ts` | `"/historico/certificado"` em `ROTA_PARA_MODULO` (explícito) |

**Não são criados** (existem): tipos de histórico, editor de grade, camada de
dados do histórico, elegíveis, filiação, gerador da grade, migration de RBAC.

---

### Task 1: Dívidas do histórico

Os campos que o certificado imprime estão quebrados no histórico. Corrigir antes
de construir em cima.

**Files:**
- Modify: `src/lib/data/historico.ts` (:179-181, :189, :268-271)
- Modify: `src/lib/documents/historico-pdf.ts` (:174)
- Test: `src/lib/documents/historico-pdf.test.ts` (novo caso)

**Interfaces:**
- Consumes: nada
- Produces: `HistoricoAluno.nacionalidade/orgaoExpedidor/dataExpedicao` passam a
  vir preenchidos; data de nascimento sai `dd/mm/aaaa`

- [ ] **Step 1: Confirmar que as colunas existem**

```bash
cat supabase/migrations/202609180004_alunos_documentos_historico.sql
```
Esperado: `nacionalidade text`, `orgao_expedidor text`, `data_expedicao date`
adicionadas em `alunos`. Se alguma não existir, remover do escopo desta task e
anotar no commit.

- [ ] **Step 2: Ler as colunas**

Em `src/lib/data/historico.ts`:

1. Apagar o comentário obsoleto de `:179-181` (ele afirma que as colunas não
   existem — a migration `202609180004` as criou).
2. No select de `alunos` (`:189`), acrescentar os três campos:

```typescript
.select("id, nome, cpf, matricula_codigo, data_nascimento, naturalidade, rg, nacionalidade, orgao_expedidor, data_expedicao")
```

3. No mapeamento (`:268-271`), trocar os `null` hardcoded pelos valores:

```typescript
      nacionalidade: (aluno.nacionalidade as string) ?? null,
      orgaoExpedidor: (aluno.orgao_expedidor as string) ?? null,
      dataExpedicao: (aluno.data_expedicao as string) ?? null
```

- [ ] **Step 3: Escrever o teste da data que falha**

Em `src/lib/documents/historico-pdf.test.ts`, acrescentar um caso que gere um
histórico com `dataNascimento: "2006-11-22"` e verifique que o texto do PDF traz
`22/11/2006` e **não** `2006-11-22`. Usar o mesmo padrão de inspeção dos casos já
existentes no arquivo (conferir como `historico-fidelidade.test.ts` lê o
conteúdo antes de escrever).

Run: `npm run test -- src/lib/documents/historico-pdf.test.ts`
Expected: FAIL no caso novo.

- [ ] **Step 4: Formatar a data**

Em `historico-pdf.ts:174`, trocar a impressão crua de `a.dataNascimento` por uma
formatação `dd/mm/aaaa`. Fazer o parse por regex sobre a string ISO — **não**
`new Date(iso)`, que interpreta como UTC e desloca o dia em fusos negativos.
Data ausente vira string vazia, não `"Invalid Date"`.

Esta função será extraída para `certificado-texto.ts` na Task 3 como
`formatarDataCurta`; ao chegar lá, o histórico passa a importá-la e a cópia local
some.

- [ ] **Step 5: Verificar**

```bash
npm run test -- src/lib/documents/
npm run typecheck
```
Esperado: verdes. As suítes de fidelidade e layout precisam continuar passando —
a formatação muda o texto, não as coordenadas. Se `historico-fidelidade.test.ts`
quebrar, é sinal de que a âncora comparava o conteúdo: ajustar o teste, não o
layout.

- [ ] **Step 6: Commit**

```bash
git add src/lib/data/historico.ts src/lib/documents/historico-pdf.ts src/lib/documents/historico-pdf.test.ts
git commit -m "fix(historico): le nacionalidade/RG expedidor e formata data de nascimento"
```

---

### Task 2: Migration da config e `pdf-utils`

**Files:**
- Create: `supabase/migrations/202609190001_certificado_config.sql`
- Create: `src/lib/documents/pdf-utils.ts`
- Modify: `src/components/pdf/export-boletim-button.tsx:12,45`
- Modify: `src/lib/auth/permissions.ts` (`ROTA_PARA_MODULO`)

**Interfaces:**
- Consumes: nada
- Produces: tabela `certificado_config`; `urlToDataUrl`, `imgFitInBox`

- [ ] **Step 1: Escrever a migration**

Criar `supabase/migrations/202609190001_certificado_config.sql`:

```sql
-- Certificado de conclusao: parametros por escola.
-- O historico escolar (verso) vem de historico_escolar; nao ha snapshot proprio.

create table if not exists public.certificado_config (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  titulo_certificado text not null default 'Certificado',
  texto_inicio text not null default 'A Diretora da',
  descricao_curso text not null default 'ENSINO MÉDIO',
  base_legal text not null default 'sob a Resolução CEE/CEB N.01, de 14 de janeiro de 2022 de acordo com a Lei Nº 9394 de 20 de dezembro de 1996.',
  texto_customizado text,
  mostrar_historico boolean not null default true,
  leiaute jsonb not null default '{}'::jsonb,
  assinaturas jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (escola_id)
);

create trigger certificado_config_updated_at
  before update on certificado_config
  for each row execute function set_updated_at();

alter table certificado_config enable row level security;

create policy certificado_config_service on certificado_config
  for all to service_role using (true) with check (true);

create policy certificado_config_escola on certificado_config
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

grant select, insert, update, delete on certificado_config to authenticated;

comment on table certificado_config is 'Parametros padrao do certificado de conclusao por escola. O verso vem de historico_escolar.';
```

Sem bloco RBAC: o módulo `historico` já está seedado em
`202609180001_historico_escolar.sql:228-235`.

- [ ] **Step 2: Conferir contra o schema real**

```bash
grep -n "set_updated_at\|current_perfil" supabase/migrations/202609180001_historico_escolar.sql | head -5
```
Esperado: as duas funções são usadas do mesmo jeito lá. O formato das políticas
desta migration tem de bater com o das tabelas do histórico.

- [ ] **Step 3: Extrair `pdf-utils`**

Criar `src/lib/documents/pdf-utils.ts` movendo `urlToDataUrl`
(`export-boletim-button.tsx:12`) e `imgFitInBox` (`:45`) **sem alterar
comportamento**. Manter `"use client"` no topo, como no original.

Em `export-boletim-button.tsx`, apagar as duas funções locais e importar:

```typescript
import { urlToDataUrl, imgFitInBox } from "@/lib/documents/pdf-utils";
```

Mexer **só** no boletim. Os outros `export-*-button.tsx` não usam esses helpers.
`logoParaDataUrl` de `emissao-form.tsx:44` é uma terceira variante ad-hoc —
deixar como está; unificá-la é refactor não relacionado.

- [ ] **Step 4: Registrar a rota**

Em `src/lib/auth/permissions.ts`, dentro de `ROTA_PARA_MODULO`, junto de
`"/historico"`:

```typescript
  "/historico/certificado": "historico",
```

Redundante com o longest-prefix, mas explícito — o leitor de `permissions.ts` vê
a rota sem precisar deduzir. **Não** tocar em `MODULOS`.

- [ ] **Step 5: Verificar**

```bash
npm run typecheck && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/202609190001_certificado_config.sql src/lib/documents/pdf-utils.ts src/components/pdf/export-boletim-button.tsx src/lib/auth/permissions.ts
git commit -m "feat(certificados): migration da config e extracao de pdf-utils"
```

---

### Task 3: Tipos e montador do texto

O parágrafo do certificado tem campos em negrito no meio do texto corrido. jsPDF
não tem rich text, então o texto vira uma lista de segmentos que o gerador
desenha com a fonte certa. Esta task é só a montagem — pura, testável sem PDF.

**Files:**
- Create: `src/lib/documents/certificado-tipos.ts`
- Create: `src/lib/documents/certificado-texto.ts`
- Test: `src/lib/documents/certificado-texto.test.ts`
- Modify: `src/lib/documents/historico-pdf.ts` (importa `formatarDataCurta`)

**Interfaces:**
- Consumes: `HistoricoAluno` de `@/lib/historico/tipos`
- Produces: `CertificadoOptions`, `CertificadoEscola`, `CertificadoAluno`,
  `CertificadoData`, `CERTIFICADO_DEFAULTS`; `Segmento`, `montarCorpo`,
  `formatarDataExtenso`, `formatarDataCurta`

- [ ] **Step 1: Escrever os tipos**

Criar `src/lib/documents/certificado-tipos.ts`. Pontos obrigatórios:

- **`CertificadoAluno` deriva de `HistoricoAluno`**, não o duplica. O histórico já
  traz `nome`, `filiacao`, `dataNascimento`, `naturalidade`, `nacionalidade`,
  `rg`. O certificado acrescenta só o que é dele: `matriculaId`, `serie`,
  `turma`, `anoLetivo`. Preferir
  `type CertificadoAluno = HistoricoAluno & { matriculaId: string; serie: string; turma: string; anoLetivo: number }`.
- **`filiacao` é uma string única** (`"PAI e MÃE"`, de `filiacao.ts:15`), não
  `nomePai`/`nomeMae` separados como no plano antigo. O montador do corpo recebe
  a string pronta.
- `CertificadoEscola` espelha `HistoricoCredenciamento`: `nomeFantasia`, `cnpj`,
  `resolucao`, `endereco`, `cidade`, `uf`, `cep`, `logoPath`. **Não existe campo
  de mantenedora** — `companies.name` alimenta razão social e nome fantasia ao
  mesmo tempo (`historico.ts:25-43`).
- `CertificadoOptions`: `tituloCertificado`, `textoInicio`, `descricaoCurso`,
  `baseLegal`, `anoConclusao`, `dataEmissao`, `textoCustomizado`,
  `mostrarHistorico`, `leiaute`, `assinaturas`.
- `CertificadoLeiaute`: `orientacao`, `margemMm`, `fonteCorpoPt`, `mostrarLogos`,
  `mostrarMoldura`.
- `CERTIFICADO_DEFAULTS`: paisagem, margem 15mm, fonte 11pt, logos ligados,
  moldura desligada; assinaturas padrão Aluno(a) / Secretária / Diretora.

- [ ] **Step 2: Escrever o teste que falha**

Criar `src/lib/documents/certificado-texto.test.ts` cobrindo:

1. **Negrito nos campos certos** — nome, nacionalidade, filiação, naturalidade,
   nascimento formatado, ano de conclusão e curso saem com `negrito: true`.
2. **Parágrafo legível** — juntar os segmentos produz o texto esperado, com a
   base legal ao final e **sem espaço duplo**.
3. **Campos ausentes não deixam buraco** — aluno sem RG, sem filiação e sem
   naturalidade não gera `"null"`, `"undefined"` nem espaço duplo, e ainda diz
   "concluiu no ano letivo de …".
4. **Texto customizado** — `{{aluno}}`, `{{curso}}`, `{{ano}}` são substituídos e
   os valores saem em negrito; placeholder desconhecido fica literal, para a
   secretária enxergar o erro de digitação.
5. **`formatarDataExtenso`** — `"2026-09-17"` → `"17 de setembro de 2026"`, e
   `"2026-01-01"` → `"1 de janeiro de 2026"` (o dia **não** pode deslocar).
6. **`formatarDataCurta`** — `"2006-11-22"` → `"22/11/2006"`; `null` → `""`.

Run: `npm run test -- src/lib/documents/certificado-texto.test.ts`
Expected: FAIL — `Failed to resolve import "./certificado-texto"`.

- [ ] **Step 3: Implementar**

Criar `src/lib/documents/certificado-texto.ts`:

- `partesData(iso)` por **regex**, nunca `new Date(iso)` — este é o bug que o
  teste do dia 1º de janeiro pega.
- `normalizar(segs)`: remove segmentos vazios, funde vizinhos de mesma ênfase,
  colapsa espaços repetidos e apara as bordas. É o que faz campo ausente não
  deixar buraco.
- `montarCorpo(data, opts)`: com `textoCustomizado` preenchido, delega ao
  substituidor de placeholders; senão monta o parágrafo padrão.
- A filiação entra como `" filho(a) de "` + a string pronta do histórico, e o
  trecho inteiro é omitido quando ela é nula.

- [ ] **Step 4: Confirmar que passa**

Run: `npm run test -- src/lib/documents/certificado-texto.test.ts`
Expected: PASS.

- [ ] **Step 5: Remover a duplicação de data no histórico**

`historico-pdf.ts` passa a importar `formatarDataCurta` daqui, e a cópia local
criada na Task 1 some. Um formatador de data no projeto, não dois.

Run: `npm run test -- src/lib/documents/`
Expected: verdes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/documents/certificado-tipos.ts src/lib/documents/certificado-texto.ts src/lib/documents/certificado-texto.test.ts src/lib/documents/historico-pdf.ts
git commit -m "feat(certificados): tipos e montador do texto com negrito inline"
```

---

### Task 4: Gerador PDF

Uma página paisagem de certificado por aluno; o verso é o histórico atual,
anexado em retrato.

**Files:**
- Create: `src/lib/documents/certificado-pdf.ts`
- Test: `src/lib/documents/certificado-pdf.test.ts`
- Modify: `src/lib/documents/historico-pdf.ts` (`renderHistoricos` aceita `doc`)

**Interfaces:**
- Consumes: `montarCorpo`, `formatarDataExtenso`; `imgFitInBox`; `renderHistoricos`;
  `HistoricoData`
- Produces:
  `renderCertificados(alunos: CertificadoData[], opts: CertificadoOptions, historicos?: Map<string, HistoricoData>, imagens?: ImagemCache): jsPDF`

`renderCertificados` é **síncrona**, como `renderHistoricos`. As imagens chegam
já baixadas num Map (chave = URL), porque quem chama — preview e emissão —
controla quando o download acontece, e porque teste em node não tem `fetch` de
imagem nem `Image`.

- [ ] **Step 1: Abrir `renderHistoricos` para um `doc` externo**

Hoje `historico-pdf.ts:410` cria o `jsPDF` internamente. Para anexar o histórico
a um documento que já tem a página do certificado, a função precisa aceitar um
`doc` opcional:

```typescript
export function renderHistoricos(
  alunos: HistoricoData[],
  opts: HistoricoPdfOptions = {},
  docExterno?: jsPDF
): jsPDF
```

Regras:
- Sem `docExterno`: comportamento atual, byte por byte. A tela `/historico/emissao`
  não muda e as 3 suítes continuam verdes.
- Com `docExterno`: em vez de criar o documento, chama
  `docExterno.addPage("a4", "portrait")` para **cada** aluno (inclusive o
  primeiro — no fluxo do certificado sempre existe uma página antes) e devolve o
  mesmo `doc`.

O `if (i > 0) doc.addPage()` de `:413` vira uma decisão de "primeira página já
existe?". Manter os blocos `desenhar*` privados — nenhum deles precisa ser
exportado.

- [ ] **Step 2: Escrever os testes que falham**

Criar `src/lib/documents/certificado-pdf.test.ts`:

1. **Uma página por aluno sem histórico** — 2 alunos, `mostrarHistorico: false` →
   2 páginas.
2. **Paisagem A4 por padrão** — página 1 tem ~297mm × ~210mm, largura > altura.
3. **Retrato respeitado** quando `orientacao: "portrait"`.
4. **Duas páginas por aluno com histórico** — 2 alunos com `HistoricoData` no Map
   e `mostrarHistorico: true` → 4 páginas.
5. **Orientação alternada** — com histórico, a pág. 1 é paisagem e a pág. 2 é
   retrato. Verificar por `doc.internal.pageSize` **na página correta** (checar
   como a versão do jsPDF do repo expõe o tamanho por página; se não expuser,
   inspecionar `getPageInfo(n).pageContext.mediaBox`).
6. **Aluno sem histórico no Map** com `mostrarHistorico: true` → só a página do
   certificado, sem quebrar.
7. **Não quebra sem RG nem filiação.**
8. **Lista vazia** → documento de 1 página em branco, não exceção.
9. **O parágrafo não estoura a largura útil** — a palavra mais larga cabe sozinha
   na linha.

Run: `npm run test -- src/lib/documents/certificado-pdf.test.ts`
Expected: FAIL — import não resolve.

- [ ] **Step 3: Implementar**

Criar `src/lib/documents/certificado-pdf.ts` com um bloco por função, todas no
formato `(doc, y, data, opts) => y`:

- `renderMoldura` — retângulo na meia-margem, só se `mostrarMoldura`.
- `renderCabecalho` — logo centralizado (se houver no cache), nome da escola,
  CNPJ, resolução, endereço, cidade/UF/CEP. Linha ausente é omitida, não deixa
  espaço.
- `renderTitulo`.
- `renderCorpo` — **a parte de maior risco.** Cada palavra é medida com a fonte do
  seu segmento e a linha quebra quando a próxima não cabe na largura útil.
  Justificar distribuindo a sobra nos vãos; a **última linha fica à esquerda**
  (justificá-la produz o vão gigante clássico).
- `renderDataLocal` — cidade + data por extenso, à direita.
- `renderAssinaturas` — N colunas na largura útil; `splitTextToSize` no nome para
  não invadir a coluna vizinha. Ancoradas ao rodapé, ou logo abaixo do texto se
  ele for longo (`Math.max`).

E o orquestrador:

```typescript
export function renderCertificados(
  alunos: CertificadoData[],
  opts: CertificadoOptions,
  historicos: Map<string, HistoricoData> = new Map(),
  imagens: ImagemCache = new Map()
): jsPDF {
  const doc = new jsPDF({ orientation: opts.leiaute.orientacao, unit: "mm", format: "a4" });

  alunos.forEach((data, i) => {
    if (i > 0) doc.addPage("a4", opts.leiaute.orientacao);
    renderPaginaCertificado(doc, data, opts, imagens);

    // O verso é o histórico já existente, em retrato, sem redesenhar nada:
    // renderHistoricos abre a própria página no doc recebido.
    const historico = historicos.get(data.aluno.id);
    if (opts.mostrarHistorico && historico) {
      renderHistoricos([historico], { dataEmissao: new Date(opts.dataEmissao) }, doc);
    }
  });

  return doc;
}
```

**Atenção ao `unit`:** o certificado usa `mm` e o histórico usa `pt`. jsPDF fixa a
unidade na criação do documento, então as coordenadas em pontos de
`historico-pdf.ts` seriam lidas como milímetros num doc criado em `mm` — e o
histórico sairia gigante e fora da página. Confirmar isso no Step 4 antes de
seguir; se confirmado, **criar o doc do certificado em `pt`** e converter as
medidas do certificado (`mm * 72 / 25.4`), porque o histórico é pixel-fiel e
testado por coordenada, e o certificado ainda não tem layout travado. A conversão
fica numa constante nomeada, não espalhada por número mágico.

- [ ] **Step 4: Confirmar o comportamento de `unit` e orientação**

Antes de dar a task por fechada, rodar um script de verificação no scratchpad que
gere um PDF de 1 aluno com histórico e imprima, por página, o mediaBox e a
orientação. É o teste 5 em forma executável — serve para descobrir como esta
versão do jsPDF expõe o tamanho por página, informação que o teste precisa.

- [ ] **Step 5: Rodar tudo**

```bash
npm run test -- src/lib/documents/
npm run typecheck
```
Esperado: verdes, **incluindo** `historico-fidelidade.test.ts` e
`historico-layout.test.ts`. Se a fidelidade do histórico quebrou, a mudança do
Step 1 vazou para o caminho sem `docExterno` — corrigir lá, não no teste.

- [ ] **Step 6: Commit**

```bash
git add src/lib/documents/certificado-pdf.ts src/lib/documents/certificado-pdf.test.ts src/lib/documents/historico-pdf.ts
git commit -m "feat(certificados): gerador com historico existente como verso"
```

---

### Task 5: Dados, Server Action e tela

**Files:**
- Create: `src/lib/data/certificados.ts`
- Create: `src/lib/actions/certificados.ts`
- Create: `src/app/(app)/historico/certificado/page.tsx`
- Create: `src/components/historico/certificado-form.tsx`
- Create: `src/components/historico/certificado-preview.tsx`
- Modify: `src/components/layout/topbar.tsx:67-76`

**Interfaces:**
- Consumes: `listarElegiveis`, `separarElegiveis`, `carregarHistoricosAction`,
  `getCredenciamentoVigente`, `renderCertificados`, `getCertificadoConfig`
- Produces: `getCertificadoConfig()`, `getEscolaCertificado()`,
  `salvarCertificadoConfigAction()`, rota `/historico/certificado`

- [ ] **Step 1: Camada de dados**

Criar `src/lib/data/certificados.ts` com **apenas**:

- `getCertificadoConfig(escolaId?)` — lê `certificado_config`; sem linha, devolve
  o padrão. Fazer merge do `leiaute` com `CERTIFICADO_DEFAULTS.leiaute`: config
  antiga não tem campos adicionados depois.
- `getEscolaCertificado(escolaId?)` — dados do cabeçalho. **Reusar
  `getCredenciamentoVigente` de `@/lib/data/historico`**, que já resolve
  `companies` por série+ano e tem o fallback para a associação mais recente.
  Não consultar `escolas` direto: o cabeçalho do histórico e o do certificado têm
  de sair da mesma fonte, ou os dois documentos do mesmo aluno divergem.

**Não** escrever: `getAlunosElegiveis` (é `listarElegiveis`), `extrairFiliacao`
(é `montarFiliacao`), `montarRascunhoHistorico` (é `getHistoricoAluno`),
`getSeriesETurmas` (a tela de emissão já resolve via `getAcademicData`).

- [ ] **Step 2: Server Action**

Criar `src/lib/actions/certificados.ts` com `salvarCertificadoConfigAction`:
`requirePermission("historico", "update")` na primeira linha, upsert em
`certificado_config` por `escola_id`, `revalidatePath("/historico/certificado")`.

Uma action só. `carregarHistoricosAction` de `@/lib/actions/historico` já entrega
`HistoricoData[]` ao cliente — é o que alimenta o verso.

- [ ] **Step 3: A tela**

`page.tsx` (Server): `requirePermission("historico", "read")`, carrega config,
escola e — só se houver filtro nos searchParams — os elegíveis. Espelhar
`emissao/page.tsx`, que já faz exatamente isso.

`certificado-form.tsx` (Client): duas colunas, abas à esquerda e preview à
direita. **Quatro** abas (a de histórico do plano antigo não existe mais — a
edição vive em `/historico/notas`):

1. **Filtros** — ano letivo, série/turma ou aluno, data de emissão. Lista de
   elegíveis com checkbox, "marcar todos", contador e situação por aluno.
   Reaproveitar o padrão de `emissao-form.tsx:82-84,224-239`, inclusive o
   checkbox desabilitado para quem não tem histórico.
2. **Conteúdo** — customizado sim/não, início do texto, ano de conclusão,
   descrição do curso, base legal.
3. **Leiaute** — orientação, margens, fonte, logos, moldura.
4. **Assinatura** — linhas nome + cargo; adicionar, remover, reordenar.

Rodapé fixo: "Salvar como padrão" e "Emitir selecionados (N)".

Emissão: `Promise.all([carregarHistoricosAction(ids, "medio"), logo])` →
`renderCertificados(...).save(\`certificados-${serie}-${ano}.pdf\`)`. Mesma forma
de `emissao-form.tsx:86-105`.

Com `mostrarHistorico` ligado e algum selecionado sem histórico: bloquear,
nomear quem falta e oferecer emitir só os prontos. `separarElegiveis` já devolve
`{prontos, pendentes}`.

`certificado-preview.tsx`: iframe com blob URL, debounce 400ms, sempre do
primeiro aluno selecionado. **Revogar a URL anterior** a cada regeneração —
blob URL não revogada vaza memória a cada tecla digitada. Chama a **mesma**
`renderCertificados` da emissão: o que se vê é o que sai.

- [ ] **Step 4: Menu**

Em `src/components/layout/topbar.tsx`, acrescentar o 4º filho ao item "Histórico
Escolar" (`:67-76`), depois de Emissão:

```typescript
      { href: "/historico/certificado", label: "Certificado" },
```

Copiar a forma exata dos irmãos — o array é hardcoded e o RBAC só filtra.

- [ ] **Step 5: Verificar**

```bash
npm run typecheck && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/data/certificados.ts src/lib/actions/certificados.ts "src/app/(app)/historico/certificado" src/components/historico/certificado-form.tsx src/components/historico/certificado-preview.tsx src/components/layout/topbar.tsx
git commit -m "feat(certificados): tela de parametros com preview e emissao em lote"
```

---

### Task 6: Verificação no app real

Nenhum teste automatizado prova que o PDF *parece* certo.

**Files:** nenhum (só correções pontuais)

- [ ] **Step 1: Aplicar a migration**

```bash
npx supabase db push
```
Esperado: `202609190001_certificado_config.sql` aplicada. **Não** usar
`db reset --local`.

- [ ] **Step 2: Conferir que o histórico não regrediu**

Antes de olhar o certificado, abrir `/historico/emissao`, emitir um aluno e
comparar com um PDF gerado antes desta branch. As Tasks 1 e 4 mexeram no gerador
do histórico; esta é a checagem de que o módulo em produção continua idêntico —
exceto a data de nascimento, que agora sai `dd/mm/aaaa`, e os campos de
nacionalidade/RG, que antes saíam vazios.

- [ ] **Step 3: Certificado sem histórico**

Abrir `/historico/certificado`, escolher ano e série. Conferir: lista de
elegíveis, preview em paisagem, cabeçalho com escola/CNPJ/endereço, parágrafo com
os campos em negrito e sem `"null"` nem espaço duplo, assinaturas no rodapé sem
sobrepor o texto, e preview atualizando em menos de um segundo após editar
"Descrição do curso".

- [ ] **Step 4: Certificado com histórico**

Ligar "Mostrar histórico" e escolher um aluno que tenha histórico cadastrado.
Conferir que a pág. 2 é o histórico **idêntico** ao que sai por
`/historico/emissao` — mesma grade, mesmo cabeçalho, mesmas assinaturas.
Divergência aqui significa que o `doc` compartilhado alterou o caminho do
histórico.

- [ ] **Step 5: Lote**

Selecionar 3 alunos e emitir: 3 páginas sem histórico, 6 com. Conferir que cada
certificado traz o nome certo e que o histórico de cada um segue o seu
certificado, não o do vizinho. Com um selecionado pendente e o histórico ligado,
conferir que a emissão é bloqueada nomeando-o.

- [ ] **Step 6: Corrigir**

Ajustes de espaçamento, fonte e posição vivem em `certificado-pdf.ts` — **nunca**
em `historico-pdf.ts`, cujo layout é travado por teste de coordenada. Um commit
por correção:

```bash
git commit -m "fix(certificados): ajusta <o que foi ajustado>"
```

- [ ] **Step 7: Suíte completa antes do PR**

```bash
npm run typecheck && npm run build && npm run test
```
Esperado: os três verdes.

---

## Notas de execução

**Se `renderCorpo` produzir parágrafo feio** (vãos irregulares, quebra em lugar
estranho), antes de partir para o plano B do spec (`doc.html()`): desligar a
justificação, usando sempre a largura de espaço natural. Justificação com fonte
serifada e palavras longas em português costuma precisar de vão mínimo.

**Se a mistura de unidades entre certificado (`mm`) e histórico (`pt`) der
problema**, a saída é criar o documento em `pt` e converter as medidas do
certificado. A direção contrária — reescrever o histórico em `mm` — invalida
`historico-coordenadas.ts` e as duas suítes de fidelidade. O documento nasce na
unidade do componente mais rígido.

**O logo continua hardcoded** em `/historico/logo-epg.png` no caminho do
histórico (`emissao-form.tsx:45`), ignorando `credenciamento.logoPath` que já vem
carregado. O certificado pode usar a mesma imagem por ora. Unificar é uma task
própria, fora deste plano.

**`companies.name` alimenta razão social e nome fantasia ao mesmo tempo**
(`historico.ts:25-43`) e não existe campo de mantenedora. Se a escola pedir as
duas linhas distintas no cabeçalho, é uma coluna em `companies` mais um campo na
tela de empresa — fora deste plano, e afeta os dois documentos.
