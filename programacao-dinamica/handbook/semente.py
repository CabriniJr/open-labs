"""O gerador semeado dos labs (mulberry32), bit a bit igual ao do OpenLabs.

O lab sorteia as entradas com ``gerador(semente)`` em
``packages/algo-domain/src/semente.ts``. Para o Python medir o mesmo vetor que
o lab mede, o gerador tem de dar os mesmos números: é a mesma conta, em
aritmética de 32 bits.
"""

from __future__ import annotations

from typing import Callable

M32 = 0xFFFFFFFF


def _imul(a: int, b: int) -> int:
    """``Math.imul`` do JavaScript: o produto, cortado em 32 bits."""
    return (a * b) & M32


def gerador(semente: int) -> Callable[[], float]:
    a = semente & M32

    def proximo() -> float:
        nonlocal a
        a = (a + 0x6D2B79F5) & M32
        t = a
        t = _imul(t ^ (t >> 15), t | 1)
        t ^= (t + _imul(t ^ (t >> 7), t | 61)) & M32
        return ((t ^ (t >> 14)) & M32) / 4294967296

    return proximo
