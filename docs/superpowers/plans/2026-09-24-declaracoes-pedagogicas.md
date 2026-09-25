# Declarações Pedagógicas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar um motor de declarações pedagógicas (modelo em texto com
parâmetros `[CHAVE]`, editado na tela, CRUD completo) e uma tela de emissão
em lote (por série/turma ou por aluno) que gera PDF via jsPDF no mesmo
padrão visual do certificado de conclusão e do histórico escolar.

**Architecture:** Uma tabela nova `declaracao_modelos` (RLS por escola,
seguindo o padrão de `certificado_config`). Um resolvedor puro
`resolverDeclaracao(modelo, dados)` que troca `[CHAVE]` por valor, isolado e
testável sem jsPDF. Um gerador de PDF novo (`declaracao-pdf.ts`) que reusa o
motor de parágrafo justificado do certificado — extraído para um módulo
compartilhado `pdf-paragrafo.ts` nesta mesma leva, porque hoje ele vive
inacessível dentro de `certificado-pdf.ts`. Duas telas novas em
`/declaracoes` (CRUD de modelos, emissão), reaproveitando o padrão de
filtros por URL já usado em `/historico/emissao`. RBAC reaproveita o módulo
`historico` já existente (mesma categoria de documento pedagógico, sem
custo de seed novo).

**Tech Stack:** Next.js 14 App Router, Server Actions, Supabase (Postgres),
Zod, jsPDF (client-side), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-24-declaracoes-pedagogicas-design.md`

## Global Constraints

- Cor só via token/classe Tailwind tokenizada — proibido hex/rgb cru.
- Nunca usar `confirm()` nativo — usar `useConfirm` (`src/components/ui/confirm-dialog.tsx`) para excluir modelo.
- `npm run typecheck && npm run build` verdes antes de fechar a fase.
- Migration é aditiva (tabela nova, sem alterar tabela existente).
- RLS por `escola_id`, no mesmo formato de `certificado_config` (policy `for all to authenticated using (escola_id = (select escola_id from current_perfil())) with check (...)`, mais `for all to service_role using (true) with check (true)`).
- Assinam a declaração: Secretário e Diretor, vindos de `companies` via `getCredenciamentoVigente` (mesma fonte do histórico/certificado) — nunca hardcoded.
- Parâmetro fora da lista suportada é bloqueado ao salvar o modelo, nunca silenciosamente ignorado.
- Emissão em lote inclui matrículas `ativa`, `cancelada` e `transferida` do ano (não só `ativa`) — necessário para declarações de transferência de quem já saiu.
- RBAC: reaproveitar o módulo `historico` já existente em `src/lib/auth/permissions.ts` (mesma categoria de documento pedagógico da escola) — não criar módulo novo (evita as 3 edições exigidas: `MODULOS` + seed SQL + `ROTA_PARA_MODULO`).

## Review Focus

- **Parâmetro com dado ausente no aluno** (`FILIACAO`/`CIDADE`/`UF`/`PROXIMA_SERIE` nulos): a resolução não pode imprimir `"null"`/`"undefined"` nem quebrar — deve virar string vazia ou omitir a frase, mesmo padrão de `certificado-pdf.test.ts` "não quebra sem RG/filiação/naturalidade".
- **Parâmetro desconhecido salvo no modelo**: `[NOME_ALNO]` (erro de digitação) precisa ser rejeitado no salvamento do modelo com mensagem clara, nunca aparecer literal no PDF final.
- **Aluno na última série sem próxima**: `[PROXIMA_SERIE]` sem próxima série na ordem (ex.: 3ª Série do Médio) deve resolver para string vazia, não lançar exceção que derruba a emissão do lote inteiro.
- **Emissão em lote com aluno sem `FormData` completo** (ex.: sem filiação cadastrada): um aluno com dado faltante não pode interromper a geração das páginas dos demais alunos do lote.
- **Exclusão de modelo em uso**: nada no plano impede excluir um modelo que já foi usado para emitir declarações no passado (não há histórico de "declarações emitidas" a preservar, ao contrário de `documentos_aluno`) — confirmar que a spec não pede isso (não pede) e que o teste do CRUD cobre exclusão simples sem essa preocupação.

---

## Task 1: Extrair motor de parágrafo justificado para módulo compartilhado

**Files:**
- Create: `src/lib/documents/pdf-paragrafo.ts`
- Modify: `src/lib/documents/certificado-pdf.ts`
- Test: `src/lib/documents/pdf-paragrafo.test.ts`

**Interfaces:**
- Consumes: nada de outra task — puro refactor de código já existente em `certificado-pdf.ts` (funções `medirPalavras`, `quebrarLinhas`, `medirAlturaCorpo`, `renderCorpo`, todas hoje não-exportadas).
- Produces:
  - `type Palavra = { texto: string; negrito: boolean; largura: number }`
  - `medirPalavras(doc: jsPDF, segmentos: Segmento[], tamanhoPt: number): Palavra[]`
  - `quebrarLinhas(palavras: Palavra[], larguraUtilPt: number, larguraEspacoPt: number): Palavra[][]`
  - `medirAlturaCorpo(doc: jsPDF, segmentos: Segmento[], opts: { fonte: string; fonteCorpoPt: number; margemPt: number }): number`
  - `renderCorpo(doc: jsPDF, yInicial: number, segmentos: Segmento[], opts: { fonte: string; fonteCorpoPt: number; margemPt: number }): number` (retorna o `y` final, igual ao comportamento atual)

  Task 3 (gerador de declaração) e a Task 4 (assinaturas) consomem estas funções.

- [ ] **Step 1: Escrever o teste do módulo extraído**

```typescript
// src/lib/documents/pdf-paragrafo.test.ts
import { describe, it, expect } from "vitest";
import jsPDF from "jspdf";
import { medirPalavras, quebrarLinhas, medirAlturaCorpo, renderCorpo } from "./pdf-paragrafo";
import type { Segmento } from "./certificado-texto";

function docTeste(): jsPDF {
  return new jsPDF({ unit: "pt", format: "a4" });
}

describe("medirPalavras", () => {
  it("mede cada palavra com a fonte do segmento (negrito e normal)", () => {
    const doc = docTeste();
    const segmentos: Segmento[] = [
      { texto: "Declaramos que ", negrito: false },
      { texto: "João Silva", negrito: true }
    ];
    const palavras = medirPalavras(doc, segmentos, 11);
    expect(palavras.map((p) => p.texto)).toEqual(["Declaramos", "que", "João", "Silva"]);
    expect(palavras.every((p) => p.largura > 0)).toBe(true);
    expect(palavras[0].negrito).toBe(false);
    expect(palavras[2].negrito).toBe(true);
  });
});

describe("quebrarLinhas", () => {
  it("quebra em nova linha quando a palavra não cabe na largura útil", () => {
    const palavras = [
      { texto: "AAAA", negrito: false, largura: 40 },
      { texto: "BBBB", negrito: false, largura: 40 },
      { texto: "CCCC", negrito: false, largura: 40 }
    ];
    const linhas = quebrarLinhas(palavras, 90, 10);
    expect(linhas.length).toBe(2);
    expect(linhas[0].map((p) => p.texto)).toEqual(["AAAA", "BBBB"]);
    expect(linhas[1].map((p) => p.texto)).toEqual(["CCCC"]);
  });

  it("uma palavra maior que a largura útil ainda forma sua própria linha", () => {
    const palavras = [{ texto: "PALAVRA-ENORME", negrito: false, largura: 500 }];
    const linhas = quebrarLinhas(palavras, 90, 10);
    expect(linhas.length).toBe(1);
    expect(linhas[0].map((p) => p.texto)).toEqual(["PALAVRA-ENORME"]);
  });
});

