"""Tabulação — quais labs cabem nos minutos da sessão.

A pessoa chega ao telecentro com um tempo de computador (45, 60, 90 minutos).
Entre os labs já liberados, quais fazer para aprender o máximo (soma de
``pontos``, os objetivos de aprendizagem) sem estourar o tempo? É a mochila 0/1:
cada lab entra inteiro ou não entra.

``T[i][t]`` = o máximo de pontos usando só os ``i`` primeiros labs e ``t`` minutos::

    T[0][t] = 0
    T[i][t] = T[i-1][t]                                     se minutos(i) > t
    T[i][t] = max( T[i-1][t],                               # deixa o lab i
                   pontos(i) + T[i-1][t - minutos(i)] )     # faz o lab i

A tabela tem (n + 1) × (tempo + 1) células e cada uma custa O(1): O(n · tempo).
Tentar todo subconjunto custa O(2ⁿ) — com os 17 labs do catálogo são 131 072
combinações, e cada lab novo dobra a conta.

A reconstrução anda da última linha para a primeira: se ``T[i][t]`` mudou em
relação a ``T[i-1][t]``, o lab ``i`` foi escolhido e sobram ``t - minutos(i)``.
"""

from __future__ import annotations

from dataclasses import dataclass
from itertools import combinations
from typing import Sequence

from .medidor import Contador
from .trilha import Lab


@dataclass(frozen=True)
class Plano:
    pontos: int
    minutos: int
    labs: tuple[Lab, ...]
    tabela: tuple[tuple[int, ...], ...]


def _valida(labs: Sequence[Lab], tempo: int) -> None:
    if tempo < 0:
        raise ValueError(f"O tempo da sessão não pode ser negativo (veio {tempo}).")
    if tempo > 24 * 60:
        raise ValueError("Uma sessão não passa de um dia (1440 minutos).")
    vistos: set[str] = set()
    for lab in labs:
        if lab.slug in vistos:
            raise ValueError(f"Lab repetido na sessão: {lab.slug}.")
        vistos.add(lab.slug)


def mochila_tabulada(labs: Sequence[Lab], tempo: int, contador: Contador | None = None) -> Plano:
    _valida(labs, tempo)
    c = contador or Contador()
    n = len(labs)
    T = [[0] * (tempo + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        lab = labs[i - 1]
        anterior, linha = T[i - 1], T[i]
        for t in range(tempo + 1):
            c.conta("celulas")
            linha[t] = anterior[t]
            if lab.minutos <= t:
                com = lab.pontos + anterior[t - lab.minutos]
                if com > linha[t]:
                    linha[t] = com

    escolhidos: list[Lab] = []
    t = tempo
    for i in range(n, 0, -1):
        if T[i][t] != T[i - 1][t]:
            escolhidos.append(labs[i - 1])
            t -= labs[i - 1].minutos
    escolhidos.reverse()
    return Plano(
        T[n][tempo],
        sum(l.minutos for l in escolhidos),
        tuple(escolhidos),
        tuple(tuple(linha) for linha in T),
    )


def mochila_memoizada(labs: Sequence[Lab], tempo: int, contador: Contador | None = None) -> int:
    """A mesma recorrência de cima para baixo. Só visita os (i, t) que importam."""
    _valida(labs, tempo)
    c = contador or Contador()
    memo: dict[tuple[int, int], int] = {}

    def melhor(i: int, t: int) -> int:
        c.conta("chamadas")
        if i == 0:
            return 0
        if (i, t) in memo:
            c.conta("acertos")
            return memo[(i, t)]
        lab = labs[i - 1]
        r = melhor(i - 1, t)
        if lab.minutos <= t:
            r = max(r, lab.pontos + melhor(i - 1, t - lab.minutos))
        memo[(i, t)] = r
        return r

    return melhor(len(labs), tempo)


def mochila_forca_bruta(labs: Sequence[Lab], tempo: int, contador: Contador | None = None) -> int:
    """Todo subconjunto. Serve para conferir a tabela e para medir o O(2ⁿ)."""
    _valida(labs, tempo)
    c = contador or Contador()
    melhor = 0
    for k in range(len(labs) + 1):
        for grupo in combinations(labs, k):
            c.conta("subconjuntos")
            if sum(l.minutos for l in grupo) <= tempo:
                melhor = max(melhor, sum(l.pontos for l in grupo))
    return melhor


def mochila_gulosa(labs: Sequence[Lab], tempo: int) -> tuple[int, list[Lab]]:
    """Pontos por minuto, do mais denso para o menos. Rápida — e às vezes errada."""
    _valida(labs, tempo)
    escolhidos: list[Lab] = []
    sobra = tempo
    for lab in sorted(labs, key=lambda l: (-l.pontos / l.minutos, l.slug)):
        if lab.minutos <= sobra:
            escolhidos.append(lab)
            sobra -= lab.minutos
    return sum(l.pontos for l in escolhidos), escolhidos
