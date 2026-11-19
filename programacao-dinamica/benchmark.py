"""A eficiência de cada aula, contada e cronometrada.

    python benchmark.py

Para cada lab do handbook, a força bruta (ou a recursão sem memória) contra a
Programação Dinâmica, no mesmo problema: quanto trabalho cada uma faz e quanto
tempo leva neste computador. As contagens são exatas e não mudam de máquina; os
tempos mudam, e servem para ver a ordem de grandeza.
"""

from __future__ import annotations

import math
import sys
import time
from typing import Callable, TypeVar

from handbook import caminho as ca
from handbook import crescimento as cr
from handbook import mochila as mo
from handbook import troco as tr
from handbook.semente import gerador

T = TypeVar("T")


def cronometra(f: Callable[[], T], rodadas: int = 3) -> tuple[T, float]:
    melhor, r = math.inf, None
    for _ in range(rodadas):
        t0 = time.perf_counter()
        r = f()
        melhor = min(melhor, time.perf_counter() - t0)
    return r, melhor  # type: ignore[return-value]


def ms(s: float) -> str:
    return f"{s * 1000:.2f} ms" if s < 1 else f"{s:.2f} s"


def n_(x: float) -> str:
    return f"{x:,.0f}".replace(",", ".")


def crescimento() -> None:
    print("\n### Fase 3 — soma de subconjunto (alvo impossível: soma + 1)\n")
    print("| n | força bruta: subconjuntos | tempo | memoização: estados | tempo | tabela: células | tempo |")
    print("|---:|---:|---:|---:|---:|---:|---:|")
    for n in (8, 12, 16, 20):
        v = cr.entrada_do_lab(n)
        alvo = sum(v) + 1
        fb, tf = cronometra(lambda: cr.forca_bruta(v, alvo), 1)
        me, tm = cronometra(lambda: cr.memoizada(v, alvo))
        tb, tt = cronometra(lambda: cr.tabela(v, alvo)[0])
        print(f"| {n} | {n_(fb.trabalho)} | {ms(tf)} | {n_(me.trabalho)} | {ms(tm)} | {n_(tb.trabalho)} | {ms(tt)} |")


def troco() -> None:
    print("\n### Fase 7 — troco com moedas {1, 3, 4}\n")
    print("| valor | sem memória: chamadas | tempo | memoização: valores | tabela: passos | tempo |")
    print("|---:|---:|---:|---:|---:|---:|")
    for v in (10, 20, 25, 30):
        (_, ch), ts = cronometra(lambda: tr.sem_memoria((1, 3, 4), v), 1)
        _, res = tr.memoizado((1, 3, 4), v)
        t, tt = cronometra(lambda: tr.tabela((1, 3, 4), v))
        print(f"| {v} | {n_(ch)} | {ms(ts)} | {res} | {t.passos} | {ms(tt)} |")


def mochila() -> None:
    print("\n### Fase 8 — mochila da sessão, catálogo inteiro do lab\n")
    print("| labs | sessão | força bruta: subconjuntos | tempo | sem memória: chamadas | memoização: chamadas | tabela: células | tempo |")
    print("|---:|---:|---:|---:|---:|---:|---:|---:|")
    for k in (6, 9, 12):
        itens = list(mo.CATALOGO[:k])
        for sessao in (90, 180):
            _, tf = cronometra(lambda: mo.forca_bruta(itens, sessao), 1)
            _, sem = mo.sem_memoria(itens, sessao)
            _, com = mo.memoizada(itens, sessao)
            t, tt = cronometra(lambda: mo.tabulada(itens, sessao))
            print(f"| {k} | {sessao} min | {n_(2 ** k)} | {ms(tf)} | {n_(sem)} | {n_(com)} | {n_(t.celulas)} | {ms(tt)} |")


def caminho() -> None:
    print("\n### Fase 6 — caminhos nas ruas de São Paulo\n")
    c = ca.carregar_cidade()
    pares = [(a, b) for a in c.lugares for b in c.lugares if a != b]
    def todos() -> int:
        return sum(ca.dijkstra(c, c.lugares[a][1], c.lugares[b][1]).resolvidos for a, b in pares)
    resolvidos, t = cronometra(todos, 1)
    print(f"Dijkstra entre os {len(c.lugares)} lugares do lab ({len(pares)} pares): {n_(resolvidos)} cruzamentos resolvidos ao todo, {ms(t)}.\n")
    print("Melhor ordem de k paradas (tempos sorteados, semente 7):\n")
    print("| paradas | força bruta: ordens | tempo | PD (Held–Karp): estados | tempo |")
    print("|---:|---:|---:|---:|---:|")
    r = gerador(7)
    for k in (4, 6, 8, 10):
        T = [[0.0 if i == j else float(int(r() * 1000) + 1) for j in range(k)] for i in range(k)]
        (_, _, tentadas), tf = cronometra(lambda: ca.forca_bruta_da_ordem(T), 1)
        o, tp = cronometra(lambda: ca.melhor_ordem(T), 1)
        print(f"| {k} | {n_(tentadas)} | {ms(tf)} | {n_(o.estados)} | {ms(tp)} |")


def principal() -> int:
    print("## Eficiência — o handbook de algoritmos do OpenLabs, em Python")
    crescimento()
    caminho()
    troco()
    mochila()
    print("\nAs contagens são exatas; os tempos são deste computador (o melhor de 3 rodadas, ou 1 para a força bruta).")
    return 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.exit(principal())
