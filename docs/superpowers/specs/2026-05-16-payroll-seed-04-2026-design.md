# Seed Payroll 04/2026 — Folha de Pagamento Base

## Objetivo

Construir nova seed (`scripts/payroll_seed.sql`) transcrita manualmente das 6 imagens da folha 04/2026, populando `payroll` (ref. 2026-05-01) e defaults em `employees`, para que a tela de Folha de Pagamento nasça preenchida.

## Escopo

- Reference month fixo: `2026-05-01`
- ~70 funcionários distribuídos em 6 grupos/imagens
- Atualiza tanto `payroll` quanto `employees` defaults
- Estratégia: UPSERT (ON CONFLICT DO UPDATE)
- Match: por `employees.name` (ILIKE) + `companies.name` para desambiguar homônimos

## Mapeamento colunas → schema

| Coluna imagem | Coluna DB | Notas |
|---|---|---|
| Salário base | `payroll.base_salary` | |
| SALÁRIO S/ DSR | `payroll.salario_sem_dsr` | só imagem 4 |
| DSR | (não persiste) | derivado: `base_salary - salario_sem_dsr` |
| Adicional | `payroll.additional` | |
| Salário dobra | (flag) | `aplica_dobra=true` se preenchido |
| DSR (dobra) | (não persiste) | derivado em recalc |
| 1/3 férias | `payroll.considera_um_tercio_ferias` | `true` quando preenchido |
| TOTAL SALÁRIO | `payroll.total_earnings` | valor da imagem (não recalcular) |
| GPS | `payroll.gps` + `employees.gps_default` | imagem 4 |
| INSS | `payroll.inss` | |
| IR/IRRF | `payroll.ir` | |
| Cred. Trabalhista / SIND / Empréstimo | `payroll.loan_deduction` | |
| ADIANT | `payroll.advance` | |
| Deduções | `payroll.total_deductions` | |
| Família | `payroll.family_allowance` | |
| Receber | `payroll.net_amount` | |

## Agrupamento por imagem → empresa

| Imagem | Faixa nomes | Empresa | Aba dobra? |
|---|---|---|---|
| 1 | Carolina Cardoso Miranda … Samantha Silva Amorim | Escola Pinguinho | não |
| 2 | Benedito Rodrigues borges … Suzane dos Santos Martins | Colegio Integrado EPG | não |
| 3 | Ana Livia Lourenço Ferreira … CARLOS LEONARDO ALVES SOARES | Colegio Integrado EPG | não |
| 4 | Ana Flávia de Jesus Luciano … Victória Karoline | Escola Pinguinho | **sim** (S/DSR, DSR, 1/3 férias, GPS, cred trab) |
| 5 | Joseane Silva Leite … Wânia Marques Silva | Colegio Integrado EPG | não |
| 6 | Aurio Velozo … Valdirene da Silva Cunha | Escola Pinguinho | não |

## Estrutura do SQL gerado

```sql
-- Seed payroll 04/2026 (folha base, ref=2026-05-01)
-- Gerado manualmente das imagens da folha física

-- 1) Defaults em employees (aplica_dobra, salario_sem_dsr, gps_default)
UPDATE public.employees SET aplica_dobra=true, salario_sem_dsr=2304.75, gps_default=575.89
  WHERE name ILIKE 'Ana Flávia de Jesus Luciano'
    AND company_id=(SELECT id FROM public.companies WHERE name ILIKE '%Pinguinho%');
-- ... (uma linha por funcionário com dobra/gps)

-- 2) Upsert payroll
INSERT INTO public.payroll (
  employee_id, reference_month, base_salary, additional, considera_um_tercio_ferias,
  total_earnings, inss, ir, loan_deduction, advance, total_deductions,
  family_allowance, net_amount, salario_sem_dsr, aplica_dobra, gps
) VALUES
  -- Carolina Cardoso Miranda [Pinguinho]
  ((SELECT id FROM public.employees WHERE name ILIKE 'Carolina Cardoso Miranda'
      AND company_id=(SELECT id FROM public.companies WHERE name ILIKE '%Pinguinho%') LIMIT 1),
   '2026-05-01', 2067.19, 0, false, 2067.19, NULL, NULL, 0, 0, 0, 0, 2067.19, NULL, false, NULL),
  -- ...
ON CONFLICT (employee_id, reference_month) DO UPDATE SET
  base_salary = EXCLUDED.base_salary,
  additional = EXCLUDED.additional,
  considera_um_tercio_ferias = EXCLUDED.considera_um_tercio_ferias,
  total_earnings = EXCLUDED.total_earnings,
  inss = EXCLUDED.inss,
  ir = EXCLUDED.ir,
  loan_deduction = EXCLUDED.loan_deduction,
  advance = EXCLUDED.advance,
  total_deductions = EXCLUDED.total_deductions,
  family_allowance = EXCLUDED.family_allowance,
  net_amount = EXCLUDED.net_amount,
  salario_sem_dsr = EXCLUDED.salario_sem_dsr,
  aplica_dobra = EXCLUDED.aplica_dobra,
  gps = EXCLUDED.gps;
```

## Regras de transcrição

- Célula vazia/traço (`-`) numérico → `0` (não `NULL`) para evitar quebra de soma
- Célula em branco em coluna calculada (INSS/IR/Receber) onde não houve cálculo → valor da imagem mesmo que zero
- `aplica_dobra = true` quando linha tem coluna "Salário dobra" preenchida E > 0
- `considera_um_tercio_ferias = true` quando coluna "1/3 férias" preenchida
- Funcionários que aparecem na DB mas não na imagem: não tocar (sem linha 05/2026)
- Funcionários da imagem que não casam com DB: comentar `-- NOT_FOUND` e seguir
- Marcação amarela: ignorar (apenas visual)

## Riscos

- **Imagens em baixa resolução em alguns campos**: marcar `-- TODO confirmar` quando ilegível
- **Homônimos** (ex: Carolina Cardoso Miranda em ambas empresas, Elaine Batista Oliveira, Maria Angélica de Araújo): desambiguar por empresa do grupo
- **Total_earnings vs cálculo**: usar valor da imagem (fidelidade à folha física, não recalcular)

## Entrega

- `scripts/payroll_seed.sql` (sobrescreve atual)
- Execução manual via Supabase SQL Editor ou `psql`

## Verificação

```sql
SELECT COUNT(*) FROM public.payroll WHERE reference_month='2026-05-01';
SELECT e.name, c.name AS empresa, p.base_salary, p.aplica_dobra, p.gps, p.net_amount
FROM public.payroll p
JOIN public.employees e ON e.id=p.employee_id
JOIN public.companies c ON c.id=e.company_id
WHERE p.reference_month='2026-05-01'
ORDER BY c.name, e.name;
```