describe("medirAlturaCorpo / renderCorpo", () => {
  it("medirAlturaCorpo prevê a mesma quantidade de linhas que renderCorpo desenha", () => {
    const doc = docTeste();
    const segmentos: Segmento[] = [
      { texto: "Texto de teste com várias palavras para forçar quebra de linha no parágrafo justificado.", negrito: false }
    ];
    const opts = { fonte: "times", fonteCorpoPt: 11, margemPt: 40 };
    const alturaPrevista = medirAlturaCorpo(doc, segmentos, opts);
    const yFinal = renderCorpo(doc, 100, segmentos, opts);
    expect(yFinal - 100).toBe(alturaPrevista);
  });

  it("parágrafo vazio não desenha linha nenhuma (altura zero)", () => {
    const doc = docTeste();
    const opts = { fonte: "times", fonteCorpoPt: 11, margemPt: 40 };
    expect(medirAlturaCorpo(doc, [], opts)).toBe(0);
    expect(renderCorpo(doc, 100, [], opts)).toBe(100);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm test -- src/lib/documents/pdf-paragrafo.test.ts`
Expected: FAIL — `./pdf-paragrafo` não existe.

- [ ] **Step 3: Criar o módulo extraído**

Copie as funções de `src/lib/documents/certificado-pdf.ts` (linhas 197-234, 236-251, 253-297 na versão atual) para o arquivo novo, generalizando a assinatura de `opts` (hoje elas recebem `CertificadoOptions` inteiro, mas só usam `opts.leiaute.fonteCorpoPt` e a margem — o novo módulo recebe só o subconjunto necessário, para não acoplar ao tipo do certificado):

```typescript
// src/lib/documents/pdf-paragrafo.ts
import type jsPDF from "jspdf";
import type { Segmento } from "./certificado-texto";

/**
 * Motor de parágrafo justificado, extraído de certificado-pdf.ts para ser
 * reaproveitado pela declaração pedagógica sem duplicar a lógica de quebra
 * de linha e justificação (jsPDF não tem rich text nativo — o texto é uma
 * lista de segmentos com negrito, desenhados palavra a palavra).
 */

export type Palavra = { texto: string; negrito: boolean; largura: number };

export type OpcoesParagrafo = {
  /** Nome da fonte jsPDF (ex.: "times", "helvetica"). */
  fonte: string;
  fonteCorpoPt: number;
  /** Margem lateral em pontos (já convertida de mm, se aplicável). */
  margemPt: number;
};

/** Mede cada palavra com a fonte do seu segmento — jsPDF não tem rich text. */
export function medirPalavras(doc: jsPDF, segmentos: Segmento[], tamanhoPt: number): Palavra[] {
  doc.setFontSize(tamanhoPt);
  const palavras: Palavra[] = [];

  for (const seg of segmentos) {
    doc.setFont("times", seg.negrito ? "bold" : "normal");
    for (const bruta of seg.texto.split(" ")) {
      if (bruta === "") continue;
      palavras.push({ texto: bruta, negrito: seg.negrito, largura: doc.getTextWidth(bruta) });
    }
  }

  return palavras;
}

export function quebrarLinhas(palavras: Palavra[], larguraUtilPt: number, larguraEspacoPt: number): Palavra[][] {
  const linhas: Palavra[][] = [];
  let atual: Palavra[] = [];
  let largura = 0;

  for (const palavra of palavras) {
    const espaco = atual.length === 0 ? 0 : larguraEspacoPt;
    if (atual.length > 0 && largura + espaco + palavra.largura > larguraUtilPt) {
      linhas.push(atual);
      atual = [palavra];
      largura = palavra.largura;
    } else {
      atual.push(palavra);
      largura += espaco + palavra.largura;
    }
  }

  if (atual.length > 0) linhas.push(atual);
  return linhas;
}

/** Altura que `renderCorpo` vai ocupar, sem desenhar nada — para poder
 * centralizar o bloco verticalmente antes de saber onde ele começa. */
export function medirAlturaCorpo(doc: jsPDF, segmentos: Segmento[], opts: OpcoesParagrafo): number {
  if (segmentos.length === 0) return 0;
  const util = doc.internal.pageSize.getWidth() - opts.margemPt * 2;
  const alturaLinha = opts.fonteCorpoPt * 1.9;

  const palavras = medirPalavras(doc, segmentos, opts.fonteCorpoPt);
  doc.setFont(opts.fonte, "normal");
  const larguraEspaco = doc.getTextWidth(" ") * 1.6;
  const linhas = quebrarLinhas(palavras, util, larguraEspaco);

  return linhas.length * alturaLinha;
}

/**
 * Parágrafo justificado, palavra a palavra. A sobra de cada linha é
 * distribuída nos vãos; a última fica alinhada à esquerda.
 */
export function renderCorpo(doc: jsPDF, yInicial: number, segmentos: Segmento[], opts: OpcoesParagrafo): number {
  if (segmentos.length === 0) return yInicial;

  const util = doc.internal.pageSize.getWidth() - opts.margemPt * 2;
  const alturaLinha = opts.fonteCorpoPt * 1.9;

  doc.setTextColor(0, 0, 0);
  const palavras = medirPalavras(doc, segmentos, opts.fonteCorpoPt);

  // A fonte core "times" do jsPDF mede o glifo de espaço mais estreito do
  // que aparenta visualmente — sem esse reforço o texto sai quase colado.
  doc.setFont(opts.fonte, "normal");
  const larguraEspaco = doc.getTextWidth(" ") * 1.6;
  const linhas = quebrarLinhas(palavras, util, larguraEspaco);

  let y = yInicial;
  linhas.forEach((linha, i) => {
    const somaPalavras = linha.reduce((soma, p) => soma + p.largura, 0);
    const vaos = linha.length - 1;
    const ultima = i === linhas.length - 1;
    const espaco = ultima || vaos === 0 ? larguraEspaco : (util - somaPalavras) / vaos;

    let x = opts.margemPt;
    for (const palavra of linha) {
      doc.setFont(opts.fonte, palavra.negrito ? "bold" : "normal");
      doc.text(palavra.texto, x, y);
      x += palavra.largura + espaco;
    }
    y += alturaLinha;
  });

  return y;
}
```

Nota: a função original `medirPalavras` fixa a fonte em `"times"` (linha
`doc.setFont(FONTE, ...)`, onde `FONTE` era uma constante do módulo). No
módulo extraído, use `"times"` como valor fixo dentro de `medirPalavras`
mesmo assim (é sempre a fonte de documento oficial nos dois usos, certificado
e declaração) — mas `medirAlturaCorpo`/`renderCorpo` recebem `opts.fonte`
para o `setFont` de parágrafo, mantendo a mesma fonte usada em ambos os
lugares hoje (times). Não introduza uma opção de fonte por palavra — é
escopo além do que existe hoje.

- [ ] **Step 4: Atualizar `certificado-pdf.ts` para importar do módulo novo**

Remova de `certificado-pdf.ts` as definições locais de `Palavra`,
`medirPalavras`, `quebrarLinhas`, `medirAlturaCorpo`, `renderCorpo` (linhas
197-297 na versão atual) e substitua pelo import:

```typescript
import { medirAlturaCorpo, renderCorpo } from "./pdf-paragrafo";
```

Ajuste as duas chamadas existentes (`medirAlturaCorpo(doc, segmentos, opts)`
em `renderPaginaCertificado` e `renderCorpo(doc, y + GAP_TITULO_CORPO,
segmentos, opts)`) para passar o novo formato de opções:

```typescript
const opcoesParagrafo = { fonte: FONTE, fonteCorpoPt: opts.leiaute.fonteCorpoPt, margemPt: margem };
const alturaBlocoTexto =
  ALTURA_TITULO + GAP_TITULO_CORPO + medirAlturaCorpo(doc, segmentos, opcoesParagrafo) + ALTURA_DATA;
// ...
y = renderCorpo(doc, y + GAP_TITULO_CORPO, segmentos, opcoesParagrafo);
```

- [ ] **Step 5: Rodar o teste novo e a suíte de certificado**

Run: `npm test -- src/lib/documents/pdf-paragrafo.test.ts src/lib/documents/certificado-pdf.test.ts`
Expected: PASS — o teste novo passa, e nenhum teste existente de certificado
quebra (o certificado deve produzir pixel a pixel o mesmo PDF de antes,
porque a lógica não mudou, só foi movida).

- [ ] **Step 6: Commit**

```bash
git add src/lib/documents/pdf-paragrafo.ts src/lib/documents/pdf-paragrafo.test.ts src/lib/documents/certificado-pdf.ts
git commit -m "refactor(documents): extrai motor de paragrafo justificado para modulo compartilhado

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Migration — tabela `declaracao_modelos` com seed de 4 modelos

**Files:**
- Create: `supabase/migrations/202609240009_declaracao_modelos.sql`

**Interfaces:**
- Produces: tabela `declaracao_modelos` com colunas `id, escola_id, codigo
  (serial), nome, titulo, texto, fecho, ativo, created_at, updated_at`.
  Task 4 (validação/tipos) e Task 5 (actions) dependem deste schema exato.

- [ ] **Step 1: Escrever a migration**

```sql
-- Modelos de declaracao pedagogica: texto editavel com parametros [CHAVE],
-- resolvidos por resolverDeclaracao() (src/lib/documents/declaracao-resolver.ts).
-- Motor novo, paralelo ao de .docx (templates_documentos) que continua
-- existindo para contratos/termos.

create table if not exists public.declaracao_modelos (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  codigo serial,
  nome text not null,
  titulo text not null,
  texto text not null,
  fecho text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists declaracao_modelos_escola_idx on declaracao_modelos (escola_id);

alter table declaracao_modelos enable row level security;

create policy declaracao_modelos_service on declaracao_modelos
  for all to service_role using (true) with check (true);

create policy declaracao_modelos_escola on declaracao_modelos
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

grant select, insert, update, delete on declaracao_modelos to authenticated;

-- Seed: 4 modelos-base, escola padrao do sistema (single-tenant hoje).
insert into declaracao_modelos (escola_id, nome, titulo, texto, fecho)
select
  e.id,
  v.nome, v.titulo, v.texto, v.fecho
from escolas e
cross join (values
  (
    'Declaração de Frequência',
    'DECLARAÇÃO',
    'Declaramos para os devidos fins e a pedido da parte interessada, que o(a) aluno(a) [NOME_ALUNO] de matrícula número [MATRICULA], filho(a) de [FILIACAO], nascido(a) em [DATA_NASCIMENTO], natural de [CIDADE] - [UF], possui frequência regular nesta instituição de ensino, neste ano letivo de [ANO_LETIVO], cursando o(a) [SERIE_CORRENTE], no turno [TURNO].',
    'Secretaria da(o) [EMPRESA], em [DATA_POR_EXTENSO_SEM_CIDADE]'
  ),
  (
    'Declaração de Matrícula',
    'DECLARAÇÃO',
    'Declaramos para os devidos fins e a pedido da parte interessada, que o(a) aluno(a) [NOME_ALUNO] de matrícula número [MATRICULA], filho(a) de [FILIACAO], nascido(a) em [DATA_NASCIMENTO], natural de [CIDADE] - [UF], encontra-se regularmente matriculado(a) nesta instituição de ensino, neste ano letivo de [ANO_LETIVO], cursando o(a) [SERIE_CORRENTE], no turno [TURNO].',
    'Secretaria da(o) [EMPRESA], em [DATA_POR_EXTENSO_SEM_CIDADE]'
  ),
  (
    'Declaração de Transferência — Concluído',
    'DECLARAÇÃO DE TRANSFERÊNCIA',
    'Declaramos para os devidos fins e a pedido da parte interessada, que o(a) aluno(a) [NOME_ALUNO] de matrícula número [MATRICULA], filho(a) de [FILIACAO], nascido(a) em [DATA_NASCIMENTO], natural de [CIDADE] - [UF], aluno(a) desta instituição de ensino, concluiu o(a) [SERIE_CORRENTE] e requereu sua transferência na presente data, tendo o direito de matricular-se no(a) [PROXIMA_SERIE].

Este documento é válido por 30(trinta) dias, findo os quais será substituído pelo Histórico Escolar.',
    '[DATA_POR_EXTENSO_COM_CIDADE]'
  ),
  (
    'Declaração de Transferência — Não Concluído',
    'DECLARAÇÃO DE TRANSFERÊNCIA',
    'Declaramos para os devidos fins e a pedido da parte interessada, que o(a) aluno(a) [NOME_ALUNO] de matrícula número [MATRICULA], filho(a) de [FILIACAO], nascido(a) em [DATA_NASCIMENTO], natural de [CIDADE] - [UF], aluno(a) desta instituição de ensino, requereu sua transferência na presente data, tendo o direito de cursar o(a) [SERIE_CORRENTE].

Este documento é válido por 30(trinta) dias, findo os quais será substituído pelo Histórico Escolar.',
    '[DATA_POR_EXTENSO_COM_CIDADE]'
  )
) as v(nome, titulo, texto, fecho)
where not exists (
  select 1 from declaracao_modelos dm where dm.escola_id = e.id and dm.nome = v.nome
);
```

- [ ] **Step 2: Rodar a migration local**

Run: `cd supabase && supabase db push` (ou `db reset --local`, conforme o
que já funcionar no ambiente — ver `project_migration_order_bug.md`).
Expected: sem erro; `select nome from declaracao_modelos` devolve os 4
nomes.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/202609240009_declaracao_modelos.sql
git commit -m "feat(declaracoes): cria tabela declaracao_modelos com RLS e seed de 4 modelos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: `resolverDeclaracao` — função pura de resolução de parâmetros

**Files:**
- Create: `src/lib/documents/declaracao-resolver.ts`
- Test: `src/lib/documents/declaracao-resolver.test.ts`

**Interfaces:**
- Consumes: `montarFiliacao` de `@/lib/historico/filiacao` (já existe),
  `formatarDataExtenso`/`formatarDataCurta` de `./certificado-texto` (já
  existem).
- Produces:
  ```typescript
  export type DeclaracaoModelo = { titulo: string; texto: string; fecho: string };
  export type DadosDeclaracao = {
    nomeAluno: string;
    matricula: string | null;
    dataNascimento: string | null; // ISO YYYY-MM-DD
    naturalidade: string | null; // "Cidade - UF", mesmo formato de alunos.naturalidade
    filiacao: string | null; // já pronta, ex. "PAI e MÃE" — ver Task 6 para como é montada
    anoLetivo: number;
    serieCorrente: string;
    turma: string;
    turno: string;
    proximaSerie: string | null;
    nomeEmpresa: string;
    cidadeEmpresa: string | null;
    dataEmissaoIso: string; // ISO YYYY-MM-DD
  };
  export type DeclaracaoResolvida = { titulo: string; texto: string; fecho: string };
  export const PARAMETROS_SUPORTADOS: readonly string[]; // lista de tokens válidos, ex. ["NOME_ALUNO", "MATRICULA", ...]
  export function validarParametros(texto: string): { valido: true } | { valido: false; tokenInvalido: string };
  export function resolverDeclaracao(modelo: DeclaracaoModelo, dados: DadosDeclaracao): DeclaracaoResolvida;
  ```
  Task 5 (actions de emissão) e Task 6 (CRUD de modelos, para validar ao
  salvar) consomem `resolverDeclaracao` e `validarParametros`.

- [ ] **Step 1: Escrever os testes**

```typescript
// src/lib/documents/declaracao-resolver.test.ts
import { describe, it, expect } from "vitest";
import { resolverDeclaracao, validarParametros, PARAMETROS_SUPORTADOS, type DadosDeclaracao } from "./declaracao-resolver";

const dadosBase: DadosDeclaracao = {
  nomeAluno: "MARIA DA SILVA",
  matricula: "2026-001",
  dataNascimento: "2015-03-10",
  naturalidade: "Trindade - GO",
  filiacao: "JOÃO DA SILVA e ANA DA SILVA",
  anoLetivo: 2026,
  serieCorrente: "3º ANO",
  turma: "3º ANO A",
  turno: "Matutino",
  proximaSerie: "4º ANO",
  nomeEmpresa: "EPG Trindade",
  cidadeEmpresa: "Trindade",
  dataEmissaoIso: "2026-09-24"
};

describe("resolverDeclaracao", () => {
  it("resolve todos os parâmetros suportados com dado presente", () => {
    const modelo = {
      titulo: "DECLARAÇÃO",
      texto: "Aluno [NOME_ALUNO], matrícula [MATRICULA], nasc. [DATA_NASCIMENTO], natural de [CIDADE] - [UF], filho de [FILIACAO], cursando [SERIE_CORRENTE] turma [TURMA] turno [TURNO] no ano [ANO_LETIVO], próxima série [PROXIMA_SERIE].",
      fecho: "Emitido em [DATA_POR_EXTENSO_COM_CIDADE] / [DATA_POR_EXTENSO_SEM_CIDADE] / [EMPRESA]"
    };
    const resolvido = resolverDeclaracao(modelo, dadosBase);
    expect(resolvido.texto).toContain("MARIA DA SILVA");
    expect(resolvido.texto).toContain("2026-001");
    expect(resolvido.texto).toContain("10/03/2015");
    expect(resolvido.texto).toContain("Trindade");
    expect(resolvido.texto).toContain("GO");
    expect(resolvido.texto).toContain("JOÃO DA SILVA e ANA DA SILVA");
    expect(resolvido.texto).toContain("3º ANO");
    expect(resolvido.texto).toContain("3º ANO A");
    expect(resolvido.texto).toContain("Matutino");
    expect(resolvido.texto).toContain("2026");
    expect(resolvido.texto).toContain("4º ANO");
    expect(resolvido.fecho).toContain("EPG Trindade");
    expect(resolvido.fecho).toContain("24 de setembro de 2026");
    expect(resolvido.fecho).toContain("Trindade, 24 de setembro de 2026");
  });

  it("naturalidade ausente resolve CIDADE e UF para string vazia, sem quebrar", () => {
    const modelo = { titulo: "T", texto: "Natural de [CIDADE] - [UF].", fecho: "F" };
    const resolvido = resolverDeclaracao(modelo, { ...dadosBase, naturalidade: null });
    expect(resolvido.texto).toBe("Natural de  - .");
  });

  it("filiação ausente resolve FILIACAO para string vazia, sem quebrar", () => {
    const modelo = { titulo: "T", texto: "Filho de [FILIACAO].", fecho: "F" };
    const resolvido = resolverDeclaracao(modelo, { ...dadosBase, filiacao: null });
    expect(resolvido.texto).toBe("Filho de .");
  });

  it("sem próxima série (última da grade) resolve PROXIMA_SERIE para string vazia", () => {
    const modelo = { titulo: "T", texto: "Direito de matricular-se em [PROXIMA_SERIE].", fecho: "F" };
    const resolvido = resolverDeclaracao(modelo, { ...dadosBase, proximaSerie: null });
    expect(resolvido.texto).toBe("Direito de matricular-se em .");
  });

  it("resolve o título também (não só texto/fecho)", () => {
    const modelo = { titulo: "DECLARAÇÃO DE [NOME_ALUNO]", texto: "T", fecho: "F" };
    const resolvido = resolverDeclaracao(modelo, dadosBase);
    expect(resolvido.titulo).toBe("DECLARAÇÃO DE MARIA DA SILVA");
  });
});

describe("validarParametros", () => {
  it("aceita texto só com parâmetros da lista suportada", () => {
    const resultado = validarParametros("Aluno [NOME_ALUNO] da turma [TURMA].");
    expect(resultado).toEqual({ valido: true });
  });

  it("aceita texto sem nenhum parâmetro", () => {
    expect(validarParametros("Texto fixo sem parâmetros.")).toEqual({ valido: true });
  });

  it("rejeita parâmetro desconhecido, apontando o token exato", () => {
    const resultado = validarParametros("Aluno [NOME_ALNO] (erro de digitação).");
    expect(resultado).toEqual({ valido: false, tokenInvalido: "[NOME_ALNO]" });
  });

  it("todos os parâmetros de PARAMETROS_SUPORTADOS passam na validação", () => {
    const texto = PARAMETROS_SUPORTADOS.map((p) => `[${p}]`).join(" ");
    expect(validarParametros(texto)).toEqual({ valido: true });
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm test -- src/lib/documents/declaracao-resolver.test.ts`
Expected: FAIL — `./declaracao-resolver` não existe.

- [ ] **Step 3: Implementar o resolvedor**

```typescript
// src/lib/documents/declaracao-resolver.ts
import { montarFiliacao } from "@/lib/historico/filiacao";
import { formatarDataCurta, formatarDataExtenso } from "./certificado-texto";

export type DeclaracaoModelo = { titulo: string; texto: string; fecho: string };

export type DadosDeclaracao = {
  nomeAluno: string;
  matricula: string | null;
  dataNascimento: string | null;
  naturalidade: string | null;
  filiacao: string | null;
  anoLetivo: number;
  serieCorrente: string;
  turma: string;
  turno: string;
  proximaSerie: string | null;
  nomeEmpresa: string;
  cidadeEmpresa: string | null;
  dataEmissaoIso: string;
};

export type DeclaracaoResolvida = { titulo: string; texto: string; fecho: string };

/**
 * `alunos.naturalidade` é salva como "Cidade - UF" (texto livre, ver
 * `certidao-*`/histórico). Parse best-effort: sem " - " devolve tudo como
 * cidade e UF vazia, em vez de quebrar.
 */
function parseNaturalidade(naturalidade: string | null): { cidade: string; uf: string } {
  if (!naturalidade) return { cidade: "", uf: "" };
  const partes = naturalidade.split(" - ");
  if (partes.length >= 2) return { cidade: partes[0].trim(), uf: partes[1].trim() };
  return { cidade: naturalidade.trim(), uf: "" };
}

function valoresParaTokens(dados: DadosDeclaracao): Record<string, string> {
  const { cidade, uf } = parseNaturalidade(dados.naturalidade);
  const dataExtenso = formatarDataExtenso(dados.dataEmissaoIso);

  return {
    NOME_ALUNO: dados.nomeAluno,
    MATRICULA: dados.matricula ?? "",
    DATA_NASCIMENTO: formatarDataCurta(dados.dataNascimento),
    CIDADE: cidade,
    UF: uf,
    FILIACAO: dados.filiacao ?? "",
    ANO_LETIVO: String(dados.anoLetivo),
    SERIE_CORRENTE: dados.serieCorrente,
    TURMA: dados.turma,
    TURNO: dados.turno,
    PROXIMA_SERIE: dados.proximaSerie ?? "",
    EMPRESA: dados.nomeEmpresa,
    DATA_POR_EXTENSO_COM_CIDADE: dados.cidadeEmpresa ? `${dados.cidadeEmpresa}, ${dataExtenso}` : dataExtenso,
    DATA_POR_EXTENSO_SEM_CIDADE: dataExtenso
  };
}

export const PARAMETROS_SUPORTADOS: readonly string[] = [
  "NOME_ALUNO", "MATRICULA", "DATA_NASCIMENTO", "CIDADE", "UF", "FILIACAO",
  "ANO_LETIVO", "SERIE_CORRENTE", "TURMA", "TURNO", "PROXIMA_SERIE",
  "EMPRESA", "DATA_POR_EXTENSO_COM_CIDADE", "DATA_POR_EXTENSO_SEM_CIDADE"
];

const REGEX_TOKEN = /\[([A-Z_]+)\]/g;

export function validarParametros(texto: string): { valido: true } | { valido: false; tokenInvalido: string } {
  const suportados = new Set(PARAMETROS_SUPORTADOS);
  const re = new RegExp(REGEX_TOKEN);
  let achado: RegExpExecArray | null;
  while ((achado = re.exec(texto)) !== null) {
    if (!suportados.has(achado[1])) {
      return { valido: false, tokenInvalido: achado[0] };
    }
  }
  return { valido: true };
}

function substituirTokens(texto: string, valores: Record<string, string>): string {
  return texto.replace(REGEX_TOKEN, (match, chave: string) => valores[chave] ?? match);
}

export function resolverDeclaracao(modelo: DeclaracaoModelo, dados: DadosDeclaracao): DeclaracaoResolvida {
  const valores = valoresParaTokens(dados);
  return {
    titulo: substituirTokens(modelo.titulo, valores),
    texto: substituirTokens(modelo.texto, valores),
    fecho: substituirTokens(modelo.fecho, valores)
  };
}
```

Nota: `montarFiliacao` não é usada diretamente aqui — `dados.filiacao` já
chega pronta (a Task 5, que monta `DadosDeclaracao` a partir do banco, é
quem chama `montarFiliacao`). O import foi removido do arquivo final porque
não é usado nesta camada; mantenha o resolvedor sem I/O e sem dependência
de banco, só transformação de string.

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npm test -- src/lib/documents/declaracao-resolver.test.ts`
Expected: PASS — todos os 9 testes verdes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/documents/declaracao-resolver.ts src/lib/documents/declaracao-resolver.test.ts
git commit -m "feat(declaracoes): resolvedor puro de parametros [CHAVE] para declaracoes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Tipos, validação e data layer de `declaracao_modelos`

**Files:**
- Create: `src/lib/validation/declaracoes.ts`
- Create: `src/lib/data/declaracoes.ts`
- Test: `src/lib/validation/declaracoes.test.ts`

**Interfaces:**
- Consumes: `validarParametros` da Task 3, tabela `declaracao_modelos` da
  Task 2.
- Produces:
  ```typescript
  // src/lib/validation/declaracoes.ts
  export const DeclaracaoModeloSchema: ZodSchema; // { nome, titulo, texto, fecho } com refine chamando validarParametros em titulo+texto+fecho
  export const DeclaracaoModeloUpdateSchema: ZodSchema; // DeclaracaoModeloSchema.extend({ id: uuid, ativo: boolean })

  // src/lib/data/declaracoes.ts
  export type DeclaracaoModeloRow = { id: string; codigo: number; nome: string; titulo: string; texto: string; fecho: string; ativo: boolean; created_at: string | null; updated_at: string | null };
  export async function listarDeclaracaoModelos(opts?: { includeInactive?: boolean }): Promise<DeclaracaoModeloRow[]>;
  export async function getDeclaracaoModeloById(id: string): Promise<DeclaracaoModeloRow | null>;
  ```
  Task 6 (CRUD UI + actions) e Task 7 (emissão) consomem estes exports.

- [ ] **Step 1: Escrever o teste de validação**

```typescript
// src/lib/validation/declaracoes.test.ts
import { describe, it, expect } from "vitest";
import { DeclaracaoModeloSchema } from "./declaracoes";

describe("DeclaracaoModeloSchema", () => {
  it("aceita modelo com parâmetros suportados", () => {
    const parsed = DeclaracaoModeloSchema.safeParse({
      nome: "Declaração de Frequência",
      titulo: "DECLARAÇÃO",
      texto: "Aluno [NOME_ALUNO] frequenta [SERIE_CORRENTE].",
      fecho: "[DATA_POR_EXTENSO_SEM_CIDADE]"
    });
    expect(parsed.success).toBe(true);
  });

  it("rejeita modelo com parâmetro desconhecido no texto", () => {
    const parsed = DeclaracaoModeloSchema.safeParse({
      nome: "Modelo com erro",
      titulo: "DECLARAÇÃO",
      texto: "Aluno [NOME_ALNO] frequenta.",
      fecho: "F"
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toContain("[NOME_ALNO]");
    }
  });

  it("rejeita parâmetro desconhecido no título ou no fecho também", () => {
    const noTitulo = DeclaracaoModeloSchema.safeParse({
      nome: "N", titulo: "DECLARAÇÃO [ERRADO]", texto: "T", fecho: "F"
    });
    expect(noTitulo.success).toBe(false);

    const noFecho = DeclaracaoModeloSchema.safeParse({
      nome: "N", titulo: "T", texto: "T", fecho: "[ERRADO]"
    });
    expect(noFecho.success).toBe(false);
  });

  it("exige nome, titulo, texto e fecho não vazios", () => {
    const parsed = DeclaracaoModeloSchema.safeParse({ nome: "", titulo: "", texto: "", fecho: "" });
    expect(parsed.success).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm test -- src/lib/validation/declaracoes.test.ts`
Expected: FAIL — `./declaracoes` não existe.

- [ ] **Step 3: Implementar o schema de validação**

```typescript
// src/lib/validation/declaracoes.ts
import { z } from "zod";
import { validarParametros } from "@/lib/documents/declaracao-resolver";

function campoComParametrosValidos(nomeCampo: string) {
  return z.string().min(1, `${nomeCampo} é obrigatório`).superRefine((valor, ctx) => {
    const resultado = validarParametros(valor);
    if (!resultado.valido) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Parâmetro desconhecido em ${nomeCampo}: ${resultado.tokenInvalido}`
      });
    }
  });
}

export const DeclaracaoModeloSchema = z.object({
  nome: z.string().min(3, "Nome deve ter ao menos 3 caracteres"),
  titulo: campoComParametrosValidos("Título"),
  texto: campoComParametrosValidos("Texto"),
  fecho: campoComParametrosValidos("Fecho")
});

export const DeclaracaoModeloUpdateSchema = DeclaracaoModeloSchema.extend({
  id: z.string().uuid(),
  ativo: z.preprocess((v) => v === "on" || v === true, z.boolean())
});

export type DeclaracaoModeloInput = z.infer<typeof DeclaracaoModeloSchema>;
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npm test -- src/lib/validation/declaracoes.test.ts`
Expected: PASS.

- [ ] **Step 5: Implementar a data layer (sem teste unitário — é I/O direto ao Supabase, seguindo o padrão de `src/lib/data/rh.ts`, que também não tem teste próprio; a cobertura vem do teste de integração da Task 6)**

```typescript
// src/lib/data/declaracoes.ts
import { createServerClient } from "@/lib/supabase/server";

export type DeclaracaoModeloRow = {
  id: string;
  codigo: number;
  nome: string;
  titulo: string;
  texto: string;
  fecho: string;
  ativo: boolean;
  created_at: string | null;
  updated_at: string | null;
};

const SELECT_COLUNAS = "id, codigo, nome, titulo, texto, fecho, ativo, created_at, updated_at";

export async function listarDeclaracaoModelos(opts?: { includeInactive?: boolean }): Promise<DeclaracaoModeloRow[]> {
  const supabase = await createServerClient();
  let query = supabase.from("declaracao_modelos").select(SELECT_COLUNAS).order("nome");
  if (!opts?.includeInactive) query = query.eq("ativo", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as DeclaracaoModeloRow[];
}

export async function getDeclaracaoModeloById(id: string): Promise<DeclaracaoModeloRow | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("declaracao_modelos")
    .select(SELECT_COLUNAS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as DeclaracaoModeloRow | null) ?? null;
}
```

- [ ] **Step 6: Rodar typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/lib/validation/declaracoes.ts src/lib/validation/declaracoes.test.ts src/lib/data/declaracoes.ts
git commit -m "feat(declaracoes): validacao zod e data layer de declaracao_modelos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: CRUD de modelos — Server Actions + RBAC

**Files:**
- Create: `src/lib/actions/declaracoes.ts`
- Test: `src/lib/actions/declaracoes.test.ts`
- Modify: `src/lib/auth/permissions.ts`

**Interfaces:**
- Consumes: `DeclaracaoModeloSchema`/`DeclaracaoModeloUpdateSchema` (Task 4),
  módulo RBAC `historico` (já existe).
- Produces:
  ```typescript
  export async function createDeclaracaoModeloAction(formData: FormData): Promise<void>;
  export async function updateDeclaracaoModeloAction(formData: FormData): Promise<void>;
  export async function deleteDeclaracaoModeloAction(formData: FormData): Promise<void>;
  export async function toggleDeclaracaoModeloAction(formData: FormData): Promise<void>;
  ```
  Task 6 (telas de CRUD) consome estas 4 actions.

- [ ] **Step 1: Adicionar as rotas novas em `ROTA_PARA_MODULO`**

Em `src/lib/auth/permissions.ts`, logo após as entradas de `/historico/*`
(linhas 128-131 na versão atual), adicione:

```typescript
  "/declaracoes": "historico",
  "/declaracoes/modelos": "historico",
  "/declaracoes/emitir": "historico",
```

Comentário: reaproveita o módulo `historico` (mesma categoria de documento
pedagógico da escola), sem exigir módulo RBAC novo nem edição do seed SQL.

- [ ] **Step 2: Escrever o teste das actions**

```typescript
// src/lib/actions/declaracoes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
const mockDelete = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
const mockRequirePermission = vi.fn().mockResolvedValue({ profile: { escola_id: "escola-1" } });

vi.mock("@/lib/auth/session", () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args)
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn().mockResolvedValue({
    from: () => ({ insert: mockInsert, update: mockUpdate, delete: mockDelete })
  })
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); })
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  createDeclaracaoModeloAction,
  updateDeclaracaoModeloAction,
  deleteDeclaracaoModeloAction
} from "./declaracoes";

describe("createDeclaracaoModeloAction", () => {
  beforeEach(() => {
    mockInsert.mockClear();
    mockRequirePermission.mockClear();
  });

  it("checa a permissao historico/create antes de inserir", async () => {
    const fd = new FormData();
    fd.set("nome", "Declaração de Frequência");
    fd.set("titulo", "DECLARAÇÃO");
    fd.set("texto", "Aluno [NOME_ALUNO].");
    fd.set("fecho", "F");

    await expect(createDeclaracaoModeloAction(fd)).rejects.toThrow("REDIRECT:");
    expect(mockRequirePermission).toHaveBeenCalledWith("historico", "create");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ escola_id: "escola-1", nome: "Declaração de Frequência" })
    );
  });

  it("rejeita parametro desconhecido antes de tocar o banco", async () => {
    const fd = new FormData();
    fd.set("nome", "Modelo Ruim");
    fd.set("titulo", "T");
    fd.set("texto", "Aluno [NOME_ALNO].");
    fd.set("fecho", "F");

    await expect(createDeclaracaoModeloAction(fd)).rejects.toThrow("REDIRECT:");
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

describe("updateDeclaracaoModeloAction", () => {
  it("checa a permissao historico/update", async () => {
    const fd = new FormData();
    fd.set("id", "123e4567-e89b-12d3-a456-426614174000");
    fd.set("nome", "Declaração de Frequência");
    fd.set("titulo", "DECLARAÇÃO");
    fd.set("texto", "Aluno [NOME_ALUNO].");
    fd.set("fecho", "F");
    fd.set("ativo", "on");

    await expect(updateDeclaracaoModeloAction(fd)).rejects.toThrow("REDIRECT:");
    expect(mockRequirePermission).toHaveBeenCalledWith("historico", "update");
    expect(mockUpdate).toHaveBeenCalled();
  });
});

describe("deleteDeclaracaoModeloAction", () => {
  it("checa a permissao historico/delete", async () => {
    const fd = new FormData();
    fd.set("id", "123e4567-e89b-12d3-a456-426614174000");

    await expect(deleteDeclaracaoModeloAction(fd)).rejects.toThrow("REDIRECT:");
    expect(mockRequirePermission).toHaveBeenCalledWith("historico", "delete");
    expect(mockDelete).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Rodar o teste e ver falhar**

Run: `npm test -- src/lib/actions/declaracoes.test.ts`
Expected: FAIL — `./declaracoes` não existe.

- [ ] **Step 4: Implementar as actions**

```typescript
// src/lib/actions/declaracoes.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { DeclaracaoModeloSchema, DeclaracaoModeloUpdateSchema } from "@/lib/validation/declaracoes";

function firstError(error: { issues: { message: string }[] }) {
  return encodeURIComponent(error.issues[0]?.message ?? "Dados inválidos");
}

function readForm(formData: FormData) {
  return {
    nome: String(formData.get("nome") ?? "").trim(),
    titulo: String(formData.get("titulo") ?? "").trim(),
    texto: String(formData.get("texto") ?? "").trim(),
    fecho: String(formData.get("fecho") ?? "").trim()
  };
}

export async function createDeclaracaoModeloAction(formData: FormData) {
  const session = await requirePermission("historico", "create");

  const parsed = DeclaracaoModeloSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    redirect(`/declaracoes/modelos/novo?erro=${firstError(parsed.error)}`);
  }

  const supabase = await createServerClient();
  const { error } = await supabase.from("declaracao_modelos").insert({
    escola_id: session.profile.escola_id,
    nome: parsed.data.nome,
    titulo: parsed.data.titulo,
    texto: parsed.data.texto,
    fecho: parsed.data.fecho
  });

  if (error) redirect(`/declaracoes/modelos/novo?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/declaracoes/modelos");
  redirect("/declaracoes/modelos?ok=criado");
}

export async function updateDeclaracaoModeloAction(formData: FormData) {
  await requirePermission("historico", "update");

  const id = String(formData.get("id") ?? "");
  const parsed = DeclaracaoModeloUpdateSchema.safeParse({
    id,
    ...readForm(formData),
    ativo: formData.get("ativo")
  });
  if (!parsed.success) {
    redirect(`/declaracoes/modelos/${id}/editar?erro=${firstError(parsed.error)}`);
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("declaracao_modelos")
    .update({
      nome: parsed.data.nome,
      titulo: parsed.data.titulo,
      texto: parsed.data.texto,
      fecho: parsed.data.fecho,
      ativo: parsed.data.ativo
    })
    .eq("id", parsed.data.id);

  if (error) redirect(`/declaracoes/modelos/${parsed.data.id}/editar?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/declaracoes/modelos");
  redirect("/declaracoes/modelos?ok=editado");
}

export async function toggleDeclaracaoModeloAction(formData: FormData) {
  await requirePermission("historico", "update");
  const id = String(formData.get("id") ?? "");
  const ativo = formData.get("ativo") === "on";

  if (!id) redirect("/declaracoes/modelos?erro=ID inválido");

  const supabase = await createServerClient();
  const { error } = await supabase.from("declaracao_modelos").update({ ativo }).eq("id", id);
  if (error) redirect(`/declaracoes/modelos?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/declaracoes/modelos");
  redirect(`/declaracoes/modelos?ok=${ativo ? "ativado" : "desativado"}`);
}

export async function deleteDeclaracaoModeloAction(formData: FormData) {
  await requirePermission("historico", "delete");
  const id = String(formData.get("id") ?? "");

  if (!id) redirect("/declaracoes/modelos?erro=ID inválido");

  const supabase = await createServerClient();
  const { error } = await supabase.from("declaracao_modelos").delete().eq("id", id);
  if (error) redirect(`/declaracoes/modelos?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/declaracoes/modelos");
  redirect("/declaracoes/modelos?ok=excluído");
}
```

- [ ] **Step 5: Rodar o teste e ver passar**

Run: `npm test -- src/lib/actions/declaracoes.test.ts`
Expected: PASS — 5 testes verdes.

- [ ] **Step 6: Rodar typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/lib/actions/declaracoes.ts src/lib/actions/declaracoes.test.ts src/lib/auth/permissions.ts
git commit -m "feat(declaracoes): server actions de CRUD de modelos, reaproveitando modulo RBAC historico

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Telas de CRUD de modelos (`/declaracoes/modelos`)

**Files:**
- Create: `src/app/(app)/declaracoes/modelos/page.tsx`
- Create: `src/app/(app)/declaracoes/modelos/novo/page.tsx`
- Create: `src/app/(app)/declaracoes/modelos/[id]/editar/page.tsx`
- Create: `src/components/declaracoes/declaracao-modelo-form.tsx`
- Create: `src/components/declaracoes/declaracao-modelo-row-actions.tsx`
- Test: `src/components/declaracoes/declaracao-modelo-form.test.tsx`
- Modify: `src/components/layout/topbar.tsx`

**Interfaces:**
- Consumes: `listarDeclaracaoModelos`/`getDeclaracaoModeloById` (Task 4),
  `create/update/delete/toggleDeclaracaoModeloAction` (Task 5),
  `PARAMETROS_SUPORTADOS` (Task 3), `useConfirm`
  (`src/components/ui/confirm-dialog.tsx`).
- Produces: rotas `/declaracoes/modelos`, `/declaracoes/modelos/novo`,
  `/declaracoes/modelos/[id]/editar`. Task 7 (emissão) referencia estas
  rotas como destino de navegação, mas não importa nenhum símbolo delas.

- [ ] **Step 1: Escrever o teste do formulário (botão "Adicionar parâmetro" e validação inline)**

```tsx
// src/components/declaracoes/declaracao-modelo-form.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DeclaracaoModeloForm } from "./declaracao-modelo-form";

describe("DeclaracaoModeloForm", () => {
  it("insere o parâmetro escolhido no texto, na posição do cursor", () => {
    render(<DeclaracaoModeloForm action={vi.fn()} />);

    const textoInput = screen.getByLabelText(/^Texto$/i) as HTMLTextAreaElement;
    fireEvent.change(textoInput, { target: { value: "Aluno " } });
    textoInput.setSelectionRange(6, 6);

    fireEvent.click(screen.getByRole("button", { name: /adicionar parâmetro/i }));
    fireEvent.click(screen.getByRole("option", { name: /NOME_ALUNO/i }));

    expect(textoInput.value).toBe("Aluno [NOME_ALUNO]");
  });

  it("pré-preenche os campos quando editando um modelo existente", () => {
    render(
      <DeclaracaoModeloForm
        action={vi.fn()}
        modelo={{
          id: "1", codigo: 1, nome: "Declaração de Frequência", titulo: "DECLARAÇÃO",
          texto: "Aluno [NOME_ALUNO].", fecho: "F", ativo: true,
          created_at: null, updated_at: null
        }}
      />
    );

    expect(screen.getByDisplayValue("Declaração de Frequência")).toBeInTheDocument();
    expect(screen.getByDisplayValue("DECLARAÇÃO")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm test -- src/components/declaracoes/declaracao-modelo-form.test.tsx`
Expected: FAIL — `./declaracao-modelo-form` não existe.

- [ ] **Step 3: Implementar o formulário**

```tsx
// src/components/declaracoes/declaracao-modelo-form.tsx
"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PARAMETROS_SUPORTADOS } from "@/lib/documents/declaracao-resolver";
import type { DeclaracaoModeloRow } from "@/lib/data/declaracoes";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  modelo?: DeclaracaoModeloRow;
  submitLabel?: string;
};

/**
 * Botão "Adicionar parâmetro": insere `[CHAVE]` no textarea ativo por
 * último (texto ou fecho), na posição do cursor — não sempre no texto, para
 * o fecho também poder usar [DATA_POR_EXTENSO...] e [EMPRESA].
 */
function useInserirParametro(refs: { texto: React.RefObject<HTMLTextAreaElement>; fecho: React.RefObject<HTMLTextAreaElement> }) {
  const ultimoAtivo = useRef<"texto" | "fecho">("texto");

  function marcarAtivo(campo: "texto" | "fecho") {
    ultimoAtivo.current = campo;
  }

  function inserir(parametro: string) {
    const ref = refs[ultimoAtivo.current].current;
    if (!ref) return;
    const inicio = ref.selectionStart ?? ref.value.length;
    const fim = ref.selectionEnd ?? ref.value.length;
    const token = `[${parametro}]`;
    ref.value = ref.value.slice(0, inicio) + token + ref.value.slice(fim);
    ref.focus();
    ref.setSelectionRange(inicio + token.length, inicio + token.length);
  }

  return { marcarAtivo, inserir };
}

export function DeclaracaoModeloForm({ action, modelo, submitLabel = "Salvar" }: Props) {
  const [menuAberto, setMenuAberto] = useState(false);
  const textoRef = useRef<HTMLTextAreaElement>(null);
  const fechoRef = useRef<HTMLTextAreaElement>(null);
  const { marcarAtivo, inserir } = useInserirParametro({ texto: textoRef, fecho: fechoRef });

  return (
    <form action={action} className="grid gap-4">
      {modelo ? <input type="hidden" name="id" value={modelo.id} /> : null}

      <label>
        Nome da declaração
        <input name="nome" defaultValue={modelo?.nome ?? ""} required minLength={3} />
      </label>

      <label>
        Título
        <input name="titulo" defaultValue={modelo?.titulo ?? ""} required />
      </label>

      <div className="flex items-center justify-between">
        <label htmlFor="texto-declaracao">Texto</label>
        <div className="relative">
          <Button type="button" variant="secondary" onClick={() => setMenuAberto((v) => !v)}>
            + Adicionar parâmetro
          </Button>
          {menuAberto ? (
            <ul role="listbox" className="absolute right-0 z-10 mt-1 max-h-64 overflow-auto rounded-ui border border-line bg-paper shadow-pill">
              {PARAMETROS_SUPORTADOS.map((p) => (
                <li key={p}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      inserir(p);
                      setMenuAberto(false);
                    }}
                  >
                    [{p}]
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      <textarea
        id="texto-declaracao"
        name="texto"
        ref={textoRef}
        onFocus={() => marcarAtivo("texto")}
        defaultValue={modelo?.texto ?? ""}
        required
        rows={6}
      />

      <label htmlFor="fecho-declaracao">Fecho</label>
      <textarea
        id="fecho-declaracao"
        name="fecho"
        ref={fechoRef}
        onFocus={() => marcarAtivo("fecho")}
        defaultValue={modelo?.fecho ?? ""}
        required
        rows={2}
      />

      {modelo ? (
        <label className="flex items-center gap-2">
          <input name="ativo" type="checkbox" defaultChecked={modelo.ativo} className="h-4 w-4" />
          Ativo
        </label>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" variant="primary">{submitLabel}</Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npm test -- src/components/declaracoes/declaracao-modelo-form.test.tsx`
Expected: PASS.

- [ ] **Step 5: Implementar a lista com ações (editar/excluir via `useConfirm`)**

```tsx
// src/components/declaracoes/declaracao-modelo-row-actions.tsx
"use client";

import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { deleteDeclaracaoModeloAction } from "@/lib/actions/declaracoes";

type Props = { id: string; nome: string };

export function DeclaracaoModeloRowActions({ id, nome }: Props) {
  const confirm = useConfirm();

  async function excluir() {
    const ok = await confirm({
      title: "Excluir modelo de declaração",
      message: `Tem certeza que deseja excluir "${nome}"? Esta ação não pode ser desfeita.`,
      variant: "danger",
      confirmLabel: "Excluir"
    });
    if (!ok) return;
    const fd = new FormData();
    fd.set("id", id);
    await deleteDeclaracaoModeloAction(fd);
  }

  return (
    <div className="flex items-center gap-2">
      <Link href={`/declaracoes/modelos/${id}/editar`} aria-label="Editar" className="rounded-ui p-1.5 text-brand hover:bg-brand/10">
        <Pencil size={16} />
      </Link>
      <button type="button" onClick={excluir} aria-label="Excluir" className="rounded-ui p-1.5 text-danger hover:bg-danger/10">
        <Trash2 size={16} />
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Implementar as 3 pages**

```tsx
// src/app/(app)/declaracoes/modelos/page.tsx
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeclaracaoModeloRowActions } from "@/components/declaracoes/declaracao-modelo-row-actions";
import { listarDeclaracaoModelos } from "@/lib/data/declaracoes";
import { requirePermission } from "@/lib/auth/session";

export default async function ModelosDeclaracaoPage() {
  await requirePermission("historico", "read");
  const modelos = await listarDeclaracaoModelos({ includeInactive: true });

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Acadêmico" }, { label: "Declarações", href: "/declaracoes" }, { label: "Modelos" }]}
        title="Modelos de declaração"
        counter={String(modelos.length)}
      />
      <div className="flex justify-end">
        <Link href="/declaracoes/modelos/novo">
          <Button variant="primary">+ Cadastrar</Button>
        </Link>
      </div>
      <Panel className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink/60">
              <th className="p-3">Código</th>
              <th className="p-3">Nome da declaração</th>
              <th className="p-3">Status</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {modelos.map((m) => (
              <tr key={m.id} className="border-b border-line last:border-0">
                <td className="p-3">{m.codigo}</td>
                <td className="p-3">{m.nome}</td>
                <td className="p-3">{m.ativo ? "Ativo" : "Inativo"}</td>
                <td className="p-3"><DeclaracaoModeloRowActions id={m.id} nome={m.nome} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
```

```tsx
// src/app/(app)/declaracoes/modelos/novo/page.tsx
import { AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { DeclaracaoModeloForm } from "@/components/declaracoes/declaracao-modelo-form";
import { createDeclaracaoModeloAction } from "@/lib/actions/declaracoes";
import { requirePermission } from "@/lib/auth/session";

export default async function NovoModeloDeclaracaoPage({
  searchParams
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  await requirePermission("historico", "create");
  const sp = await searchParams;

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Acadêmico" }, { label: "Declarações", href: "/declaracoes" }, { label: "Modelos", href: "/declaracoes/modelos" }, { label: "Novo" }]}
        title="Novo modelo de declaração"
      />
      {sp.erro ? (
        <div className="flex items-center gap-2 rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">
          <AlertCircle size={16} />
          {sp.erro}
        </div>
      ) : null}
      <Panel className="p-6">
        <DeclaracaoModeloForm action={createDeclaracaoModeloAction} submitLabel="Cadastrar" />
      </Panel>
    </div>
  );
}
```

```tsx
// src/app/(app)/declaracoes/modelos/[id]/editar/page.tsx
import { notFound } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { DeclaracaoModeloForm } from "@/components/declaracoes/declaracao-modelo-form";
import { updateDeclaracaoModeloAction } from "@/lib/actions/declaracoes";
import { getDeclaracaoModeloById } from "@/lib/data/declaracoes";
import { requirePermission } from "@/lib/auth/session";

export default async function EditarModeloDeclaracaoPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  await requirePermission("historico", "update");
  const { id } = await params;
  const sp = await searchParams;

  const modelo = await getDeclaracaoModeloById(id);
  if (!modelo) notFound();

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Acadêmico" }, { label: "Declarações", href: "/declaracoes" }, { label: "Modelos", href: "/declaracoes/modelos" }, { label: modelo.nome }]}
        title="Editar modelo de declaração"
      />
      {sp.erro ? (
        <div className="flex items-center gap-2 rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">
          <AlertCircle size={16} />
          {sp.erro}
        </div>
      ) : null}
      <Panel className="p-6">
        <DeclaracaoModeloForm action={updateDeclaracaoModeloAction} modelo={modelo} submitLabel="Salvar alterações" />
      </Panel>
    </div>
  );
}
```

- [ ] **Step 7: Adicionar entrada no menu**

Em `src/components/layout/topbar.tsx`, no array `SECRETARIA_ITEMS`, dentro
do item "Acadêmico" (`href: "/series"`), adicione um filho novo:

```typescript
{ href: "/declaracoes/modelos", label: "Declarações", iconName: "FileText" },
```

- [ ] **Step 8: Rodar typecheck e build**

Run: `npm run typecheck && npm run build`
Expected: sem erros, rotas `/declaracoes/modelos`,
`/declaracoes/modelos/novo`, `/declaracoes/modelos/[id]/editar` compiladas.

- [ ] **Step 9: Commit**

```bash
git add src/app/\(app\)/declaracoes/modelos src/components/declaracoes/declaracao-modelo-form.tsx src/components/declaracoes/declaracao-modelo-form.test.tsx src/components/declaracoes/declaracao-modelo-row-actions.tsx src/components/layout/topbar.tsx
git commit -m "feat(declaracoes): telas de CRUD de modelos de declaracao

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Data layer de emissão — busca de alunos elegíveis e dados por aluno

**Files:**
- Create: `src/lib/data/declaracao-emissao.ts`
- Test: `src/lib/data/declaracao-emissao.test.ts`

**Interfaces:**
- Consumes: `montarFiliacao` (`@/lib/historico/filiacao`),
  `DadosDeclaracao` (Task 3).
- Produces:
  ```typescript
  export type AlunoParaDeclaracao = { matriculaId: string; alunoId: string; nome: string };
  export async function listarAlunosParaDeclaracao(filtro: {
    anoLetivo: number;
    serieId?: string;
    turmaId?: string;
    alunoId?: string;
  }): Promise<AlunoParaDeclaracao[]>;
  export async function buscarDadosDeclaracao(matriculaId: string): Promise<DadosDeclaracao>;
  ```
  Task 8 (Server Action de emissão) e Task 9 (tela de emitir) consomem
  estas duas funções.

- [ ] **Step 1: Escrever o teste com Supabase mockado**

```typescript
// src/lib/data/declaracao-emissao.test.ts
import { describe, it, expect, vi } from "vitest";

const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn().mockResolvedValue({ from: mockFrom })
}));

import { listarAlunosParaDeclaracao } from "./declaracao-emissao";

describe("listarAlunosParaDeclaracao", () => {
  it("inclui matrículas ativa, cancelada e transferida do ano filtrado", async () => {
    const inFn = vi.fn().mockResolvedValue({
      data: [
        { id: "m1", aluno_id: "a1", alunos: { nome: "Ana" } },
        { id: "m2", aluno_id: "a2", alunos: { nome: "Bruno" } }
      ],
      error: null
    });
    const eqChain = { eq: vi.fn().mockReturnThis(), in: inFn };
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue(eqChain) });

    const resultado = await listarAlunosParaDeclaracao({ anoLetivo: 2026, serieId: "serie-1" });

    expect(inFn).toHaveBeenCalledWith("status", ["ativa", "cancelada", "transferida"]);
    expect(resultado).toEqual([
      { matriculaId: "m1", alunoId: "a1", nome: "Ana" },
      { matriculaId: "m2", alunoId: "a2", nome: "Bruno" }
    ]);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm test -- src/lib/data/declaracao-emissao.test.ts`
Expected: FAIL — `./declaracao-emissao` não existe.

- [ ] **Step 3: Implementar a busca de alunos elegíveis**

```typescript
// src/lib/data/declaracao-emissao.ts
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { montarFiliacao } from "@/lib/historico/filiacao";
import { getCredenciamentoVigente } from "@/lib/data/historico";
import type { DadosDeclaracao } from "@/lib/documents/declaracao-resolver";
import { createServerClient } from "@/lib/supabase/server";

export type AlunoParaDeclaracao = { matriculaId: string; alunoId: string; nome: string };

export type FiltroEmissao = {
  anoLetivo: number;
  serieId?: string;
  turmaId?: string;
  alunoId?: string;
};

/**
 * Entram ativa, cancelada e transferida do ano — diferente da elegibilidade
 * do histórico (só ativa/concluida), porque a declaração de transferência é
 * emitida exatamente para quem já saiu da escola.
 */
export async function listarAlunosParaDeclaracao(filtro: FiltroEmissao): Promise<AlunoParaDeclaracao[]> {
  const supabase = await createServerClient();

  let query = supabase
    .from("matriculas")
    .select("id, aluno_id, alunos(nome)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("ano_letivo", filtro.anoLetivo)
    .in("status", ["ativa", "cancelada", "transferida"]);

  if (filtro.serieId) query = query.eq("serie_id", filtro.serieId);
  if (filtro.turmaId) query = query.eq("turma_id", filtro.turmaId);
  if (filtro.alunoId) query = query.eq("aluno_id", filtro.alunoId);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? [])
    .map((row) => {
      const aluno = row.alunos as { nome?: string } | null;
      if (!aluno?.nome) return null;
      return { matriculaId: row.id as string, alunoId: row.aluno_id as string, nome: aluno.nome };
    })
    .filter((a): a is AlunoParaDeclaracao => a !== null)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/**
 * Monta os dados de uma matrícula para resolverDeclaracao(). Uma matrícula
 * com dado faltante (ex.: sem filiação) resolve os campos para null/vazio —
 * nunca lança, para não interromper a emissão do lote inteiro (ver Task 8).
 */
export async function buscarDadosDeclaracao(matriculaId: string): Promise<DadosDeclaracao> {
  const supabase = await createServerClient();

  const { data: matricula, error } = await supabase
    .from("matriculas")
    .select(
      "codigo, ano_letivo, serie_id, series(nome, ordem), turmas(nome, turno), alunos(nome, data_nascimento, naturalidade, responsaveis_aluno(nome, parentesco))"
    )
    .eq("id", matriculaId)
    .maybeSingle();
  if (error) throw error;
  if (!matricula) throw new Error(`Matrícula não encontrada: ${matriculaId}`);

  const aluno = matricula.alunos as {
    nome?: string;
    data_nascimento?: string | null;
    naturalidade?: string | null;
    responsaveis_aluno?: Array<{ nome: string; parentesco: string | null }>;
  } | null;
  const serie = matricula.series as { nome?: string; ordem?: number } | null;
  const turma = matricula.turmas as { nome?: string; turno?: string } | null;

  const credenciamento = matricula.serie_id
    ? await getCredenciamentoVigente(matricula.serie_id as string, matricula.ano_letivo as number)
    : null;

  let proximaSerie: string | null = null;
  if (serie?.ordem != null) {
    const { data: proxima } = await supabase
      .from("series")
      .select("nome")
      .eq("escola_id", DEFAULT_SCHOOL_ID)
      .eq("ativo", true)
      .gt("ordem", serie.ordem)
      .order("ordem", { ascending: true })
      .limit(1)
      .maybeSingle();
    proximaSerie = (proxima?.nome as string | undefined) ?? null;
  }

  return {
    nomeAluno: aluno?.nome ?? "",
    matricula: (matricula.codigo as string | null) ?? null,
    dataNascimento: aluno?.data_nascimento ?? null,
    naturalidade: aluno?.naturalidade ?? null,
    filiacao: montarFiliacao(aluno?.responsaveis_aluno ?? []),
    anoLetivo: matricula.ano_letivo as number,
    serieCorrente: serie?.nome ?? "",
    turma: turma?.nome ?? "",
    turno: turma?.turno ?? "",
    proximaSerie,
    nomeEmpresa: credenciamento?.nomeFantasia ?? "",
    cidadeEmpresa: credenciamento?.cidade ?? null,
    dataEmissaoIso: new Date().toISOString().slice(0, 10)
  };
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npm test -- src/lib/data/declaracao-emissao.test.ts`
Expected: PASS.

- [ ] **Step 5: Rodar typecheck**

Run: `npm run typecheck`
Expected: sem erros. Confira contra o schema real de `responsaveis_aluno`
(tabela `contatos_aluno` no schema inicial, ver
`supabase/migrations/202605130001_initial_schema.sql:79-85` — o nome exato
da tabela e coluna de parentesco pode divergir; ajuste o `.select(...)`
acima para o nome real de tabela/coluna se `contatos_aluno` for o nome
correto em vez de `responsaveis_aluno`. Verifique olhando como
`montarFiliacao` já é chamada em outro lugar do código (histórico) para
confirmar o formato de entrada esperado.

- [ ] **Step 6: Commit**

```bash
git add src/lib/data/declaracao-emissao.ts src/lib/data/declaracao-emissao.test.ts
git commit -m "feat(declaracoes): data layer de emissao, alunos elegiveis e montagem de dados

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Gerador de PDF da declaração (jsPDF)

**Files:**
- Create: `src/lib/documents/declaracao-pdf.ts`
- Test: `src/lib/documents/declaracao-pdf.test.ts`

**Interfaces:**
- Consumes: `medirAlturaCorpo`/`renderCorpo` (Task 1), `HistoricoCredenciamento`
  (`@/lib/historico/tipos`, já existe), `ImagemCache`/`imgFitInBox`
  (`@/lib/documents/pdf-utils`, já existe).
- Produces:
  ```typescript
  export type DeclaracaoPdfDados = {
    credenciamento: HistoricoCredenciamento; // cabeçalho + secretário/diretor
    titulo: string;
    corpo: string; // já resolvido por resolverDeclaracao — texto plano, sem [CHAVE]
    fecho: string; // idem
  };
  export function renderDeclaracoes(paginas: DeclaracaoPdfDados[], imagens: Map<string, { data: string; w: number; h: number }>): jsPDF;
  ```
  Task 9 (tela de emitir) consome `renderDeclaracoes`.

- [ ] **Step 1: Escrever o teste de layout**

```typescript
// src/lib/documents/declaracao-pdf.test.ts
import { describe, it, expect } from "vitest";
import { renderDeclaracoes, type DeclaracaoPdfDados } from "./declaracao-pdf";
import type { HistoricoCredenciamento } from "@/lib/historico/tipos";

function credenciamentoFake(): HistoricoCredenciamento {
  return {
    razaoSocial: "Escola Pinguinho de Gente Ltda",
    nomeFantasia: "EPG Trindade",
    cnpj: "11.714.876/0001-16",
    resolucao: "RESOLUÇÃO CEE/CEB Nº 518/2024",
    endereco: "Rua Eugênio Jardim, 473",
    cidade: "Trindade",
    uf: "GO",
    cep: "75388-686",
    telefones: null,
    email: null,
    logoPath: null,
    secretarioNome: "Keila Regina",
    secretarioCargo: "Secretário(a)",
    diretorNome: "Rafaela Machado",
    diretorCargo: "Diretor(a)"
  };
}

function paginaFake(overrides: Partial<DeclaracaoPdfDados> = {}): DeclaracaoPdfDados {
  return {
    credenciamento: credenciamentoFake(),
    titulo: "DECLARAÇÃO",
    corpo: "Declaramos para os devidos fins que o(a) aluno(a) MARIA DA SILVA está regularmente matriculado(a).",
    fecho: "Trindade, 24 de setembro de 2026",
    ...overrides
  };
}

describe("renderDeclaracoes", () => {
  it("gera 1 página por item da lista", () => {
    const doc = renderDeclaracoes([paginaFake(), paginaFake()], new Map());
    expect(doc.getNumberOfPages()).toBe(2);
  });

  it("lista vazia devolve documento com 1 página em branco", () => {
    const doc = renderDeclaracoes([], new Map());
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("não quebra sem logo (imagens vazio) nem sem secretário/diretor cadastrados", () => {
    const semAssinatura: HistoricoCredenciamento = {
      ...credenciamentoFake(),
      secretarioNome: null,
      diretorNome: null
    };
    expect(() =>
      renderDeclaracoes([paginaFake({ credenciamento: semAssinatura })], new Map())
    ).not.toThrow();
  });

  it("cabeçalho ausente (empresa sem nome_fantasia nem endereço) não quebra", () => {
    const vazio: HistoricoCredenciamento = {
      razaoSocial: "", nomeFantasia: "", cnpj: null, resolucao: null,
      endereco: null, cidade: null, uf: null, cep: null, telefones: null,
      email: null, logoPath: null, secretarioNome: null,
      secretarioCargo: "Secretário(a)", diretorNome: null, diretorCargo: "Diretor(a)"
    };
    expect(() => renderDeclaracoes([paginaFake({ credenciamento: vazio })], new Map())).not.toThrow();
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm test -- src/lib/documents/declaracao-pdf.test.ts`
Expected: FAIL — `./declaracao-pdf` não existe.

- [ ] **Step 3: Implementar o gerador**

```typescript
// src/lib/documents/declaracao-pdf.ts
import jsPDF from "jspdf";
import { medirAlturaCorpo, renderCorpo } from "./pdf-paragrafo";
import { imgFitInBox } from "./pdf-utils";
import type { Segmento } from "./certificado-texto";
import type { HistoricoCredenciamento } from "@/lib/historico/tipos";

export type ImagemCache = Map<string, { data: string; w: number; h: number }>;

export type DeclaracaoPdfDados = {
  credenciamento: HistoricoCredenciamento;
  titulo: string;
  corpo: string;
  fecho: string;
};

const PT_POR_MM = 72 / 25.4;
const mm = (valor: number) => valor * PT_POR_MM;
const MARGEM_MM = 20;
const FONTE = "times";

/** Logo padrão quando a company não tem logo_path — mesmo arquivo usado por
 * histórico e certificado, para as 3 impressões oficiais serem consistentes. */
const LOGO_PADRAO_PATH = "/historico/logo-epg.png";

function renderImagemCentralizada(
  doc: jsPDF,
  centroX: number,
  yInicial: number,
  imagem: { data: string; w: number; h: number } | undefined,
  maxW: number,
  maxH: number
): number {
  if (!imagem) return yInicial;
  const caixa = imgFitInBox(imagem, maxW, maxH);
  const formato = imagem.data.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
  doc.addImage(imagem.data, formato, centroX - caixa.w / 2, yInicial, caixa.w, caixa.h, undefined, "FAST");
  return yInicial + caixa.h;
}

/** Cabeçalho de 1 coluna (logo + dados da empresa) — diferente do
 * certificado (3 colunas com brasões), porque a declaração não é um
 * documento com brasão nacional. */
function renderCabecalho(doc: jsPDF, yInicial: number, c: HistoricoCredenciamento, imagens: ImagemCache): number {
  const centro = doc.internal.pageSize.getWidth() / 2;
  let y = yInicial;

  const logo = imagens.get(c.logoPath ?? LOGO_PADRAO_PATH) ?? imagens.get(LOGO_PADRAO_PATH);
  if (logo) {
    y = renderImagemCentralizada(doc, centro, y, logo, mm(70), mm(28)) + 8;
  }

  doc.setTextColor(0, 0, 0);
  doc.setFont(FONTE, "bold");
  doc.setFontSize(13);
  if (c.nomeFantasia) {
    doc.text(c.nomeFantasia, centro, y, { align: "center" });
    y += 14;
  }

  doc.setFont(FONTE, "normal");
  doc.setFontSize(8);
  const cidadeUf = c.cidade && c.uf ? `${c.cidade} - ${c.uf}` : c.cidade ?? c.uf;
  const linhas = [
    c.cnpj ? `CNPJ: ${c.cnpj}` : null,
    c.endereco,
    [cidadeUf, c.cep ? `CEP: ${c.cep}` : null].filter(Boolean).join(" · ")
  ].filter((l): l is string => Boolean(l && l.trim()));

  for (const linha of linhas) {
    doc.text(linha, centro, y, { align: "center" });
    y += 10;
  }

  return y + 16;
}

function renderTitulo(doc: jsPDF, yInicial: number, titulo: string): number {
  const centro = doc.internal.pageSize.getWidth() / 2;
  doc.setFont(FONTE, "bold");
  doc.setFontSize(16);
  doc.text(titulo, centro, yInicial, { align: "center" });
  return yInicial + 24;
}

function renderFecho(doc: jsPDF, yInicial: number, fecho: string, margemPt: number): number {
  doc.setFont(FONTE, "normal");
  doc.setFontSize(11);
  const util = doc.internal.pageSize.getWidth() - margemPt * 2;
  const linhas = doc.splitTextToSize(fecho, util) as string[];
  let y = yInicial;
  for (const linha of linhas) {
    doc.text(linha, margemPt, y);
    y += 15;
  }
  return y;
}

/** Secretário + Diretor, mesmo padrão de 2 colunas usado no histórico
 * escolar — mesmas duas assinaturas fixas, sem config por escola. */
function renderAssinaturas(doc: jsPDF, yInicial: number, c: HistoricoCredenciamento, margemPt: number): void {
  const assinaturas = [
    { nome: c.secretarioNome, cargo: c.secretarioCargo },
    { nome: c.diretorNome, cargo: c.diretorCargo }
  ].filter((a) => a.nome?.trim());
  if (assinaturas.length === 0) return;

  const util = doc.internal.pageSize.getWidth() - margemPt * 2;
  const larguraColuna = util / assinaturas.length;
  const larguraLinha = Math.min(larguraColuna - mm(8), mm(75));

  assinaturas.forEach((a, i) => {
    const centro = margemPt + larguraColuna * i + larguraColuna / 2;

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.7);
    doc.line(centro - larguraLinha / 2, yInicial, centro + larguraLinha / 2, yInicial);

    doc.setFont(FONTE, "bold");
    doc.setFontSize(9);
    let y = yInicial + 11;
    for (const linha of doc.splitTextToSize((a.nome ?? "").toUpperCase(), larguraLinha) as string[]) {
      doc.text(linha, centro, y, { align: "center" });
      y += 10;
    }

    doc.setFont(FONTE, "normal");
    doc.setFontSize(8.5);
    doc.text(a.cargo, centro, y, { align: "center" });
  });
}

function renderPagina(doc: jsPDF, dados: DeclaracaoPdfDados, imagens: ImagemCache): void {
  const margem = mm(MARGEM_MM);
  const alturaPagina = doc.internal.pageSize.getHeight();

  const yTopo = renderCabecalho(doc, margem + 12, dados.credenciamento, imagens);
  let y = renderTitulo(doc, yTopo + 20, dados.titulo);

  const segmentos: Segmento[] = [{ texto: dados.corpo, negrito: false }];
  const opcoesParagrafo = { fonte: FONTE, fonteCorpoPt: 11, margemPt: margem };
  y = renderCorpo(doc, y + 20, segmentos, opcoesParagrafo);
  y = renderFecho(doc, y + 24, dados.fecho, margem);

  const alturaBlocoAssinaturas = mm(22);
  const yAssinaturas = alturaPagina - margem - alturaBlocoAssinaturas;
  renderAssinaturas(doc, Math.max(y + 30, yAssinaturas), dados.credenciamento, margem);
}

/**
 * Uma página (retrato) por item da lista — cada item é um aluno, na emissão
 * em lote por série/turma. Lista vazia devolve a página em branco que o
 * construtor já cria, mesmo padrão de `renderCertificados`.
 */
export function renderDeclaracoes(paginas: DeclaracaoPdfDados[], imagens: ImagemCache): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  paginas.forEach((dados, i) => {
    if (i > 0) doc.addPage("a4", "portrait");
    renderPagina(doc, dados, imagens);
  });

  return doc;
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npm test -- src/lib/documents/declaracao-pdf.test.ts`
Expected: PASS — 4 testes verdes.

- [ ] **Step 5: Rodar typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/lib/documents/declaracao-pdf.ts src/lib/documents/declaracao-pdf.test.ts
git commit -m "feat(declaracoes): gerador de PDF da declaracao, reaproveitando motor de paragrafo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Tela de emissão (`/declaracoes/emitir`)

**Files:**
- Create: `src/app/(app)/declaracoes/emitir/page.tsx`
- Create: `src/components/declaracoes/declaracao-emissao-form.tsx`
- Create: `src/lib/actions/declaracao-emissao.ts`
- Test: `src/components/declaracoes/declaracao-emissao-form.test.tsx`

**Interfaces:**
- Consumes: `listarAlunosParaDeclaracao`/`buscarDadosDeclaracao` (Task 7),
  `resolverDeclaracao` (Task 3), `listarDeclaracaoModelos` (Task 4),
  `renderDeclaracoes` (Task 8).
- Produces:
  - `previsualizarDeclaracaoAction(matriculaId: string, modeloId: string):
    Promise<{ titulo: string; texto: string; fecho: string }>` — resolve o
    modelo para UM aluno de referência (o selecionado, ou o primeiro da
    lista), para a pré-visualização editável antes de emitir. A spec exige
    isto: "a pré-visualização mostra Título/Texto/Fecho já resolvidos para
    o primeiro aluno do filtro (...); edições valem só para essa emissão".
  - `carregarDeclaracoesAction(matriculaIds: string[], modeloId: string,
    overrides?: { titulo?: string; texto?: string; fecho?: string }):
    Promise<DeclaracaoPdfDados[]>` — Server Action que resolve os dados de
    cada aluno e devolve as páginas já resolvidas, aplicando `overrides`
    (o que a pré-visualização foi editada para) por cima do modelo salvo,
    sem gravar nada no banco. O client então chama `renderDeclaracoes`
    para gerar o PDF, mesmo padrão de `carregarHistoricosAction` em
    `emissao-form.tsx`.

- [ ] **Step 1: Escrever o teste do componente (mock das actions)**

```tsx
// src/components/declaracoes/declaracao-emissao-form.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockPrevisualizar = vi.fn();
vi.mock("@/lib/actions/declaracao-emissao", () => ({
  carregarDeclaracoesAction: vi.fn(),
  previsualizarDeclaracaoAction: (...args: unknown[]) => mockPrevisualizar(...args)
}));

import { DeclaracaoEmissaoForm } from "./declaracao-emissao-form";

const modeloBase = { id: "mod1", codigo: 1, nome: "Declaração de Frequência", titulo: "T", texto: "X [NOME_ALUNO]", fecho: "F", ativo: true, created_at: null, updated_at: null };

describe("DeclaracaoEmissaoForm", () => {
  beforeEach(() => {
    mockPrevisualizar.mockReset();
  });

  it("mostra o botão Emitir PDF desabilitado sem nenhum aluno elegível", () => {
    render(
      <DeclaracaoEmissaoForm
        anoLetivo={2026}
        series={[]}
        turmas={[]}
        alunosElegiveis={[]}
        modelos={[modeloBase]}
      />
    );
    expect(screen.getByRole("button", { name: /emitir pdf/i })).toBeDisabled();
  });

  it("habilita Emitir PDF quando há alunos elegíveis e um modelo selecionado", () => {
    render(
      <DeclaracaoEmissaoForm
        anoLetivo={2026}
        series={[]}
        turmas={[]}
        alunosElegiveis={[{ matriculaId: "m1", alunoId: "a1", nome: "Ana" }]}
        modelos={[modeloBase]}
      />
    );
    expect(screen.getByRole("button", { name: /emitir pdf/i })).toBeEnabled();
  });

  it("ao escolher um modelo, busca a pré-visualização para o primeiro aluno do filtro e preenche os campos editáveis", async () => {
    mockPrevisualizar.mockResolvedValue({ titulo: "DECLARAÇÃO", texto: "X ANA DA SILVA", fecho: "Trindade, hoje" });

    render(
      <DeclaracaoEmissaoForm
        anoLetivo={2026}
        series={[]}
        turmas={[]}
        alunosElegiveis={[{ matriculaId: "m1", alunoId: "a1", nome: "Ana" }]}
        modelos={[modeloBase]}
      />
    );

    fireEvent.change(screen.getByLabelText(/modelo de declaração/i), { target: { value: "mod1" } });

    await waitFor(() => {
      expect(mockPrevisualizar).toHaveBeenCalledWith("m1", "mod1");
    });
    await waitFor(() => {
      expect(screen.getByDisplayValue("X ANA DA SILVA")).toBeInTheDocument();
    });
  });

  it("edição na pré-visualização não persiste — reabrir o form limpo mostra o texto original do modelo, não o editado", async () => {
    mockPrevisualizar.mockResolvedValue({ titulo: "DECLARAÇÃO", texto: "X ANA DA SILVA", fecho: "Trindade, hoje" });

    const { unmount } = render(
      <DeclaracaoEmissaoForm
        anoLetivo={2026}
        series={[]}
        turmas={[]}
        alunosElegiveis={[{ matriculaId: "m1", alunoId: "a1", nome: "Ana" }]}
        modelos={[modeloBase]}
      />
    );
    fireEvent.change(screen.getByLabelText(/modelo de declaração/i), { target: { value: "mod1" } });
    await waitFor(() => expect(screen.getByDisplayValue("X ANA DA SILVA")).toBeInTheDocument());

    const textoPreview = screen.getByLabelText(/texto \(pré-visualização\)/i);
    fireEvent.change(textoPreview, { target: { value: "TEXTO EDITADO SÓ PARA ESTA EMISSÃO" } });
    expect(screen.getByDisplayValue("TEXTO EDITADO SÓ PARA ESTA EMISSÃO")).toBeInTheDocument();

    // A edição é só estado local do componente — desmontar e remontar (o
    // que aconteceria numa nova visita à página) não deve reaproveitar o
    // texto editado, porque nada foi persistido no modelo.
    unmount();
    mockPrevisualizar.mockResolvedValue({ titulo: "DECLARAÇÃO", texto: "X ANA DA SILVA", fecho: "Trindade, hoje" });
    render(
      <DeclaracaoEmissaoForm
        anoLetivo={2026}
        series={[]}
        turmas={[]}
        alunosElegiveis={[{ matriculaId: "m1", alunoId: "a1", nome: "Ana" }]}
        modelos={[modeloBase]}
      />
    );
    fireEvent.change(screen.getByLabelText(/modelo de declaração/i), { target: { value: "mod1" } });
    await waitFor(() => expect(screen.getByDisplayValue("X ANA DA SILVA")).toBeInTheDocument());
    expect(screen.queryByDisplayValue("TEXTO EDITADO SÓ PARA ESTA EMISSÃO")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm test -- src/components/declaracoes/declaracao-emissao-form.test.tsx`
Expected: FAIL — `./declaracao-emissao-form` não existe.

- [ ] **Step 3: Implementar as Server Actions de pré-visualização e carregamento**

```typescript
// src/lib/actions/declaracao-emissao.ts
"use server";

import { buscarDadosDeclaracao } from "@/lib/data/declaracao-emissao";
import { getDeclaracaoModeloById } from "@/lib/data/declaracoes";
import { resolverDeclaracao } from "@/lib/documents/declaracao-resolver";
import { getCredenciamentoVigente } from "@/lib/data/historico";
import { createServerClient } from "@/lib/supabase/server";
import type { DeclaracaoPdfDados } from "@/lib/documents/declaracao-pdf";

/**
 * Resolve o modelo escolhido para UM aluno de referência (o selecionado, ou
 * o primeiro do filtro) — usado pela tela para mostrar Título/Texto/Fecho
 * já com os parâmetros trocados, antes de emitir. A pessoa pode editar esse
 * resultado; a edição não é salva em lugar nenhum, só usada nesta emissão
 * (ver `carregarDeclaracoesAction`, parâmetro `overrides`).
 */
export async function previsualizarDeclaracaoAction(
  matriculaId: string,
  modeloId: string
): Promise<{ titulo: string; texto: string; fecho: string }> {
  const modelo = await getDeclaracaoModeloById(modeloId);
  if (!modelo) throw new Error("Modelo de declaração não encontrado.");

  const dados = await buscarDadosDeclaracao(matriculaId);
  return resolverDeclaracao(modelo, dados);
}

/**
 * Resolve os dados de cada aluno e devolve as páginas já prontas para o
 * gerador de PDF (client-side). `overrides` é o que a pré-visualização foi
 * editada para nesta emissão — aplicado por cima do modelo salvo, sem
 * gravar nada no banco. Uma matrícula com erro (ex.: sem série vinculada)
 * não interrompe as demais — ver Review Focus do plano: emissão em lote
 * precisa ser resiliente por aluno.
 */
export async function carregarDeclaracoesAction(
  matriculaIds: string[],
  modeloId: string,
  overrides?: { titulo?: string; texto?: string; fecho?: string }
): Promise<DeclaracaoPdfDados[]> {
  const modelo = await getDeclaracaoModeloById(modeloId);
  if (!modelo) throw new Error("Modelo de declaração não encontrado.");

  const modeloEfetivo = {
    titulo: overrides?.titulo ?? modelo.titulo,
    texto: overrides?.texto ?? modelo.texto,
    fecho: overrides?.fecho ?? modelo.fecho
  };

  const supabase = await createServerClient();
  const paginas: DeclaracaoPdfDados[] = [];

  for (const matriculaId of matriculaIds) {
    try {
      const dados = await buscarDadosDeclaracao(matriculaId);

      const { data: matriculaRow } = await supabase
        .from("matriculas")
        .select("serie_id, ano_letivo")
        .eq("id", matriculaId)
        .maybeSingle();

      const credenciamento = matriculaRow?.serie_id
        ? await getCredenciamentoVigente(matriculaRow.serie_id as string, matriculaRow.ano_letivo as number)
        : null;
      if (!credenciamento) continue;

      const resolvido = resolverDeclaracao(modeloEfetivo, dados);
      paginas.push({ credenciamento, titulo: resolvido.titulo, corpo: resolvido.texto, fecho: resolvido.fecho });
    } catch {
      // Aluno com dado incompleto não derruba o lote inteiro — só fica de
      // fora do PDF final. Sem log aqui: Server Action, sem acesso a
      // console do cliente; o comportamento observável é "não apareceu" e
      // já é o suficiente para o Review Focus deste plano.
      continue;
    }
  }

  return paginas;
}
```

- [ ] **Step 4: Implementar o componente de emissão, com pré-visualização editável**

```tsx
// src/components/declaracoes/declaracao-emissao-form.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { carregarDeclaracoesAction, previsualizarDeclaracaoAction } from "@/lib/actions/declaracao-emissao";
import { renderDeclaracoes } from "@/lib/documents/declaracao-pdf";
import { carregarImagens } from "@/lib/documents/pdf-utils";
import type { AlunoParaDeclaracao } from "@/lib/data/declaracao-emissao";
import type { DeclaracaoModeloRow } from "@/lib/data/declaracoes";

type Serie = { id: string; nome: string };
type Turma = { id: string; nome: string; serieId: string };
type Preview = { titulo: string; texto: string; fecho: string };

type Props = {
  anoLetivo: number;
  series: Serie[];
  turmas: Turma[];
  alunosElegiveis: AlunoParaDeclaracao[];
  modelos: DeclaracaoModeloRow[];
};

export function DeclaracaoEmissaoForm({ anoLetivo, series, turmas, alunosElegiveis, modelos }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const serieSelecionada = searchParams.get("serie") ?? "";
  const turmaSelecionada = searchParams.get("turma") ?? "";
  const alunoSelecionado = searchParams.get("aluno") ?? "";
  const modeloSelecionado = searchParams.get("modelo") ?? "";

  const [emitindo, setEmitindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [carregandoPreview, setCarregandoPreview] = useState(false);

  const turmasDaSerie = serieSelecionada ? turmas.filter((t) => t.serieId === serieSelecionada) : turmas;

  // Aluno de referência para a pré-visualização: o selecionado no filtro,
  // ou o primeiro da lista de elegíveis — mesma regra da spec ("resolvidos
  // para o primeiro aluno do filtro, ou o único, se um aluno específico foi
  // escolhido").
  const matriculaReferencia = alunoSelecionado
    ? alunosElegiveis.find((a) => a.alunoId === alunoSelecionado)?.matriculaId
    : alunosElegiveis[0]?.matriculaId;

  // Troca de modelo (ou de aluno/turma, que muda quem é o "primeiro aluno")
  // busca a pré-visualização de novo. A edição feita pela pessoa no
  // textarea abaixo é sobrescrita nessa recarga — comportamento esperado,
  // pois mudar o filtro é escolher para quem gerar, não uma continuação da
  // mesma edição.
  useEffect(() => {
    if (!modeloSelecionado || !matriculaReferencia) {
      setPreview(null);
      return;
    }
    let cancelado = false;
    setCarregandoPreview(true);
    previsualizarDeclaracaoAction(matriculaReferencia, modeloSelecionado)
      .then((resultado) => {
        if (!cancelado) setPreview(resultado);
      })
      .catch(() => {
        if (!cancelado) setErro("Não foi possível carregar a pré-visualização.");
      })
      .finally(() => {
        if (!cancelado) setCarregandoPreview(false);
      });
    return () => {
      cancelado = true;
    };
  }, [modeloSelecionado, matriculaReferencia]);

  const atualizar = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v == null || v === "") params.delete(k);
        else params.set(k, v);
      }
      router.push(`/declaracoes/emitir?${params.toString()}`);
    },
    [router, searchParams]
  );

  const podeEmitir = alunosElegiveis.length > 0 && modeloSelecionado !== "" && !emitindo;

  async function emitir() {
    if (!podeEmitir) return;
    setEmitindo(true);
    setErro(null);
    try {
      const matriculaIds = alunosElegiveis.map((a) => a.matriculaId);
      // A edição da pré-visualização vale só para esta emissão — nunca é
      // gravada no modelo (spec: "edições valem só para essa emissão").
      const overrides = preview ? { titulo: preview.titulo, texto: preview.texto, fecho: preview.fecho } : undefined;
      const paginas = await carregarDeclaracoesAction(matriculaIds, modeloSelecionado, overrides);
      if (paginas.length === 0) {
        setErro("Nenhuma declaração pôde ser gerada para os alunos selecionados.");
        return;
      }
      const logoPaths = paginas.map((p) => p.credenciamento.logoPath ?? "/historico/logo-epg.png");
      const imagens = await carregarImagens([...new Set(logoPaths), "/historico/logo-epg.png"]);
      renderDeclaracoes(paginas, imagens).save(`declaracoes-${anoLetivo}.pdf`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao emitir as declarações.");
    } finally {
      setEmitindo(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-4">
        <label>
          Série
          <select value={serieSelecionada} onChange={(e) => atualizar({ serie: e.target.value, turma: null, aluno: null })}>
            <option value="">Todas</option>
            {series.map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
        </label>
        <label>
          Turma
          <select value={turmaSelecionada} onChange={(e) => atualizar({ turma: e.target.value, aluno: null })}>
            <option value="">Todas</option>
            {turmasDaSerie.map((t) => (
              <option key={t.id} value={t.id}>{t.nome}</option>
            ))}
          </select>
        </label>
        <label>
          Aluno
          <select value={alunoSelecionado} onChange={(e) => atualizar({ aluno: e.target.value })}>
            <option value="">Todos ({alunosElegiveis.length})</option>
            {alunosElegiveis.map((a) => (
              <option key={a.alunoId} value={a.alunoId}>{a.nome}</option>
            ))}
          </select>
        </label>
        <label>
          Modelo de Declaração
          <select value={modeloSelecionado} onChange={(e) => atualizar({ modelo: e.target.value })}>
            <option value="">Selecione</option>
            {modelos.map((m) => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </select>
        </label>
      </div>

      {modeloSelecionado ? (
        <div className="grid gap-3 rounded-ui border border-line p-4">
          <p className="text-xs font-medium text-ink/60">
            Visualização do modelo (edições aqui valem só para esta emissão — o modelo salvo não muda)
          </p>
          {carregandoPreview ? (
            <p className="text-sm text-ink/60">Carregando pré-visualização...</p>
          ) : preview ? (
            <>
              <label>
                Título da declaração
                <input
                  value={preview.titulo}
                  onChange={(e) => setPreview({ ...preview, titulo: e.target.value })}
                />
              </label>
              <label>
                Texto (pré-visualização)
                <textarea
                  value={preview.texto}
                  onChange={(e) => setPreview({ ...preview, texto: e.target.value })}
                  rows={5}
                />
              </label>
              <label>
                Fecho (pré-visualização)
                <textarea
                  value={preview.fecho}
                  onChange={(e) => setPreview({ ...preview, fecho: e.target.value })}
                  rows={2}
                />
              </label>
            </>
          ) : (
            <p className="text-sm text-ink/60">Selecione ao menos um aluno elegível para pré-visualizar.</p>
          )}
        </div>
      ) : null}

      {erro ? <p className="text-sm text-danger">{erro}</p> : null}

      <div className="flex justify-end">
        <Button type="button" variant="primary" disabled={!podeEmitir} loading={emitindo} onClick={emitir}>
          Emitir PDF
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Rodar o teste e ver passar**

Run: `npm test -- src/components/declaracoes/declaracao-emissao-form.test.tsx`
Expected: PASS.

- [ ] **Step 6: Implementar a page (busca séries/turmas/alunos elegíveis e modelos no server)**

```tsx
// src/app/(app)/declaracoes/emitir/page.tsx
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { DeclaracaoEmissaoForm } from "@/components/declaracoes/declaracao-emissao-form";
import { listarAlunosParaDeclaracao } from "@/lib/data/declaracao-emissao";
import { listarDeclaracaoModelos } from "@/lib/data/declaracoes";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { createServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";

export default async function EmitirDeclaracaoPage({
  searchParams
}: {
  searchParams: Promise<{ serie?: string; turma?: string; aluno?: string; modelo?: string }>;
}) {
  await requirePermission("historico", "read");
  const sp = await searchParams;
  const anoLetivo = new Date().getFullYear();

  const supabase = await createServerClient();
  const [{ data: series }, { data: turmas }, modelos, alunosElegiveis] = await Promise.all([
    supabase.from("series").select("id, nome").eq("escola_id", DEFAULT_SCHOOL_ID).eq("ativo", true).order("ordem"),
    supabase.from("turmas").select("id, nome, serie_id").eq("escola_id", DEFAULT_SCHOOL_ID).eq("ano_letivo", anoLetivo),
    listarDeclaracaoModelos(),
    listarAlunosParaDeclaracao({
      anoLetivo,
      serieId: sp.serie || undefined,
      turmaId: sp.turma || undefined,
      alunoId: sp.aluno || undefined
    })
  ]);

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Acadêmico" }, { label: "Declarações", href: "/declaracoes" }, { label: "Emitir" }]}
        title="Emissão de declaração pedagógica"
      />
      <Panel className="p-6">
        <DeclaracaoEmissaoForm
          anoLetivo={anoLetivo}
          series={(series ?? []).map((s) => ({ id: s.id as string, nome: s.nome as string }))}
          turmas={(turmas ?? []).map((t) => ({ id: t.id as string, nome: t.nome as string, serieId: t.serie_id as string }))}
          alunosElegiveis={alunosElegiveis}
          modelos={modelos}
        />
      </Panel>
    </div>
  );
}
```

- [ ] **Step 7: Adicionar entrada no menu**

Em `src/components/layout/topbar.tsx`, junto do item adicionado na Task 6
(dentro de "Acadêmico"):

```typescript
{ href: "/declaracoes/emitir", label: "Emitir Declaração", iconName: "FileOutput" },
```

- [ ] **Step 8: Rodar a suíte completa da feature, typecheck e build**

Run: `npm test -- src/lib/documents src/lib/data/declaracoes.test.ts src/lib/data/declaracao-emissao.test.ts src/lib/validation/declaracoes.test.ts src/lib/actions/declaracoes.test.ts src/components/declaracoes`
Expected: todos os testes passam.

Run: `npm run typecheck && npm run build`
Expected: build verde, rotas `/declaracoes/emitir` e `/declaracoes/modelos*`
compiladas.

- [ ] **Step 9: Commit**

```bash
git add src/app/\(app\)/declaracoes/emitir src/components/declaracoes/declaracao-emissao-form.tsx src/components/declaracoes/declaracao-emissao-form.test.tsx src/lib/actions/declaracao-emissao.ts src/components/layout/topbar.tsx
git commit -m "feat(declaracoes): tela de emissao em lote com pre-visualizacao editavel e geracao de PDF

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: Verificação final e smoke test manual

**Files:** nenhum arquivo novo — task de verificação.

- [ ] **Step 1: Rodar typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 2: Rodar build**

Run: `npm run build`
Expected: build verde.

- [ ] **Step 3: Rodar toda a suíte de teste**

Run: `npm test`
Expected: todos os testes passam, exceto a falha pré-existente e não
relacionada de `conferencia-planilha.test.ts` (fixture externa ausente).

- [ ] **Step 4: Checklist manual (smoke test local)**

1. Abrir `/declaracoes/modelos`, confirmar que os 4 modelos-seed aparecem.
2. Editar um modelo, usar "Adicionar parâmetro" para inserir `[TURMA]`,
   salvar, reabrir e confirmar que persistiu.
3. Tentar salvar um modelo com `[PARAMETRO_INVALIDO]` no texto e confirmar
   que a tela mostra erro em vez de salvar.
4. Abrir `/declaracoes/emitir`, escolher Ano Letivo + Série/Turma sem aluno
   específico, escolher um modelo, confirmar que a pré-visualização aparece
   preenchida com os dados do primeiro aluno da turma antes de emitir.
5. Editar o texto da pré-visualização, emitir PDF, e confirmar que o PDF
   sai com o texto editado — depois recarregar a página e reabrir o mesmo
   modelo em `/declaracoes/modelos`, confirmando que o texto salvo do
   modelo continua o original (a edição não persistiu).
6. Sem editar a pré-visualização, emitir PDF sem aluno específico e
   confirmar que sai 1 página por aluno da turma.
7. Repetir escolhendo um aluno específico, confirmar 1 página só.
8. Conferir visualmente que o cabeçalho (logo + dados da empresa) e o
   rodapé (assinatura de secretário/diretor) têm o mesmo estilo visual do
   certificado/histórico já existentes.
9. Emitir a "Declaração de Transferência — Não Concluído" para um aluno com
   matrícula `cancelada` do ano corrente (se houver um caso de teste),
   confirmando que ele aparece na lista de elegíveis (matrícula cancelada
   não é excluída, conforme a spec).

- [ ] **Step 5: Commit final (se houver ajustes do smoke test)**

```bash
git add -A
git commit -m "fix(declaracoes): ajustes finais do smoke test de declaracoes pedagogicas

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

*(Pular este commit se o smoke test não exigir nenhuma mudança.)*
