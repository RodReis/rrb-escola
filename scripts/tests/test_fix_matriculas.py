"""Testes da derivacao de ano letivo compartilhada pelos importadores de PDF.

Uso: python scripts/tests/test_fix_matriculas.py
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from fix_matriculas import parse_date
from lib.ano_letivo import ano_letivo_da_data


class TestAnoLetivoDaData(unittest.TestCase):
    def test_rematricula_de_novembro_vale_para_o_ano_seguinte(self):
        # Caso real: Amanda (matricula 1168) assinou em 26/11/2025 o 3o ANO
        # que iria cursar em 2026. Gravar como 2025 duplicava a serie na ficha.
        self.assertEqual(ano_letivo_da_data("26/11/2025"), 2026)

    def test_matricula_de_meio_de_ano_vale_para_o_proprio_ano(self):
        # Aluno novo entrando em julho cursa aquele mesmo ano.
        self.assertEqual(ano_letivo_da_data("29/07/2021"), 2021)

    def test_outubro_ja_conta_como_rematricula(self):
        self.assertEqual(ano_letivo_da_data("01/10/2024"), 2025)

    def test_setembro_ainda_e_do_proprio_ano(self):
        self.assertEqual(ano_letivo_da_data("30/09/2024"), 2024)

    def test_dezembro_vira_o_ano_seguinte(self):
        self.assertEqual(ano_letivo_da_data("15/12/2023"), 2024)

    def test_janeiro_e_do_proprio_ano(self):
        self.assertEqual(ano_letivo_da_data("11/01/2022"), 2022)

    def test_data_invalida_falha_alto(self):
        # Melhor estourar do que gravar um ano letivo silenciosamente errado.
        with self.assertRaises(ValueError):
            ano_letivo_da_data("2025-11-26")

    def test_trajetoria_da_amanda_sem_serie_repetida(self):
        # As datas da ficha original, na ordem em que aparecem no PDF.
        datas = [
            "29/07/2021",  # MATERNAL
            "10/11/2021",  # INFANTIL2
            "21/11/2022",  # INFANTIL3
            "15/12/2023",  # 1o ANO
            "18/11/2024",  # 2o ANO
            "26/11/2025",  # 3o ANO
        ]
        anos = [ano_letivo_da_data(d) for d in datas]
        self.assertEqual(anos, [2021, 2022, 2023, 2024, 2025, 2026])
        # Um ano letivo por etapa, sem repetir.
        self.assertEqual(len(set(anos)), len(anos))


class TestParseDate(unittest.TestCase):
    def test_converte_para_iso(self):
        self.assertEqual(parse_date("26/11/2025"), "2025-11-26")

    def test_completa_com_zero_a_esquerda(self):
        self.assertEqual(parse_date("1/7/2021"), "2021-07-01")

    def test_devolve_none_para_entrada_invalida(self):
        self.assertIsNone(parse_date("sem data"))
        self.assertIsNone(parse_date(None))


if __name__ == "__main__":
    unittest.main(verbosity=2)
