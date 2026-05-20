# Importacao de Alunos

Fluxo de importacao em lote para PDF e planilhas.

## Arquivos aceitos

- `.xlsx`
- `.xls`
- `.csv`
- `.pdf` com texto selecionavel

PDF escaneado como imagem ainda nao passa por OCR. Nesse caso, o arquivo fica registrado, mas pode nao gerar linhas de staging.

## Etapas

1. Enviar arquivo em `/importacoes`.
2. O arquivo original e salvo no bucket `importacoes`.
3. O parser extrai linhas e grava em `importacao_alunos_linhas`.
4. A tela `/importacoes/[id]` permite revisar e corrigir os dados.
5. Ao confirmar, apenas linhas com status `pronto` sao gravadas como aluno, endereco, contato, responsavel e matricula.

## Colunas recomendadas

- `matricula`
- `nome`
- `cpf`
- `rg`
- `data_nascimento`
- `sexo`
- `celular`
- `email`
- `endereco`
- `numero`
- `bairro`
- `cidade`
- `uf`
- `cep`
- `responsavel_nome`
- `responsavel_cpf`
- `responsavel_telefone`
- `responsavel_celular`
- `responsavel_parentesco`
- `responsavel_email`
- `serie`
- `turma`
- `plano`
- `ano_letivo`
- `data_matricula`
- `idade_na_matricula`

## Status de linha

- `pronto`: pode ser importada.
- `pendente`: falta corrigir algum dado, serie ou turma.
- `duplicado`: matricula ja existe.
- `erro`: falha de validacao ou gravacao.
- `importado`: aluno criado com sucesso.
