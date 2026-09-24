-- Preenche contraparte_doc das linhas já importadas, a partir do payload cru.
--
-- O mapItem lia `cpfCnpj`, campo que aparece em 2 dos 1.294 itens medidos em
-- produção; o documento vem em `descInfComplementar`, entre os delimitadores
-- `|@`, e só nos Pix emitidos. Como o payload inteiro já está gravado em
-- extrato_bancario.payload, o backfill não precisa consultar a API de novo.
--
-- Mesma regra da função extrairDocumentoContraparte (TS): trecho entre |@,
-- só os dígitos, null quando não sobra nada.
--
-- O fallback para cpfCnpj entra quando o trecho entre |@ não sobra dígito
-- nenhum, não só quando o delimitador |@ está ausente (achado da revisão da
-- Task 2, 24/09/2026): um coalesce sobre as strings cruas, antes de extrair
-- dígitos, cai para cpfCnpj só no caso "sem |@" e ignora o caso "|@ presente
-- mas totalmente mascarado" (ex. "|@***.***.***-**|@"), que na função TS
-- também cai para cpfCnpj. Por isso os dígitos são extraídos de cada lado
-- primeiro, e só então o coalesce escolhe entre eles — replica
-- extrairDocumentoContraparte exatamente, inclusive nesse caso de borda.
-- Não afeta os 230/556/383 medidos (zero linhas caem nesse caso hoje), mas
-- evita divergência silenciosa numa reexecução futura sobre dado novo.
--
-- Idempotente: só toca linha cujo valor calculado difere do gravado.
-- Ref: docs/superpowers/specs/2026-09-23-financeiro-debitos-transferencias-design.md

update extrato_bancario e
set contraparte_doc = calc.doc
from (
  select id,
         coalesce(
           nullif(regexp_replace(
             coalesce(substring(payload->>'descInfComplementar' from '\|@([^|]*)'), ''),
             '\D', '', 'g'), ''),
           nullif(regexp_replace(coalesce(payload->>'cpfCnpj', ''), '\D', '', 'g'), '')
         ) as doc
  from extrato_bancario
) calc
where calc.id = e.id
  and e.contraparte_doc is distinct from calc.doc;
