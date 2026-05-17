-- Backfill employees.base_salary a partir do payroll mais recente de cada funcionário
-- Pega base_salary da última linha payroll (maior reference_month) por employee_id

BEGIN;

WITH latest AS (
  SELECT DISTINCT ON (employee_id)
    employee_id,
    base_salary
  FROM public.payroll
  WHERE base_salary IS NOT NULL AND base_salary > 0
  ORDER BY employee_id, reference_month DESC
)
UPDATE public.employees e
SET base_salary = l.base_salary
FROM latest l
WHERE e.id = l.employee_id;

COMMIT;

-- Verificação
SELECT
  COUNT(*) FILTER (WHERE base_salary > 0) AS com_base,
  COUNT(*) FILTER (WHERE base_salary = 0 OR base_salary IS NULL) AS sem_base,
  COUNT(*) AS total
FROM public.employees
WHERE ativo = true;
