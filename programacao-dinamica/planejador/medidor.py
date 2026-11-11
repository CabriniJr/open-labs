"""Contagem de trabalho e cronômetro.

A eficiência é mostrada de dois jeitos: **contada** (chamadas, células da tabela,
arestas relaxadas — o mesmo número em qualquer máquina) e **cronometrada**
(``time.perf_counter``, mediana de várias rodadas — varia de máquina para máquina).
"""

from __future__ import annotations

import statistics
import time
from dataclasses import dataclass, field
from typing import Callable, TypeVar

T = TypeVar("T")


@dataclass
class Contador:
    """Conta operações por nome. Os algoritmos recebem um e incrementam."""

    contagens: dict[str, int] = field(default_factory=dict)

    def conta(self, nome: str, quanto: int = 1) -> None:
        self.contagens[nome] = self.contagens.get(nome, 0) + quanto

    def __getitem__(self, nome: str) -> int:
        return self.contagens.get(nome, 0)


def cronometra(funcao: Callable[[], T], rodadas: int = 5) -> tuple[T, float]:
    """Roda ``funcao`` algumas vezes e devolve (resultado, mediana em ms)."""
    tempos: list[float] = []
    resultado: T | None = None
    for _ in range(rodadas):
        inicio = time.perf_counter()
        resultado = funcao()
        tempos.append((time.perf_counter() - inicio) * 1000)
    assert resultado is not None or rodadas > 0
    return resultado, statistics.median(tempos)  # type: ignore[return-value]
