"""O Python ensina o mesmo que o lab mostra.

``dados/referencia_openlabs.json`` é o que o código dos labs do OpenLabs calcula
(exportado de ``packages/algo-domain``). Cada teste daqui refaz a conta em
Python e confere número por número.
"""

from __future__ import annotations

import json
import math
import unittest
from pathlib import Path

from handbook import AULAS, aula
from handbook import caminho as ca
from handbook import crescimento as cr
from handbook import mochila as mo
from handbook import troco as tr
from handbook.semente import gerador

REF = json.loads((Path(__file__).resolve().parent.parent / "dados" / "referencia_openlabs.json").read_text(encoding="utf-8"))


class CrescimentoIgualAoLab(unittest.TestCase):
    def test_o_gerador_sorteia_o_mesmo_vetor_do_lab(self) -> None:
        self.assertEqual(cr.entrada_do_lab(20), REF["crescimento"]["vetor"])

    def test_a_forca_bruta_conta_os_mesmos_subconjuntos_que_o_lab(self) -> None:
        contas = [cr.forca_bruta(cr.entrada_do_lab(n), 1).trabalho for n in range(1, 21)]
        self.assertEqual(contas, REF["crescimento"]["operacoes"])
        self.assertEqual(contas[-1], 2 ** 20)

    def test_memoizacao_e_tabela_concordam_com_a_forca_bruta(self) -> None:
        v = cr.entrada_do_lab(10)
        for alvo in (1, 2, 64, 66, 168, 300, sum(v), sum(v) + 1):
            esperado = cr.forca_bruta(v, alvo).achou
            me = cr.memoizada(v, alvo)
            tb, _ = cr.tabela(v, alvo)
            self.assertEqual(me.achou, esperado, alvo)
            self.assertEqual(tb.achou, esperado, alvo)
            if esperado:
                self.assertEqual(sum(me.itens), alvo)
                self.assertEqual(sum(tb.itens), alvo)

    def test_a_tabela_custa_n_vezes_alvo_mais_um(self) -> None:
        v = cr.entrada_do_lab(8)
        self.assertEqual(cr.tabela(v, 100)[0].trabalho, 8 * 101)

    def test_o_gerador_e_deterministico(self) -> None:
        a, b = gerador(7), gerador(7)
        self.assertEqual([a() for _ in range(5)], [b() for _ in range(5)])


class TrocoIgualAoLab(unittest.TestCase):
    def test_guloso_tabela_e_contraexemplo_de_cada_sistema(self) -> None:
        for r in REF["troco"]:
            s = tr.sistema(r["id"])
            with self.subTest(sistema=s.id):
                self.assertEqual(list(s.moedas), r["moedas"])
                self.assertEqual(s.valor, r["valor"])
                g = tr.guloso(s.moedas, s.valor)
                self.assertEqual(g.moedas, r["guloso"]["moedas"])
                self.assertEqual(g.passos, r["guloso"]["passos"])
                self.assertEqual(g.sobra, r["guloso"]["sobra"])
                o = tr.otimo(s.moedas, s.valor)
                self.assertEqual(o.moedas, r["otimo"]["moedas"])
                self.assertEqual(o.passos, r["otimo"]["passos"])
                self.assertEqual(tr.menor_contraexemplo(s.moedas), r["menor_contraexemplo"])

    def test_o_caso_classico_do_guloso_que_erra(self) -> None:
        self.assertEqual(tr.guloso((1, 3, 4), 6).moedas, [4, 1, 1])
        self.assertEqual(tr.otimo((1, 3, 4), 6).moedas, [3, 3])

    def test_memoizado_e_sem_memoria_dao_o_mesmo_que_a_tabela(self) -> None:
        for moedas in ((1, 3, 4), (1, 5, 10, 25), (5, 7)):
            for v in range(1, 31):
                t = tr.tabela(moedas, v).minimo[v]
                self.assertEqual(tr.memoizado(moedas, v)[0], t)
                self.assertEqual(tr.sem_memoria(moedas, v)[0], t)

    def test_a_memoria_resolve_cada_valor_uma_vez(self) -> None:
        _, resolvidos = tr.memoizado((1, 3, 4), 30)
        _, chamadas = tr.sem_memoria((1, 3, 4), 30)
        self.assertEqual(resolvidos, 31)
        self.assertGreater(chamadas, 1000 * resolvidos)

    def test_sem_moeda_de_um_alguns_valores_nao_fecham(self) -> None:
        self.assertIsNone(tr.otimo((5, 7), 11).moedas)
        self.assertTrue(math.isinf(tr.tabela((5, 7), 11).minimo[11]))

    def test_valor_fora_do_lab_e_recusado(self) -> None:
        with self.assertRaises(ValueError):
            tr.guloso((1, 5), 0)
        with self.assertRaises(ValueError):
            tr.tabela((1, 5), 501)


