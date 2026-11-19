"""Fase 6 do handbook — *Shortest paths on the real streets of São Paulo* (``labs/shortest-path``).

O mapa é o mesmo do lab: o centro de São Paulo, da Paulista ao Centro, tirado
do OpenStreetMap. Cada cruzamento é um **vértice**; cada trecho de rua entre
dois cruzamentos é uma **aresta dirigida** (rua de mão única tem uma só); o
**peso** é o tempo de viagem, em décimos de segundo, pela velocidade da via.

Duas perguntas, duas técnicas:

1. **Dijkstra** — o caminho mais rápido de A até B. Ele é guloso no que importa:
   sempre fecha o vértice aberto de menor distância, e essa distância já é a
   definitiva. É o mesmo algoritmo do lab, com o mesmo desempate (quem entrou
   primeiro na fila sai primeiro), então resolve os mesmos cruzamentos.

2. **Várias paradas** — em que ordem visitar 3 ou 4 lugares saindo do primeiro?
   O lab tenta todas as ordens. Aqui a resposta vem por Programação Dinâmica
   sobre subconjuntos (Held–Karp): ``melhor(S, j)`` = o menor tempo saindo da
   origem, passando por todas as paradas de ``S`` e terminando em ``j``. Com
   k paradas, são 2ᵏ × k estados em vez de k! ordens — e cada estado é resolvido
   uma vez só.
"""

from __future__ import annotations

import heapq
import json
import math
import unicodedata
from dataclasses import dataclass
from functools import lru_cache
from itertools import count
from pathlib import Path

AQUI = Path(__file__).resolve().parent
#: No ZIP o mapa vem em ``dados/``; no repositório ele mora no pacote dos labs, e é lido de lá.
CAMINHOS_DO_MAPA = (
    AQUI.parent / "dados" / "sao-paulo.json",
    AQUI.parent.parent / "packages" / "algo-domain" / "src" / "mapa-real" / "sao-paulo.json",
)


def _slug(s: str) -> str:
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    out, traco = [], False
    for c in s:
        if c.isascii() and c.isalnum():
            out.append(c)
            traco = False
        elif not traco:
            out.append("-")
            traco = True
    return "".join(out).strip("-")


@dataclass
class Cidade:
    nome: str
    credito: str
    n: int
    de: list[int]
    para: list[int]
    #: Décimos de segundo.
    peso: list[float]
    metros: list[float]
    rua: list[str]
    #: As arestas que saem de cada cruzamento (lista de adjacência).
    saida: list[list[int]]
    #: Lugares conhecidos: id → cruzamento mais perto.
    lugares: dict[str, tuple[str, int]]


def carregar_cidade(caminho: Path | None = None) -> Cidade:
    if caminho is None:
        caminho = next((c for c in CAMINHOS_DO_MAPA if c.exists()), None)
        if caminho is None:
            raise FileNotFoundError("não achei sao-paulo.json em dados/")
    d = json.loads(caminho.read_text(encoding="utf-8"))
    n = len(d["nos"]) // 2
    a = d["arestas"]
    m = len(a) // 6
    de = [a[6 * e] for e in range(m)]
    para = [a[6 * e + 1] for e in range(m)]
    peso = [max(1, a[6 * e + 2]) for e in range(m)]
    metros = [a[6 * e + 3] for e in range(m)]
    rua = [d["nomes"][a[6 * e + 4]] if a[6 * e + 4] < len(d["nomes"]) else "" for e in range(m)]
    # Lista de adjacência na ordem das arestas — a mesma ordem da estrutura CSR do lab.
    saida: list[list[int]] = [[] for _ in range(n)]
    for e in range(m):
        saida[de[e]].append(e)
    lugares: dict[str, tuple[str, int]] = {}
    for p in d["pois"]:
        id_ = _slug(p["nome"])
        while id_ in lugares:
            id_ += "-2"
        lugares[id_] = (p["nome"], p["no"])
    return Cidade(d["cidade"], d["credito"], n, de, para, peso, metros, rua, saida, lugares)


@dataclass
class Rota:
    #: Décimos de segundo; ``inf`` se não há caminho.
    tempo: float
    metros: float
    arestas: list[int]
    #: Cruzamentos fechados (resolvidos) até achar o destino.
    resolvidos: int
    #: A ordem em que os cruzamentos foram fechados, com a distância de cada um.
    fechados: list[tuple[int, float]]


