import math
import random
import unittest

from planejador.mapa import (
    caminho_ate_telecentro,
    carregar_mapa,
    dijkstra_multifonte,
    dijkstra_um_par,
    minutos_a_pe,
)
from planejador.medidor import Contador
from planejador.telecentro import carregar_telecentros

MAPA = carregar_mapa()
TELECENTROS, ALUNOS = carregar_telecentros(MAPA)
FONTES = [t.no for t in TELECENTROS]


class TestMapa(unittest.TestCase):
    def test_o_mapa_real(self):
        self.assertEqual(MAPA.n, 1964)
        self.assertGreater(MAPA.arestas(), 2500)
        self.assertIn("OpenStreetMap", MAPA.credito)
        # a pé o grafo é não dirigido: toda aresta tem a volta, com o mesmo comprimento
        for v in range(0, MAPA.n, 37):
            for u, m, _ in MAPA.vizinhos[v]:
                self.assertIn(m, [mm for w, mm, _ in MAPA.vizinhos[u] if w == v])

    def test_multifonte_e_o_minimo_das_buscas_de_um_par(self):
        cobertura = dijkstra_multifonte(MAPA, FONTES)
        r = random.Random(3)
        for v in r.sample(range(MAPA.n), 25):
            esperado = min(dijkstra_um_par(MAPA, v, f) for f in FONTES)
            self.assertAlmostEqual(cobertura.distancia[v], esperado, places=6)
            if not math.isinf(esperado):
                self.assertAlmostEqual(dijkstra_um_par(MAPA, v, FONTES[cobertura.dono[v]]), esperado, places=6)

    def test_a_rota_reconstruida_mede_a_distancia(self):
        cobertura = dijkstra_multifonte(MAPA, FONTES)
        for aluno in ALUNOS:
            rota = caminho_ate_telecentro(cobertura, aluno.no)
            self.assertEqual(rota[0], aluno.no)
            self.assertIn(rota[-1], FONTES)
            metros = sum(
                min(m for u, m, _ in MAPA.vizinhos[a] if u == b) for a, b in zip(rota, rota[1:])
            )
            self.assertAlmostEqual(metros, cobertura.distancia[aluno.no], places=6)

    def test_cada_cruzamento_e_resolvido_uma_vez(self):
        c = Contador()
        cobertura = dijkstra_multifonte(MAPA, FONTES, c)
        alcancados = sum(1 for d in cobertura.distancia if not math.isinf(d))
        self.assertEqual(c["resolvidos"], alcancados)
        self.assertEqual(c["relaxacoes"], sum(len(MAPA.vizinhos[v]) for v in range(MAPA.n) if not math.isinf(cobertura.distancia[v])))

    def test_recusas(self):
        with self.assertRaises(ValueError):
            dijkstra_multifonte(MAPA, [])
        with self.assertRaises(ValueError):
            dijkstra_multifonte(MAPA, [MAPA.n])
        with self.assertRaises(ValueError):
            minutos_a_pe(100, 0)
        self.assertAlmostEqual(minutos_a_pe(600, 1.0), 10)


if __name__ == "__main__":
    unittest.main()
