"""Derivacao do ano letivo a partir da data de matricula do sistema antigo.

A ficha do sistema antigo nao guarda o ano letivo, so a data em que a matricula
foi assinada. Assinatura de out-dez e rematricula PARA o ano seguinte; de
jan-set e matricula do proprio ano (aluno novo ou entrada no meio do periodo).

Usar o ano da data direto joga todo o historico um ano para tras e faz a mesma
serie aparecer duas vezes na ficha do aluno. Foi o que aconteceu na importacao
original: 1431 matriculas ficaram com o ano errado e 359 linhas duplicadas
precisaram ser removidas.

Mantido em um modulo unico porque tres importadores leem o mesmo PDF:
fix_matriculas.py, import_pdf_alunos.py e import_novos_alunos_2026.py.
"""

import re

# A partir deste mes, a assinatura e rematricula para o ano seguinte.
MES_INICIO_REMATRICULA = 10

_DATA_BR = re.compile(r"^(\d{1,2})/(\d{1,2})/(\d{4})$")


def ano_letivo_da_data(data_br):
    """Recebe uma data dd/mm/aaaa e devolve o ano letivo correspondente.

    >>> ano_letivo_da_data("26/11/2025")  # rematricula para o ano seguinte
    2026
    >>> ano_letivo_da_data("29/07/2021")  # matricula do proprio ano
    2021

    Levanta ValueError em data invalida: e melhor falhar alto do que gravar um
    ano letivo silenciosamente errado.
    """
    m = _DATA_BR.match(str(data_br).strip())
    if not m:
        raise ValueError(f"data invalida: {data_br!r}")
    mes, ano = int(m.group(2)), int(m.group(3))
    return ano + 1 if mes >= MES_INICIO_REMATRICULA else ano
