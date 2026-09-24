-- Regras que os dados de 9 meses já provaram, para a fila não começar cheia.
--
-- Só regras de TEXTO, onde a descrição do banco É a categoria (D5). Regra de
-- documento não entra por seed: documento de fornecedor é dado do Rodrigo,
-- criado por ele na tela ao classificar a primeira vez (D1).
--
-- Ref: spec 2026-09-23, seção "Números do piloto".

do $$
declare
  v_escola uuid;
  v_cat uuid;
  v_par record;
begin
  for v_escola in select id from escolas loop
    for v_par in
      select * from (values
        ('DÉB.CONV.TRIBUTOS FEDERAIS', 'Impostos e tributos',   'fixa'),
        ('DÉBITO CONV. FGTS',          'Impostos e tributos',   'fixa'),
        ('DÉB. CONV. SEGUROS',         'Seguros',               'fixa'),
        ('DÉB.CONV.TELECOMUNICAÇÕES',  'Telecomunicações',      'fixa'),
        ('DÉB.CONV.SANEAMENTO',        'Água e saneamento',     'fixa'),
        ('DÉBITO PACOTE SERVIÇOS',     'Tarifas bancárias',     'fixa'),
        ('TARIFA CHEQUE DEVOLVIDO',    'Tarifas bancárias',     'variavel')
      ) as t(padrao, categoria, classe)
    loop
      select id into v_cat from categorias_financeiras
      where escola_id = v_escola and nome = v_par.categoria and tipo = 'despesa';

      if v_cat is null then
        insert into categorias_financeiras (escola_id, nome, tipo)
        values (v_escola, v_par.categoria, 'despesa')
        returning id into v_cat;
      end if;

      -- Idempotente: não duplica a regra em reexecução.
      if not exists (
        select 1 from contraparte_regra
        where escola_id = v_escola and tipo_match = 'texto' and padrao_texto = v_par.padrao
      ) then
        insert into contraparte_regra
          (escola_id, tipo_match, padrao_texto, categoria_id, classe_despesa)
        values (v_escola, 'texto', v_par.padrao, v_cat, v_par.classe);
      end if;
    end loop;
  end loop;
end $$;