class MochilaIgualAoLab(unittest.TestCase):
    def test_cada_cenario_do_lab(self) -> None:
        for r in REF["mochila"]:
            c = mo.cenario(r["id"])
            itens = mo.itens_do_cenario(c)
            with self.subTest(cenario=c.id):
                self.assertEqual([i.id for i in itens], r["itens"])
                t = mo.tabulada(itens, c.sessao)
                self.assertEqual(t.T, r["tabela"])
                self.assertEqual(t.pontos, r["pontos"])
                self.assertEqual(t.minutos, r["minutos"])
                self.assertEqual([itens[k].id for k in t.escolhidos], r["escolhidos"])
                self.assertEqual(t.celulas, r["celulas"])
                esc, pts, mins = mo.gulosa(itens, c.sessao)
                self.assertEqual((pts, mins), (r["gulosa"]["pontos"], r["gulosa"]["minutos"]))
                self.assertEqual([itens[k].id for k in esc], r["gulosa"]["escolhidos"])
                self.assertEqual(mo.sem_memoria(itens, c.sessao), (r["pontos"], r["chamadas_sem_memoria"]))
                self.assertEqual(mo.memoizada(itens, c.sessao), (r["pontos"], r["chamadas_com_memoria"]))
                self.assertEqual(mo.forca_bruta(itens, c.sessao), r["forca_bruta"])
                self.assertEqual(mo.por_que(itens, t.T, len(itens), c.sessao // mo.PASSO), r["por_que_ultima_celula"])

    def test_rafa_a_tabela_faz_14_e_a_gulosa_13(self) -> None:
        itens = mo.itens_do_cenario(mo.cenario("rafa"))
        self.assertEqual(mo.tabulada(itens, 90).pontos, 14)
        self.assertEqual(mo.gulosa(itens, 90)[1], 13)

    def test_a_tabela_concorda_com_a_forca_bruta_em_varias_sessoes(self) -> None:
        itens = list(mo.CATALOGO[:9])
        for sessao in range(0, 181, 15):
            self.assertEqual(mo.tabulada(itens, sessao).pontos, mo.forca_bruta(itens, sessao), sessao)

    def test_o_plano_cabe_na_sessao(self) -> None:
        itens = list(mo.CATALOGO)
        t = mo.tabulada(itens, 120)
        self.assertLessEqual(sum(itens[k].minutos for k in t.escolhidos), 120)
        self.assertEqual(sum(itens[k].pontos for k in t.escolhidos), t.pontos)

    def test_sessao_invalida_e_recusada(self) -> None:
        with self.assertRaises(ValueError):
            mo.tabulada(list(mo.CATALOGO[:3]), 92)


class CaminhoIgualAoLab(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.cidade = ca.carregar_cidade()

    def test_cada_cenario_do_lab(self) -> None:
        for r in REF["caminho"]:
            with self.subTest(cenario=r["id"]):
                nos = [self.cidade.lugares[p][1] for p in r["paradas"]]
                self.assertEqual(nos, r["nos"])
                T = ca.tempos_entre(self.cidade, nos)
                self.assertEqual(T, r["tempos_ds"])
                o = ca.melhor_ordem(T)
                self.assertEqual([nos[i] for i in o.ordem], r["melhor_ordem"])
                self.assertEqual(o.tempo, r["tempo_total_ds"])

    def test_a_pd_da_ordem_concorda_com_a_forca_bruta(self) -> None:
        nos = [self.cidade.lugares[p][1] for p in ("masp", "copan", "mercadao", "liberdade", "bixiga")]
        T = ca.tempos_entre(self.cidade, nos)
        o = ca.melhor_ordem(T)
        bruta, tempo, tentadas = ca.forca_bruta_da_ordem(T)
        self.assertEqual((o.ordem, o.tempo), (bruta, tempo))
        self.assertEqual(tentadas, 24)

    def test_a_rota_soma_os_pesos_e_liga_origem_ao_destino(self) -> None:
        a, b = self.cidade.lugares["masp"][1], self.cidade.lugares["mercadao"][1]
        r = ca.dijkstra(self.cidade, a, b)
        self.assertEqual(self.cidade.de[r.arestas[0]], a)
        self.assertEqual(self.cidade.para[r.arestas[-1]], b)
        for e1, e2 in zip(r.arestas, r.arestas[1:]):
            self.assertEqual(self.cidade.para[e1], self.cidade.de[e2])
        self.assertEqual(r.tempo, sum(self.cidade.peso[e] for e in r.arestas))

    def test_o_dijkstra_fecha_em_ordem_crescente_de_distancia(self) -> None:
        a, b = self.cidade.lugares["bixiga"][1], self.cidade.lugares["mosteiro-de-sao-bento"][1]
        distancias = [d for _, d in ca.dijkstra(self.cidade, a, b).fechados]
        self.assertEqual(distancias, sorted(distancias))


class Catalogo(unittest.TestCase):
    def test_cada_aula_aponta_para_um_lab_do_handbook(self) -> None:
        self.assertEqual([a.lab for a in AULAS], ["how-work-grows", "shortest-path", "greedy-change", "knapsack-session"])
        self.assertTrue(aula("mochila").url().endswith("/labs/knapsack-session/"))
        self.assertTrue(aula("mochila").url(local=True).startswith("http://localhost:8000/"))


if __name__ == "__main__":
    unittest.main()
