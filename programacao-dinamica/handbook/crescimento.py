"""Fase 3 do handbook — *How work grows* (``labs/how-work-grows``).

O lab mede seis classes de custo. A exponencial é a **soma de subconjunto**:
existe um grupo de números do vetor que soma exatamente ``alvo``? A força bruta
tenta os 2ⁿ subconjuntos. Com n = 20, já são mais de um milhão.

O lab mostra a explosão. Esta aula mostra a saída: a pergunta "dá para somar
``s`` usando só os itens de ``i`` em diante?" se repete muitas vezes com os
mesmos ``(i, s)``. Guardar a resposta (memoização) ou preencher uma tabela de
baixo para cima (tabulação) troca 2ⁿ por n × (alvo + 1).

    pode(i, s) = verdadeiro                      se s = 0
               = falso                           se i = n
               = pode(i+1, s) ou pode(i+1, s - v[i])   (o segundo, se v[i] ≤ s)

A entrada é a do lab: ``n`` números pares sorteados com a semente 1, e um alvo
ímpar (1). Nenhuma soma de pares é ímpar, então a força bruta é obrigada a ver
todos os 2ⁿ subconjuntos — o pior caso, que é o que o lab mede.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass, field
from functools import lru_cache

from .semente import gerador

#: O lab para em n = 20: 2²⁰ = 1 048 576 subconjuntos.
MAIOR_N = 20


def entrada_do_lab(n: int, semente: int = 1) -> list[int]:
    """O vetor que o lab mede: ``n`` pares de 2 a 100, sorteados com a semente."""
    if not 1 <= n <= MAIOR_N:
        raise ValueError(f"n vai de 1 a {MAIOR_N}, veio {n}")
    r = gerador(semente)
    return [2 * (1 + int(r() * 50)) for _ in range(n)]


@dataclass
class Resultado:
    achou: bool
    #: Subconjuntos tentados (força bruta), chamadas (memoização) ou células (tabela).
    trabalho: int
    #: Os itens usados, quando achou.
    itens: list[int] = field(default_factory=list)


def forca_bruta(v: list[int], alvo: int) -> Resultado:
    """Tenta cada subconjunto, na ordem da máscara de bits — igual ao lab."""
    n = len(v)
    tentados = 0
    for mascara in range(1 << n):
        tentados += 1
        soma = sum(v[b] for b in range(n) if (mascara >> b) & 1)
        if soma == alvo:
            return Resultado(True, tentados, [v[b] for b in range(n) if (mascara >> b) & 1])
    return Resultado(False, tentados)


def memoizada(v: list[int], alvo: int) -> Resultado:
    """De cima para baixo: a recorrência, com cada ``(i, s)`` resolvido uma vez."""
    n = len(v)
    chamadas = 0
    sys.setrecursionlimit(max(sys.getrecursionlimit(), n + 100))

    @lru_cache(maxsize=None)
    def pode(i: int, s: int) -> bool:
        nonlocal chamadas
        chamadas += 1
        if s == 0:
            return True
        if i == n:
            return False
        return pode(i + 1, s) or (v[i] <= s and pode(i + 1, s - v[i]))

    achou = pode(0, alvo)
    itens: list[int] = []
    if achou:
        s = alvo
        for i in range(n):
            if s == 0:
                break
            if not pode(i + 1, s):  # sem o item i não dá: ele entra
                itens.append(v[i])
                s -= v[i]
    return Resultado(achou, chamadas, itens)


def tabela(v: list[int], alvo: int) -> tuple[Resultado, list[list[bool]]]:
    """De baixo para cima: ``T[i][s]`` = dá para somar ``s`` com os ``i`` primeiros itens."""
    n = len(v)
    T = [[False] * (alvo + 1) for _ in range(n + 1)]
    T[0][0] = True
    celulas = 0
    for i in range(1, n + 1):
        for s in range(alvo + 1):
            celulas += 1
            T[i][s] = T[i - 1][s] or (v[i - 1] <= s and T[i - 1][s - v[i - 1]])
    itens: list[int] = []
    if T[n][alvo]:
        s = alvo
        for i in range(n, 0, -1):
            if not T[i - 1][s]:  # a linha de cima não chegava lá: o item i entrou
                itens.append(v[i - 1])
                s -= v[i - 1]
        itens.reverse()
    return Resultado(T[n][alvo], celulas, itens), T
