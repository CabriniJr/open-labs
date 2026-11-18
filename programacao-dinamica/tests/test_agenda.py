import random
import unittest
from itertools import combinations

from planejador.agenda import Agenda, Pedido, carregar_agenda, minutos
from planejador.medidor import Contador


def sorteia(semente: int, n: int) -> Agenda:
    r = random.Random(semente)
    pedidos = []
    for i in range(n):
        ini = r.randrange(8 * 60, 19 * 60)
        pedidos.append(Pedido(f"p{i}", "x", ini, ini + r.randrange(10, 120), r.randrange(0, 6)))
    return Agenda(pedidos)


def compativel(grupo) -> bool:
    ordem = sorted(grupo, key=lambda p: p.inicio)
    return all(a.fim <= b.inicio for a, b in zip(ordem, ordem[1:]))


def forca_bruta(agenda: Agenda) -> int:
    return max(
        sum(p.peso for p in g)
        for k in range(agenda.n + 1)
        for g in combinations(agenda.pedidos, k)
        if compativel(g)
    )


class TestAgenda(unittest.TestCase):
    def test_as_tres_versoes_concordam_com_a_forca_bruta(self):
        for semente in range(40):
            agenda = sorteia(semente, 11)
            esperado = forca_bruta(agenda)
            total, _, escolhidos = agenda.tabulada()
            self.assertEqual(agenda.ingenua(), esperado, semente)
            self.assertEqual(agenda.memoizada(), esperado, semente)
            self.assertEqual(total, esperado, semente)
            # a reconstrução é uma escolha válida que soma o ótimo
            self.assertTrue(compativel(escolhidos))
            self.assertEqual(sum(p.peso for p in escolhidos), total)

    def test_memoria_resolve_cada_pedido_uma_vez(self):
        agenda = sorteia(7, 300)
        c = Contador()
        agenda.memoizada(c)
        # n subproblemas novos, cada um abre no máximo duas chamadas
        self.assertLessEqual(c["chamadas"], 2 * agenda.n + 1)

    def test_a_recursao_ingenua_explode(self):
        # Pedidos encadeados que se sobrepõem um pouco: p(j) = j - 2, e as chamadas
        # seguem Fibonacci.
        pedidos = [Pedido(f"p{i}", "x", 10 * i, 10 * i + 15, 1) for i in range(25)]
        agenda = Agenda(pedidos)
        ing, mem = Contador(), Contador()
        self.assertEqual(agenda.ingenua(ing), agenda.memoizada(mem))
        self.assertGreater(ing["chamadas"], 100_000)
        self.assertLess(mem["chamadas"], 60)

    def test_a_regra_gulosa_conta_pedidos_mas_perde_prioridade(self):
        agenda = carregar_agenda()
        gulosa = agenda.gulosa()
        total, _, escolhidos = agenda.tabulada()
        self.assertTrue(compativel(gulosa))
        self.assertGreaterEqual(len(gulosa), len(escolhidos))  # a gulosa maximiza a quantidade
        self.assertLess(sum(p.peso for p in gulosa), total)  # e perde na prioridade

    def test_o_dia_de_exemplo(self):
        total, M, escolhidos = carregar_agenda().tabulada()
        self.assertEqual(total, 34)
        self.assertEqual(M[0], 0)
        self.assertEqual(M, sorted(M))  # M nunca desce: mais pedidos, nunca pior
        self.assertIn("Wanda", [p.quem for p in escolhidos])

    def test_recusa_o_que_nao_e_um_pedido(self):
        with self.assertRaises(ValueError):
            Agenda([Pedido("x", "x", 600, 600, 1)])
        with self.assertRaises(ValueError):
            Agenda([Pedido("x", "x", 600, 660, -1)])
        for texto in ("9h30", "25:00", "10:75", ""):
            with self.assertRaises(ValueError, msg=texto):
                minutos(texto)
        self.assertEqual(minutos("09:30"), 570)

    def test_dia_vazio(self):
        agenda = Agenda([])
        self.assertEqual(agenda.ingenua(), 0)
        self.assertEqual(agenda.tabulada()[0], 0)


if __name__ == "__main__":
    unittest.main()
