import random
import unittest

from planejador.medidor import Contador
from planejador.sessao import mochila_forca_bruta, mochila_gulosa, mochila_memoizada, mochila_tabulada
from planejador.trilha import Lab


def lab(slug: str, minutos: int, pontos: int) -> Lab:
    return Lab(slug, slug, "teste", minutos, pontos, ())


def sorteia(semente: int, n: int) -> list[Lab]:
    r = random.Random(semente)
    return [lab(f"l{i}", r.randrange(5, 50), r.randrange(0, 8)) for i in range(n)]


class TestSessao(unittest.TestCase):
    def test_tabela_memoria_e_forca_bruta_concordam(self):
        for semente in range(60):
            labs = sorteia(semente, 10)
            tempo = random.Random(semente).randrange(0, 150)
            plano = mochila_tabulada(labs, tempo)
            self.assertEqual(plano.pontos, mochila_forca_bruta(labs, tempo), semente)
            self.assertEqual(plano.pontos, mochila_memoizada(labs, tempo), semente)
            # a reconstrução cabe no tempo e soma o ótimo
            self.assertLessEqual(plano.minutos, tempo)
            self.assertEqual(sum(l.pontos for l in plano.labs), plano.pontos)

    def test_o_custo_contado(self):
        labs = sorteia(1, 12)
        tab, bruta = Contador(), Contador()
        mochila_tabulada(labs, 90, tab)
        mochila_forca_bruta(labs, 90, bruta)
        self.assertEqual(tab["celulas"], 12 * 91)  # n × (tempo + 1)
        self.assertEqual(bruta["subconjuntos"], 2**12)

    def test_a_regra_gulosa_erra(self):
        # Denso primeiro pega o de 10 min e não sobra lugar para os dois de 25.
        labs = [lab("denso", 10, 3), lab("a", 25, 5), lab("b", 25, 5)]
        gulosa, _ = mochila_gulosa(labs, 50)
        plano = mochila_tabulada(labs, 50)
        self.assertEqual(plano.pontos, 10)
        self.assertEqual(gulosa, 8)

    def test_bordas(self):
        self.assertEqual(mochila_tabulada([], 60).pontos, 0)
        self.assertEqual(mochila_tabulada([lab("x", 30, 5)], 0).pontos, 0)
        self.assertEqual(mochila_tabulada([lab("x", 30, 5)], 30).labs[0].slug, "x")
        with self.assertRaises(ValueError):
            mochila_tabulada([], -1)
        with self.assertRaises(ValueError):
            mochila_tabulada([lab("x", 30, 5), lab("x", 30, 5)], 60)


if __name__ == "__main__":
    unittest.main()
