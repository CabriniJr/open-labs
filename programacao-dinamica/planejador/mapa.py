"""Grafos — qual telecentro fica mais perto, a pé, pelas ruas de verdade.

O mapa é o recorte do centro de São Paulo (Paulista ao Centro) extraído do
OpenStreetMap: cada cruzamento é um vértice, cada trecho de rua uma aresta com o
comprimento em metros. A pé, mão única não vale: o grafo é não dirigido. Vias
expressas (``motorway``) ficam de fora, porque pedestre não anda nelas.

**Por que é Programação Dinâmica.** A menor distância até um vértice obedece à
recorrência de Bellman::

    dist(v) = min( dist(u) + comprimento(u, v) )   para cada vizinho u de v
    dist(t) = 0                                    para cada telecentro t

Cada ``dist(v)`` é um subproblema que se resolve uma vez e é reaproveitado por
todos os vizinhos. O Dijkstra é a ordem de avaliação que garante que, quando um
vértice sai do heap, a sua resposta já é final (pesos não negativos).

**Multi-fonte.** Em vez de rodar uma busca por telecentro, todos entram no heap
com distância 0. Uma única passada responde, para *todos* os cruzamentos do mapa,
qual é o telecentro mais próximo e a quantos metros — é o que alimenta o
indicador de cobertura (quantos cruzamentos ficam a 15 minutos a pé).
"""

from __future__ import annotations

import heapq
import json
import math
from dataclasses import dataclass
from pathlib import Path

from .medidor import Contador

AQUI = Path(__file__).resolve().parent
#: No ZIP da entrega o mapa vem junto, em ``dados/``. No repositório do OpenLabs ele
#: mora no pacote do site, e o planejador lê de lá para não haver duas cópias.
CAMINHOS_DO_MAPA = (
    AQUI.parent / "dados" / "sao-paulo.json",
    AQUI.parent.parent / "packages" / "algo-domain" / "src" / "mapa-real" / "sao-paulo.json",
)

#: Tipos de via em que pedestre não anda.
SEM_PEDESTRE = {"motorway", "motorway_link"}


@dataclass(frozen=True)
class Mapa:
    nomes_das_ruas: list[str]
    #: posição de cada cruzamento, em metros (x para leste, y para o sul)
    x: list[float]
    y: list[float]
    #: vizinhos[v] = lista de (u, metros, índice do nome da rua)
    vizinhos: list[list[tuple[int, float, int]]]
    #: lugar conhecido -> cruzamento mais próximo
    lugares: dict[str, int]
    credito: str

    @property
    def n(self) -> int:
        return len(self.x)

    def arestas(self) -> int:
        return sum(len(v) for v in self.vizinhos) // 2


def arquivo_do_mapa() -> Path:
    for caminho in CAMINHOS_DO_MAPA:
        if caminho.exists():
            return caminho
    raise FileNotFoundError(
        "Mapa não encontrado. Esperado em: " + " ou ".join(str(c) for c in CAMINHOS_DO_MAPA)
    )


