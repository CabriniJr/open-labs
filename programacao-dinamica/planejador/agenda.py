"""Memoização e Tabulação — quem usa o computador de atendimento.

O telecentro tem um computador de atendimento e um dia cheio de pedidos que se
sobrepõem. Cada pedido tem uma prioridade (serviço público e emprego primeiro).
Escolher o conjunto de pedidos **sem sobreposição** com a maior prioridade somada
é o problema dos *intervalos ponderados*.

Com os pedidos em ordem de fim, seja ``p(j)`` o último pedido que termina até o
início de ``j``. Para o pedido ``j`` há duas escolhas — atendê-lo ou não::

    M(0) = 0
    M(j) = max( M(j - 1),               # não atende j
                peso(j) + M(p(j)) )     # atende j, e só cabe o que acabou antes

- ``ingenua``    — a recorrência direta. Cada chamada abre duas, e as mesmas
                   ``M(i)`` são recalculadas: no pior caso, chamadas ~ Fibonacci.
- ``memoizada``  — a mesma recursão, guardando ``M(j)`` num dicionário: cada ``j``
                   é resolvido uma vez. O(n) chamadas depois de ordenar.
- ``tabulada``   — a tabela ``M[0..n]`` preenchida de baixo para cima, sem
                   recursão, e a reconstrução andando de trás para frente.
- ``gulosa``     — a regra "o que termina primeiro". Ela maximiza a *quantidade*
                   de pedidos, não a prioridade: é o contraexemplo.

Ordenar custa O(n log n) e cada ``p(j)`` sai por busca binária, O(log n).
"""

from __future__ import annotations

import bisect
import json
import sys
from dataclasses import dataclass
from pathlib import Path

from .medidor import Contador

DADOS = Path(__file__).resolve().parent.parent / "dados" / "reservas.json"


@dataclass(frozen=True)
class Pedido:
    quem: str
    motivo: str
    inicio: int  # minutos desde a meia-noite
    fim: int
    peso: int

    @property
    def horario(self) -> str:
        return f"{hora(self.inicio)}–{hora(self.fim)}"


def minutos(texto: str) -> int:
    """'09:30' -> 570. Recusa o que não for HH:MM de um dia."""
    try:
        h, m = texto.split(":")
        h_, m_ = int(h), int(m)
    except ValueError as erro:
        raise ValueError(f"Horário inválido: {texto!r} (esperado HH:MM).") from erro
    if not (0 <= h_ <= 24 and 0 <= m_ < 60) or h_ * 60 + m_ > 24 * 60:
        raise ValueError(f"Horário fora do dia: {texto!r}.")
    return h_ * 60 + m_


def hora(total: int) -> str:
    return f"{total // 60:02d}:{total % 60:02d}"


class Agenda:
    """Os pedidos de um dia, já ordenados por fim, com ``p(j)`` pré-calculado."""

    def __init__(self, pedidos: list[Pedido]):
        for p in pedidos:
            if p.fim <= p.inicio:
                raise ValueError(f"{p.quem}: o pedido termina ({hora(p.fim)}) antes de começar ({hora(p.inicio)}).")
            if p.peso < 0:
                raise ValueError(f"{p.quem}: prioridade negativa.")
        # 1-indexado: pedidos[0] é um sentinela, para M(0) = 0 ficar natural.
        self.pedidos: list[Pedido] = sorted(pedidos, key=lambda p: (p.fim, p.inicio, p.quem))
        fins = [p.fim for p in self.pedidos]
        # p[j] = quantos pedidos terminam até o início de j (j de 1 a n)
        self.p = [0] + [bisect.bisect_right(fins, ped.inicio) for ped in self.pedidos]

    @property
    def n(self) -> int:
        return len(self.pedidos)

    def peso(self, j: int) -> int:
        return self.pedidos[j - 1].peso

    # -- Recursão ingênua --------------------------------------------------------

    def ingenua(self, contador: Contador | None = None) -> int:
        c = contador or Contador()

        def m(j: int) -> int:
            c.conta("chamadas")
            if j == 0:
                return 0
            return max(m(j - 1), self.peso(j) + m(self.p[j]))

        with _pilha_funda(self.n):
            return m(self.n)

    # -- Memoização (de cima para baixo) -----------------------------------------

    def memoizada(self, contador: Contador | None = None) -> int:
        c = contador or Contador()
        memo: dict[int, int] = {0: 0}

        def m(j: int) -> int:
            c.conta("chamadas")
            if j in memo:
                c.conta("acertos")
                return memo[j]
            memo[j] = max(m(j - 1), self.peso(j) + m(self.p[j]))
            return memo[j]

        with _pilha_funda(self.n):
            return m(self.n)

    # -- Tabulação (de baixo para cima) ------------------------------------------

    def tabulada(self, contador: Contador | None = None) -> tuple[int, list[int], list[Pedido]]:
        """(melhor soma, tabela M, pedidos escolhidos em ordem de horário)."""
        c = contador or Contador()
        M = [0] * (self.n + 1)
        for j in range(1, self.n + 1):
            c.conta("celulas")
            M[j] = max(M[j - 1], self.peso(j) + M[self.p[j]])

        # Reconstrução: se atender j empata ou vence, j foi atendido.
        escolhidos: list[Pedido] = []
        j = self.n
        while j > 0:
            if self.peso(j) + M[self.p[j]] >= M[j - 1]:
                escolhidos.append(self.pedidos[j - 1])
                j = self.p[j]
            else:
                j -= 1
        return M[self.n], M, escolhidos[::-1]

    # -- A regra gulosa, para comparar ------------------------------------------

    def gulosa(self) -> list[Pedido]:
        """Atende o que termina primeiro e não conflita. Ótima para *contar* pedidos."""
        escolhidos: list[Pedido] = []
        livre_desde = -1
        for ped in self.pedidos:
            if ped.inicio >= livre_desde:
                escolhidos.append(ped)
                livre_desde = ped.fim
        return escolhidos


class _pilha_funda:
    """A recursão desce até ``n`` níveis; o limite padrão do Python é 1000."""

    def __init__(self, n: int):
        self.n = n

    def __enter__(self) -> None:
        self.antes = sys.getrecursionlimit()
        sys.setrecursionlimit(max(self.antes, 2 * self.n + 100))

    def __exit__(self, *_: object) -> None:
        sys.setrecursionlimit(self.antes)


def carregar_agenda(caminho: Path = DADOS) -> Agenda:
    dados = json.loads(caminho.read_text(encoding="utf-8"))
    prioridades: dict[str, int] = dados["prioridades"]
    pedidos = []
    for d in dados["pedidos"]:
        if d["motivo"] not in prioridades:
            raise ValueError(f"{d['quem']}: motivo desconhecido {d['motivo']!r}.")
        pedidos.append(Pedido(d["quem"], d["motivo"], minutos(d["inicio"]), minutos(d["fim"]), prioridades[d["motivo"]]))
    return Agenda(pedidos)
