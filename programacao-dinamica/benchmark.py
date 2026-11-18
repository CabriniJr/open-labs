"""Eficiência, contada e cronometrada.

    python benchmark.py

Para cada técnica, a versão sem memória contra a versão com memória, em entradas
que crescem. A **contagem** (chamadas, células, subconjuntos) é exata e igual em
qualquer máquina. O **tempo** é a mediana de algumas rodadas nesta máquina: muda
de computador para computador, e a proporção entre as colunas é o que importa.
A saída é Markdown, para colar no README.
"""

from __future__ import annotations

import random
import sys

from planejador.agenda import Agenda, Pedido
from planejador.mapa import carregar_mapa, dijkstra_multifonte, dijkstra_um_par
from planejador.medidor import Contador, cronometra
from planejador.sessao import mochila_forca_bruta, mochila_memoizada, mochila_tabulada
from planejador.telecentro import carregar_telecentros
from planejador.trilha import Lab, Trilha

#: Acima disto a recursão ingênua levaria minutos: a linha mostra só a contagem estimada.
LIMITE_INGENUA = 27
LIMITE_BRUTA = 18


def num(n: float) -> str:
    return f"{n:,.0f}".replace(",", ".")


def ms(t: float) -> str:
    return f"{t:.2f} ms" if t < 100 else f"{t / 1000:.1f} s"


def agenda_encadeada(n: int) -> Agenda:
    """Cada pedido se sobrepõe ao vizinho: o pior caso da recursão ingênua (Fibonacci)."""
    return Agenda([Pedido(f"p{i}", "x", 10 * i, 10 * i + 15, 1 + i % 5) for i in range(n)])


def bench_agenda() -> None:
    print("### Agenda — intervalos ponderados (memoização × tabulação)\n")
    print("| pedidos | ingênua: chamadas | ingênua: tempo | memoizada: chamadas | memoizada: tempo | tabulada: células | tabulada: tempo |")
    print("|---:|---:|---:|---:|---:|---:|---:|")
    for n in (10, 15, 20, 25, 30, 1000, 5000):
        a = agenda_encadeada(n)
        if n <= LIMITE_INGENUA:
            c = Contador()
            a.ingenua(c)
            _, t_ing = cronometra(a.ingenua, 3)
            ing = (num(c["chamadas"]), ms(t_ing))
        else:
            ing = ("—", "—")
        m = Contador()
        a.memoizada(m)
        _, t_mem = cronometra(a.memoizada)
        _, t_tab = cronometra(a.tabulada)
        print(f"| {num(n)} | {ing[0]} | {ing[1]} | {num(m['chamadas'])} | {ms(t_mem)} | {num(n)} | {ms(t_tab)} |")
    print("\nSem memória as chamadas crescem como Fibonacci (×1,6 a cada pedido); com memória, 2n + 1.\n")


def bench_mochila() -> None:
    print("### Sessão — mochila 0/1 (tabulação × força bruta), sessão de 90 min\n")
    print("| labs | força bruta: subconjuntos | força bruta: tempo | tabela: células | tabela: tempo | memoizada: chamadas |")
    print("|---:|---:|---:|---:|---:|---:|")
    r = random.Random(42)
    for n in (8, 12, 16, 18, 40, 200):
        labs = [Lab(f"l{i}", "", "", r.randrange(10, 40), r.randrange(1, 6), ()) for i in range(n)]
        if n <= LIMITE_BRUTA:
            b = Contador()
            mochila_forca_bruta(labs, 90, b)
            _, t_b = cronometra(lambda: mochila_forca_bruta(labs, 90), 1)
            bruta = (num(b["subconjuntos"]), ms(t_b))
        else:
            bruta = (num(2**n) if n < 64 else f"2^{n}", "—")
        t = Contador()
        mochila_tabulada(labs, 90, t)
        _, t_t = cronometra(lambda: mochila_tabulada(labs, 90))
        m = Contador()
        mochila_memoizada(labs, 90, m)
        print(f"| {n} | {bruta[0]} | {bruta[1]} | {num(t['celulas'])} | {ms(t_t)} | {num(m['chamadas'])} |")
    print("\nA força bruta dobra a cada lab; a tabela cresce em linha reta: n × (tempo + 1).\n")


def bench_trilha() -> None:
    print("### Trilha — pré-requisitos com caminhos que se repetem (grafo + memoização)\n")
    print("| diamantes | caminhos até o último | sem memória: chamadas | com memória: chamadas |")
    print("|---:|---:|---:|---:|")
    for k in (4, 8, 12, 16):
        labs = [Lab("d0", "", "", 10, 1, ())]
        for i in range(1, k + 1):
            labs += [
                Lab(f"a{i}", "", "", 10, 1, (f"d{i-1}",)),
                Lab(f"b{i}", "", "", 10, 1, (f"d{i-1}",)),
                Lab(f"d{i}", "", "", 10, 1, (f"a{i}", f"b{i}")),
            ]
        t = Trilha(labs)
        sem, com = Contador(), Contador()
        t.antes_sem_memoria(f"d{k}", sem)
        t.antes(f"d{k}", com)
        print(f"| {k} | {num(2**k)} | {num(sem['chamadas'])} | {num(com['chamadas'])} |")
    print()


def bench_mapa() -> None:
    print("### Mapa — telecentro mais perto de todos os cruzamentos (grafos)\n")
    mapa = carregar_mapa()
    telecentros, _ = carregar_telecentros(mapa)
    fontes = [t.no for t in telecentros]
    multi = Contador()
    _, t_multi = cronometra(lambda: dijkstra_multifonte(mapa, fontes, multi), 1)
    amostra = random.Random(1).sample(range(mapa.n), 50)
    pares = Contador()

    def todos_os_pares() -> None:
        for v in amostra:
            for f in fontes:
                dijkstra_um_par(mapa, v, f, pares)

    _, t_pares = cronometra(todos_os_pares, 1)
    por_cruzamento = pares["resolvidos"] / len(amostra)
    print("| estratégia | cruzamentos resolvidos | tempo |")
    print("|---|---:|---:|")
    print(f"| uma busca de um par por telecentro, para os {num(mapa.n)} cruzamentos (estimado de 50) | {num(por_cruzamento * mapa.n)} | {ms(t_pares / len(amostra) * mapa.n)} |")
    print(f"| uma busca multi-fonte (todos os telecentros com distância 0) | {num(multi['resolvidos'])} | {ms(t_multi)} |")
    print()


def principal() -> int:
    print(f"_Python {sys.version.split()[0]} · {sys.platform}_\n")
    bench_agenda()
    bench_mochila()
    bench_trilha()
    bench_mapa()
    return 0


if __name__ == "__main__":
    sys.exit(principal())