def carregar_mapa(caminho: Path | None = None) -> Mapa:
    """Lê o JSON do OpenStreetMap (arrays planos) e monta a lista de adjacência."""
    dados = json.loads((caminho or arquivo_do_mapa()).read_text(encoding="utf-8"))
    nos = dados["nos"]
    n = len(nos) // 2
    x = [nos[2 * v] / 10 for v in range(n)]  # decímetros -> metros
    y = [nos[2 * v + 1] / 10 for v in range(n)]
    tipos = dados["tipos"]

    # Duas mãos de uma rua viram duas arestas dirigidas no arquivo; a pé é uma só.
    melhor: dict[tuple[int, int], tuple[float, int]] = {}
    arestas = dados["arestas"]
    for e in range(len(arestas) // 6):
        de, para, _decimos, metros, nome, tipo = arestas[6 * e : 6 * e + 6]
        if tipos[tipo] in SEM_PEDESTRE or de == para:
            continue
        chave = (min(de, para), max(de, para))
        if chave not in melhor or metros < melhor[chave][0]:
            melhor[chave] = (float(max(metros, 1)), nome)

    vizinhos: list[list[tuple[int, float, int]]] = [[] for _ in range(n)]
    for (a, b), (metros, nome) in melhor.items():
        vizinhos[a].append((b, metros, nome))
        vizinhos[b].append((a, metros, nome))

    lugares = {p["nome"]: p["no"] for p in dados["pois"]}
    return Mapa(dados["nomes"], x, y, vizinhos, lugares, dados["credito"])


@dataclass(frozen=True)
class Cobertura:
    """O resultado do Dijkstra multi-fonte, para o mapa inteiro."""

    #: metros até o telecentro mais próximo (``math.inf`` se não alcança)
    distancia: list[float]
    #: índice do telecentro mais próximo de cada cruzamento (-1 se nenhum)
    dono: list[int]
    #: vértice anterior no caminho mais curto (-1 nas fontes)
    anterior: list[int]


def dijkstra_multifonte(mapa: Mapa, fontes: list[int], contador: Contador | None = None) -> Cobertura:
    """Menor distância de *todo* cruzamento ao telecentro mais próximo. O((V + E) log V)."""
    if not fontes:
        raise ValueError("É preciso pelo menos um telecentro.")
    for f in fontes:
        if not 0 <= f < mapa.n:
            raise ValueError(f"Telecentro fora do mapa: cruzamento {f}.")
    c = contador or Contador()
    distancia = [math.inf] * mapa.n
    dono = [-1] * mapa.n
    anterior = [-1] * mapa.n
    heap: list[tuple[float, int]] = []
    for i, f in enumerate(fontes):
        distancia[f] = 0.0
        dono[f] = i
        heapq.heappush(heap, (0.0, f))

    while heap:
        d, v = heapq.heappop(heap)
        if d > distancia[v]:
            continue  # entrada velha: v já foi resolvido por um caminho melhor
        c.conta("resolvidos")
        for u, metros, _ in mapa.vizinhos[v]:
            c.conta("relaxacoes")
            nova = d + metros
            if nova < distancia[u]:
                distancia[u] = nova
                dono[u] = dono[v]
                anterior[u] = v
                heapq.heappush(heap, (nova, u))
    return Cobertura(distancia, dono, anterior)


def caminho_ate_telecentro(cobertura: Cobertura, origem: int) -> list[int]:
    """Reconstrói a rota da origem até o telecentro, seguindo ``anterior``.

    O Dijkstra partiu dos telecentros; andar pelos anteriores a partir da casa já
    dá a rota na ordem certa: casa -> ... -> telecentro.
    """
    if math.isinf(cobertura.distancia[origem]):
        return []
    rota = [origem]
    while cobertura.anterior[rota[-1]] != -1:
        rota.append(cobertura.anterior[rota[-1]])
    return rota


def ruas_da_rota(mapa: Mapa, rota: list[int]) -> list[tuple[str, float]]:
    """Agrupa a rota em trechos por rua: [(nome, metros), ...]."""
    trechos: list[tuple[str, float]] = []
    for a, b in zip(rota, rota[1:]):
        metros, nome = next((m, nm) for u, m, nm in mapa.vizinhos[a] if u == b)
        rua = mapa.nomes_das_ruas[nome] if 0 <= nome < len(mapa.nomes_das_ruas) else ""
        rua = rua or "rua sem nome"
        if trechos and trechos[-1][0] == rua:
            trechos[-1] = (rua, trechos[-1][1] + metros)
        else:
            trechos.append((rua, metros))
    return trechos


def dijkstra_um_par(mapa: Mapa, origem: int, destino: int, contador: Contador | None = None) -> float:
    """Distância de um par só. Existe para comparar: k telecentros = k buscas destas."""
    c = contador or Contador()
    distancia = [math.inf] * mapa.n
    distancia[origem] = 0.0
    heap = [(0.0, origem)]
    while heap:
        d, v = heapq.heappop(heap)
        if d > distancia[v]:
            continue
        c.conta("resolvidos")
        if v == destino:
            return d
        for u, metros, _ in mapa.vizinhos[v]:
            c.conta("relaxacoes")
            if d + metros < distancia[u]:
                distancia[u] = d + metros
                heapq.heappush(heap, (d + metros, u))
    return math.inf


def minutos_a_pe(metros: float, velocidade_m_s: float) -> float:
    if velocidade_m_s <= 0:
        raise ValueError("A velocidade precisa ser positiva.")
    return metros / velocidade_m_s / 60