def dijkstra(c: Cidade, origem: int, destino: int) -> Rota:
    """O caminho mais rápido de ``origem`` a ``destino`` (Grafos)."""
    dist = [math.inf] * c.n
    pai = [-1] * c.n
    fechado = [False] * c.n
    dist[origem] = 0.0
    chegada = count()  # desempate: quem entrou primeiro na fila sai primeiro
    fila: list[tuple[float, int, int]] = [(0.0, next(chegada), origem)]
    fechados: list[tuple[int, float]] = []
    while fila:
        d, _, u = heapq.heappop(fila)
        if fechado[u]:
            continue  # entrada velha: o cruzamento já foi resolvido por um caminho melhor
        fechado[u] = True
        fechados.append((u, d))
        if u == destino:
            break
        for e in c.saida[u]:
            v = c.para[e]
            nd = d + c.peso[e]
            if nd < dist[v]:
                dist[v] = nd
                pai[v] = e
                heapq.heappush(fila, (nd, next(chegada), v))
    if not fechado[destino]:
        return Rota(math.inf, math.inf, [], len(fechados), fechados)
    arestas: list[int] = []
    v = destino
    while v != origem:
        arestas.append(pai[v])
        v = c.de[pai[v]]
    arestas.reverse()
    return Rota(sum(c.peso[e] for e in arestas), sum(c.metros[e] for e in arestas), arestas, len(fechados), fechados)


def ruas(c: Cidade, rota: Rota) -> list[tuple[str, float]]:
    """A rota como o motorista lê: rua por rua, com os metros de cada uma."""
    trechos: list[tuple[str, float]] = []
    for e in rota.arestas:
        nome = c.rua[e] or "(sem nome)"
        if trechos and trechos[-1][0] == nome:
            trechos[-1] = (nome, trechos[-1][1] + c.metros[e])
        else:
            trechos.append((nome, c.metros[e]))
    return trechos


def tempos_entre(c: Cidade, nos: list[int]) -> list[list[float]]:
    """A matriz de tempos entre cada par de paradas: um Dijkstra por par."""
    return [[0.0 if a == b else dijkstra(c, a, b).tempo for b in nos] for a in nos]


@dataclass
class Ordem:
    #: Índices das paradas na ordem de visita (a primeira é a origem).
    ordem: list[int]
    tempo: float
    #: Estados ``(S, j)`` resolvidos pela PD.
    estados: int


def melhor_ordem(tempos: list[list[float]]) -> Ordem:
    """Held–Karp: PD sobre subconjuntos, saindo sempre da parada 0 (Memoização + Grafos).

    ``melhor(S, j)`` = menor tempo saindo de 0, passando por todas as paradas do
    conjunto ``S`` (uma máscara de bits) e terminando em ``j ∈ S``.
    """
    k = len(tempos)
    if k < 2:
        raise ValueError("uma rota precisa de pelo menos duas paradas")
    estados = 0

    @lru_cache(maxsize=None)
    def melhor(S: int, j: int) -> tuple[float, tuple[int, ...]]:
        nonlocal estados
        estados += 1
        antes = S & ~(1 << j)
        if antes == 0:
            return tempos[0][j], (j,)
        opcoes = []
        for i in range(1, k):
            if antes >> i & 1:
                t, rota = melhor(antes, i)
                opcoes.append((t + tempos[i][j], rota + (j,)))
        return min(opcoes)

    todas = (1 << k) - 2  # todas as paradas menos a origem
    tempo, rota = min(melhor(todas, j) for j in range(1, k))
    return Ordem([0, *rota], tempo, estados)


def forca_bruta_da_ordem(tempos: list[list[float]]) -> tuple[list[int], float, int]:
    """Todas as (k − 1)! ordens, como o lab faz: para conferir a PD."""
    from itertools import permutations

    k = len(tempos)
    melhor, menor, tentadas = list(range(k)), math.inf, 0
    for p in permutations(range(1, k)):
        tentadas += 1
        ordem = [0, *p]
        t = sum(tempos[ordem[i - 1]][ordem[i]] for i in range(1, k))
        if t < menor:
            melhor, menor = ordem, t
    return melhor, menor, tentadas


def em_minutos(decimos: float) -> str:
    s = round(decimos / 10)
    return f"{s // 60} min {s % 60:02d} s"


#: Os cenários do lab: cada um puxa a vantagem de uma busca diferente.
CENARIOS: tuple[tuple[str, str, tuple[str, ...]], ...] = (
    ("short", "Um pulo curto: Copan até a Praça da República", ("copan", "praca-da-republica")),
    ("across", "Atravessando o centro: MASP até o Mercadão", ("masp", "mercadao")),
    ("aimed", "Uma linha reta clara: Sírio-Libanês até a Estação da Luz", ("hospital-sirio-libanes", "estacao-da-luz")),
    ("maze", "Atrás das mãos únicas: Bixiga até o Mosteiro de São Bento", ("bixiga", "mosteiro-de-sao-bento")),
    ("tour", "Três paradas: MASP, Theatro Municipal e Liberdade, na melhor ordem", ("masp", "theatro-municipal", "liberdade")),
    ("errands", "Quatro recados: Sírio-Libanês, Copan, Mercadão e Catedral da Sé", ("hospital-sirio-libanes", "copan", "mercadao", "catedral-da-se")),
)
