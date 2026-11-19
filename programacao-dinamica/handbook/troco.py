"""Fase 7 do handbook — *Greedy, and the case it misses* (``labs/greedy-change``).

Dar troco com o menor número de moedas. O guloso pega sempre a maior moeda que
cabe. Com as moedas do real isso é ótimo. Com moedas {1, 3, 4} e troco 6, o
guloso dá 4 + 1 + 1 (três moedas) quando 3 + 3 (duas) existia.

A Programação Dinâmica resolve **todos** os valores de 0 até o pedido, cada um
usando os anteriores, e guarda a resposta numa tabela:

    minimo[0] = 0
    minimo[v] = 1 + min(minimo[v - m])   para cada moeda m ≤ v

Ela custa ``valor × moedas`` passos; o guloso custa ``moedas``. O lab põe os
dois lado a lado. Este módulo é o mesmo código do lab
(``packages/algo-domain/src/troco/troco.ts``), com a versão memoizada ao lado.
"""

from __future__ import annotations

import math
import sys
from dataclasses import dataclass, field
from functools import lru_cache

MAIOR_VALOR = 500


@dataclass(frozen=True)
class Sistema:
    id: str
    nome: str
    moedas: tuple[int, ...]
    #: O valor que o lab usa de exemplo para este sistema.
    valor: int
    nota: str


#: Os sistemas do lab, com os mesmos valores de exemplo.
SISTEMAS: tuple[Sistema, ...] = (
    Sistema("brl", "Real brasileiro (centavos)", (1, 5, 10, 25, 50, 100), 68, "Canônico: o guloso sempre acerta."),
    Sistema("pre-decimal", "Inglaterra antes de 1971 (pence)", (1, 3, 6, 12, 24, 30), 48, "Não canônico: o guloso erra no 48."),
    Sistema("toy", "Moedas de brinquedo", (1, 3, 4), 6, "O menor contraexemplo clássico: 6."),
    Sistema("no-one", "Sem a moeda de 1", (5, 7), 10, "Alguns valores não se pagam de jeito nenhum."),
)


def sistema(id_: str) -> Sistema:
    for s in SISTEMAS:
        if s.id == id_:
            return s
    raise KeyError(f"sistema desconhecido: {id_}")


def _conferir(valor: int) -> None:
    if not isinstance(valor, int) or not 1 <= valor <= MAIOR_VALOR:
        raise ValueError(f"o troco vai de 1 a {MAIOR_VALOR}, veio {valor}")


@dataclass
class Troco:
    #: As moedas dadas; ``None`` quando não fecha.
    moedas: list[int] | None
    #: Moedas examinadas (guloso) ou células × moedas (tabela).
    passos: int
    sobra: int = 0
    historia: list[tuple[int, int]] = field(default_factory=list)


def guloso(moedas: tuple[int, ...], valor: int) -> Troco:
    """A maior moeda que cabe, de novo e de novo."""
    _conferir(valor)
    dadas: list[int] = []
    historia: list[tuple[int, int]] = []
    resto = valor
    passos = 0
    for m in sorted(moedas, reverse=True):
        passos += 1
        while resto >= m:
            resto -= m
            dadas.append(m)
            historia.append((m, resto))
    return Troco(dadas if resto == 0 else None, passos, resto, historia)


@dataclass
class Tabela:
    #: ``minimo[v]`` = menor número de moedas para ``v`` (``inf`` se não fecha).
    minimo: list[float]
    #: A última moeda da melhor resposta de ``v``.
    ultima: list[int | None]
    passos: int


def tabela(moedas: tuple[int, ...], valor: int) -> Tabela:
    """De baixo para cima, de 0 até ``valor`` (Tabulação)."""
    _conferir(valor)
    minimo: list[float] = [0]
    ultima: list[int | None] = [None]
    passos = 0
    for v in range(1, valor + 1):
        melhor, escolha = math.inf, None
        for m in moedas:
            passos += 1
            if m <= v and minimo[v - m] + 1 < melhor:
                melhor, escolha = minimo[v - m] + 1, m
        minimo.append(melhor)
        ultima.append(escolha)
    return Tabela(minimo, ultima, passos)


def otimo(moedas: tuple[int, ...], valor: int) -> Troco:
    """A resposta da tabela, reconstruída andando pela última moeda de cada valor."""
    t = tabela(moedas, valor)
    if math.isinf(t.minimo[valor]):
        return Troco(None, t.passos, valor)
    dadas: list[int] = []
    v = valor
    while v > 0:
        dadas.append(t.ultima[v])  # type: ignore[arg-type]
        v -= t.ultima[v]  # type: ignore[operator]
    return Troco(sorted(dadas, reverse=True), t.passos)


def memoizado(moedas: tuple[int, ...], valor: int) -> tuple[float, int]:
    """De cima para baixo: ``minimo(v)`` pede ``minimo(v - m)`` e guarda (Memoização).

    Devolve o menor número de moedas e quantos valores foram resolvidos.
    """
    _conferir(valor)
    sys.setrecursionlimit(max(sys.getrecursionlimit(), valor + 100))
    resolvidos = 0

    @lru_cache(maxsize=None)
    def minimo(v: int) -> float:
        nonlocal resolvidos
        resolvidos += 1
        if v == 0:
            return 0
        return min((minimo(v - m) + 1 for m in moedas if m <= v), default=math.inf)

    return minimo(valor), resolvidos


def sem_memoria(moedas: tuple[int, ...], valor: int) -> tuple[float, int]:
    """A mesma recorrência sem guardar nada: quantas chamadas ela faz."""
    _conferir(valor)
    chamadas = 0

    def minimo(v: int) -> float:
        nonlocal chamadas
        chamadas += 1
        if v == 0:
            return 0
        return min((minimo(v - m) + 1 for m in moedas if m <= v), default=math.inf)

    return minimo(valor), chamadas


def menor_contraexemplo(moedas: tuple[int, ...], limite: int = MAIOR_VALOR) -> int | None:
    """O menor valor em que o guloso usa mais moedas que o ótimo; ``None`` se não há."""
    t = tabela(moedas, limite)
    for v in range(1, limite + 1):
        o = t.minimo[v]
        if math.isinf(o):
            continue
        g = guloso(moedas, v)
        if g.moedas is None or len(g.moedas) > o:
            return v
    return None
