import unittest

from planejador.medidor import Contador
from planejador.trilha import Lab, Trilha, carregar_trilha


def lab(slug: str, *requer: str, minutos: int = 10) -> Lab:
    return Lab(slug, slug, "teste", minutos, 1, tuple(requer))


def diamantes(k: int) -> Trilha:
    """d0 <- (a1, b1) <- d1 <- (a2, b2) <- d2 ...: 2^k caminhos até o último."""
    labs = [lab("d0")]
    for i in range(1, k + 1):
        labs += [lab(f"a{i}", f"d{i-1}"), lab(f"b{i}", f"d{i-1}"), lab(f"d{i}", f"a{i}", f"b{i}")]
    return Trilha(labs)


class TestTrilha(unittest.TestCase):
    def test_o_catalogo_e_um_dag_e_a_ordem_respeita_os_requisitos(self):
        trilha = carregar_trilha()
        posicao = {s: i for i, s in enumerate(trilha.ordem)}
        for s, l in trilha.labs.items():
            for r in l.requer:
                self.assertLess(posicao[r], posicao[s], f"{r} deveria vir antes de {s}")

    def test_antes_inclui_os_indiretos(self):
        trilha = carregar_trilha()
        self.assertEqual(
            trilha.antes("normalize-a-spreadsheet"), {"telecentro-database", "join-by-hand"}
        )
        self.assertEqual(trilha.minutos_para_liberar("normalize-a-spreadsheet", {"telecentro-database"}), 20)

    def test_memoizado_e_tabulado_concordam(self):
        trilha = carregar_trilha()
        tabela = trilha.critico_tabulado()
        for s in trilha.labs:
            minutos, cadeia = trilha.critico(s)
            self.assertEqual(minutos, tabela[s], s)
            self.assertEqual(cadeia[-1], s)
            self.assertEqual(sum(trilha.labs[c].minutos for c in cadeia), minutos)

    def test_sem_memoria_o_trabalho_dobra_a_cada_diamante(self):
        trilha = diamantes(14)
        sem, com = Contador(), Contador()
        self.assertEqual(trilha.antes_sem_memoria("d14", sem), trilha.antes("d14", com))
        self.assertGreater(sem["chamadas"], 2**14)
        self.assertLess(com["chamadas"], 3 * len(trilha.labs))

    def test_liberados(self):
        trilha = carregar_trilha()
        hoje = {l.slug for l in trilha.liberados({"telecentro-database"})}
        self.assertIn("join-by-hand", hoje)
        self.assertNotIn("normalize-a-spreadsheet", hoje)
        self.assertNotIn("telecentro-database", hoje)

    def test_recusa_catalogo_quebrado(self):
        with self.assertRaisesRegex(ValueError, "ciclo"):
            Trilha([lab("a", "b"), lab("b", "a")])
        with self.assertRaisesRegex(ValueError, "não está no catálogo"):
            Trilha([lab("a", "fantasma")])
        with self.assertRaisesRegex(ValueError, "repetido"):
            Trilha([lab("a"), lab("a")])
        with self.assertRaises(ValueError):
            Trilha([lab("a", minutos=0)])
        with self.assertRaises(KeyError):
            carregar_trilha().antes("nao-existe")


if __name__ == "__main__":
    unittest.main()
