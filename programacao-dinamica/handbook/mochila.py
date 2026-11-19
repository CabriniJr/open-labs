"""Fase 8 do handbook — *The table that remembers* (``labs/knapsack-session``).

A mochila 0/1 da sessão no telecentro: quais labs cabem nos minutos de
computador para aprender o máximo. É o mesmo catálogo, os mesmos cenários e a
mesma tabela do lab (``packages/algo-domain/src/mochila/mochila.ts``).

``T[i][c]`` = o máximo de pontos usando só os ``i`` primeiros labs e ``c``
colunas de tempo (cada coluna é ``PASSO`` minutos):

    T[0][c] = 0
    T[i][c] = max(T[i-1][c], pontos(i) + T[i-1][c - colunas(i)])   se o lab i cabe

A reconstrução anda da última linha para a primeira: se a célula mudou em
relação à de cima, o lab da linha entrou.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass

#: O tempo anda em blocos de 5 minutos, como no lab.
PASSO = 5
MAIOR_SESSAO = 180
MAIS_ITENS = 12


@dataclass(frozen=True)
class Item:
    id: str
    #: O nome que o lab usa (o desempate da gulosa é por ele, como no lab).
    nome: str
    titulo: str
    minutos: int
    pontos: int


#: Labs reais do OpenLabs, com os minutos e os pontos do lab.
CATALOGO: tuple[Item, ...] = (
    Item("telecentro-network", "Telecentre Wi-Fi", "O Wi-Fi do telecentro", 30, 5),
    Item("telecentro-database", "Telecentre database", "O banco do telecentro", 30, 5),
    Item("join-by-hand", "JOIN by hand", "O JOIN à mão", 20, 3),
    Item("rpn", "Stack machine", "Uma máquina de pilha", 20, 3),
    Item("how-work-grows", "How work grows", "Como o trabalho cresce", 25, 4),
    Item("sorting-race", "Sorting race", "A corrida da ordenação", 30, 4),
    Item("what-is-a-graph", "What a graph is", "O que é um grafo", 15, 2),
    Item("shortest-path", "Shortest paths", "Caminhos mínimos", 30, 5),
    Item("greedy-change", "Greedy change", "O troco guloso", 20, 3),
    Item("three-pillars", "Three pillars", "Os três pilares", 25, 3),
    Item("pod-lifecycle", "Pod lifecycle", "O ciclo de vida do pod", 20, 3),
    Item("splunk-ingest", "Splunk ingest", "A ingestão do Splunk", 25, 3),
)


@dataclass(frozen=True)
class Cenario:
    id: str
    nome: str
    itens: tuple[str, ...]
    sessao: int
    nota: str


CENARIOS: tuple[Cenario, ...] = (
    Cenario("rafa", "Rafa, 90 minutos",
            ("telecentro-network", "rpn", "sorting-race", "shortest-path", "greedy-change", "join-by-hand", "three-pillars"), 90,
            "Sete labs liberados, uma hora e meia de computador. Escolher por pontos por minuto deixa um ponto na mesa."),
    Cenario("trap", "A menor armadilha", ("what-is-a-graph", "how-work-grows", "three-pillars"), 50,
            "A gulosa pega os dois labs mais densos e sobram dez minutos em que nenhum lab cabe. O melhor plano usa os cinquenta."),
    Cenario("cida", "Dona Cida, 60 minutos",
            ("telecentro-database", "rpn", "how-work-grows", "what-is-a-graph", "three-pillars", "pod-lifecycle"), 60,
            "Seis labs liberados, uma hora. Aqui a gulosa também acha o melhor plano."),
)


def cenario(id_: str) -> Cenario:
    for c in CENARIOS:
        if c.id == id_:
            return c
    raise KeyError(f"cenário desconhecido: {id_}")


def itens_do_cenario(c: Cenario) -> list[Item]:
    por_id = {i.id: i for i in CATALOGO}
    return [por_id[i] for i in c.itens]


def _conferir(itens: list[Item], sessao: int) -> None:
    if len(itens) > MAIS_ITENS:
        raise ValueError(f"no máximo {MAIS_ITENS} labs numa sessão, vieram {len(itens)}")
    if len({i.id for i in itens}) != len(itens):
        raise ValueError("um lab aparece duas vezes")
    for i in itens:
        if i.minutos % PASSO or not PASSO <= i.minutos <= 120:
            raise ValueError(f"{i.nome}: os minutos são múltiplos de {PASSO}, de {PASSO} a 120")
    if sessao % PASSO or not 0 <= sessao <= MAIOR_SESSAO:
        raise ValueError(f"a sessão é um múltiplo de {PASSO} minutos, de 0 a {MAIOR_SESSAO}")


@dataclass
class Mochila:
    T: list[list[int]]
    #: Índices (em ``itens``) dos labs escolhidos, em ordem.
    escolhidos: list[int]
    #: As células que a reconstrução visita, de baixo para cima.
    caminho: list[tuple[int, int]]
    pontos: int
    minutos: int
    celulas: int


def tabulada(itens: list[Item], sessao: int) -> Mochila:
    """A tabela inteira, linha por linha (Tabulação), e a volta por ela."""
    _conferir(itens, sessao)
    colunas = sessao // PASSO
    T = [[0] * (colunas + 1)]
    celulas = 0
    for it in itens:
        cima = T[-1]
        w = it.minutos // PASSO
        linha = []
        for c, deixa in enumerate(cima):
            celulas += 1
            linha.append(max(deixa, it.pontos + cima[c - w]) if w <= c else deixa)
        T.append(linha)

    escolhidos: list[int] = []
    caminho: list[tuple[int, int]] = []
    c = colunas
    for i in range(len(itens), 0, -1):
        caminho.append((i, c))
        if T[i][c] != T[i - 1][c]:
            escolhidos.append(i - 1)
            c -= itens[i - 1].minutos // PASSO
    caminho.append((0, c))
    escolhidos.reverse()
    return Mochila(T, escolhidos, caminho, T[len(itens)][colunas], sum(itens[k].minutos for k in escolhidos), celulas)


def por_que(itens: list[Item], T: list[list[int]], i: int, c: int) -> dict[str, int | None]:
    """Por que a célula vale o que vale: deixar o lab da linha, ou levá-lo."""
    if i == 0:
        return {"deixa": 0, "leva": None, "valor": 0}
    it = itens[i - 1]
    w = it.minutos // PASSO
    return {"deixa": T[i - 1][c], "leva": it.pontos + T[i - 1][c - w] if w <= c else None, "valor": T[i][c]}


def sem_memoria(itens: list[Item], sessao: int) -> tuple[int, int]:
    """A recorrência sem guardar nada: pontos e chamadas, que quase dobram a cada lab."""
    _conferir(itens, sessao)
    chamadas = 0

    def m(i: int, c: int) -> int:
        nonlocal chamadas
        chamadas += 1
        if i == 0:
            return 0
        it = itens[i - 1]
        w = it.minutos // PASSO
        deixa = m(i - 1, c)
        return max(deixa, it.pontos + m(i - 1, c - w)) if w <= c else deixa

    return m(len(itens), sessao // PASSO), chamadas


def memoizada(itens: list[Item], sessao: int) -> tuple[int, int]:
    """De cima para baixo, guardando cada ``(i, c)`` (Memoização): pontos e chamadas.

    Conta toda chamada, inclusive as que acham a resposta já guardada — como o lab.
    """
    _conferir(itens, sessao)
    chamadas = 0
    guardado: dict[tuple[int, int], int] = {}

    def m(i: int, c: int) -> int:
        nonlocal chamadas
        chamadas += 1
        if i == 0:
            return 0
        if (i, c) in guardado:
            return guardado[(i, c)]
        it = itens[i - 1]
        w = it.minutos // PASSO
        deixa = m(i - 1, c)
        r = max(deixa, it.pontos + m(i - 1, c - w)) if w <= c else deixa
        guardado[(i, c)] = r
        return r

    return m(len(itens), sessao // PASSO), chamadas


def forca_bruta(itens: list[Item], sessao: int) -> int:
    """Os 2ⁿ subconjuntos, para conferir."""
    _conferir(itens, sessao)
    melhor = 0
    for mascara in range(1 << len(itens)):
        escolha = [it for k, it in enumerate(itens) if mascara >> k & 1]
        if sum(i.minutos for i in escolha) <= sessao:
            melhor = max(melhor, sum(i.pontos for i in escolha))
    return melhor


def gulosa(itens: list[Item], sessao: int) -> tuple[list[int], int, int]:
    """Pontos por minuto, do mais denso ao menos; empate pelo nome (como no lab)."""
    _conferir(itens, sessao)
    ordem = sorted(range(len(itens)), key=lambda k: (-itens[k].pontos / itens[k].minutos, itens[k].nome.casefold()))
    escolhidos, sobra = [], sessao
    for k in ordem:
        if itens[k].minutos <= sobra:
            escolhidos.append(k)
            sobra -= itens[k].minutos
    return escolhidos, sum(itens[k].pontos for k in escolhidos), sessao - sobra


if sys.version_info < (3, 10):  # pragma: no cover
    raise SystemExit("Python 3.10 ou mais novo")
