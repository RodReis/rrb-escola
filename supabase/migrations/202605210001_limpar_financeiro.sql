-- Limpa dados financeiros mantendo estrutura, planos e matrículas intactos.
-- Ordem: pagamentos antes de cobrancas (FK constraint).

delete from pagamentos
where escola_id = '00000000-0000-0000-0000-000000000001';

delete from cobrancas
where escola_id = '00000000-0000-0000-0000-000000000001';
