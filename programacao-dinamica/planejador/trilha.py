"""Grafos + Memoização — o que falta para liberar um lab.

Os labs do OpenLabs formam um grafo dirigido acíclico (DAG): uma aresta
``A -> B`` quer dizer "faça A antes de B". Três perguntas, três recorrências:

1. **O que vem antes** (todos os pré-requisitos, diretos e indiretos)::

       antes(v) = ⋃ ( antes(u) ∪ {u} )   para cada u que v requer

2. **Caminho crítico** — a cadeia de pré-requisitos mais longa em minutos, que é
   o mínimo de estudo até terminar v mesmo que ninguém atrapalhe::

       critico(v) = minutos(v) + max( critico(u) )   (0 se v não requer nada)

3. **Ordem de estudo** — a ordem topológica (Kahn), que é também a ordem em que a
   versão tabulada pode preencher ``critico`` sem recursão.

Sem memória, ``antes`` e ``critico`` recalculam o mesmo ancestral uma vez por
caminho que chega a ele — e o número de caminhos num DAG cresce exponencialmente
(ver ``diamantes`` nos testes). Com memória, cada lab é resolvido uma vez:
O(V + E) chamadas.
"""

from __future__ import annotations

import heapq
import json
from dataclasses import dataclass
from pathlib import Path

from .medidor import Contador

DADOS = Path(__file__).resolve().parent.parent / "dados" / "labs.json"


@dataclass(frozen=True)
class Lab:
    slug: str
    titulo: str
    handbook: str
    minutos: int
    pontos: int
    requer: tuple[str, ...]


class Trilha:
    """O catálogo de labs como DAG, validado na construção."""

    def __init__(self, labs: list[Lab]):
        self.labs: dict[str, Lab] = {}
        for lab in labs:
            if lab.slug in self.labs:
                raise ValueError(f"Lab repetido: {lab.slug}.")
            if lab.minutos <= 0:
                raise ValueError(f"{lab.slug}: minutos precisa ser positivo (veio {lab.minutos}).")
            if lab.pontos < 0:
                raise ValueError(f"{lab.slug}: pontos não pode ser negativo (veio {lab.pontos}).")
            self.labs[lab.slug] = lab
        for lab in labs:
            for r in lab.requer:
                if r not in self.labs:
                    raise ValueError(f"{lab.slug} requer {r!r}, que não está no catálogo.")
                if r == lab.slug:
                    raise ValueError(f"{lab.slug} requer a si mesmo.")
        self.ordem = self._ordem_topologica()

    # -- Grafo -----------------------------------------------------------------

    def _ordem_topologica(self) -> list[str]:
        """Kahn: tira quem não tem pré-requisito pendente. Empate em ordem alfabética,
        para a ordem ser a mesma em toda execução."""
        faltam = {s: len(lab.requer) for s, lab in self.labs.items()}
        libera: dict[str, list[str]] = {s: [] for s in self.labs}
        for s, lab in self.labs.items():
            for r in lab.requer:
                libera[r].append(s)
        prontos = [s for s, k in faltam.items() if k == 0]
        heapq.heapify(prontos)
        ordem: list[str] = []
        while prontos:
            s = heapq.heappop(prontos)
            ordem.append(s)
            for t in libera[s]:
                faltam[t] -= 1
                if faltam[t] == 0:
                    heapq.heappush(prontos, t)
        if len(ordem) != len(self.labs):
            presos = sorted(s for s, k in faltam.items() if k > 0)
            raise ValueError("Os pré-requisitos formam um ciclo entre: " + ", ".join(presos) + ".")
        return ordem

    # -- 1. O que vem antes (memoizado) ------------------------------------------

    def antes(self, slug: str, contador: Contador | None = None) -> frozenset[str]:
        c = contador or Contador()
        memo: dict[str, frozenset[str]] = {}

        def resolve(v: str) -> frozenset[str]:
            c.conta("chamadas")
            if v in memo:
                c.conta("acertos")
                return memo[v]
            acc: set[str] = set()
            for u in self.labs[v].requer:
                acc |= resolve(u)
                acc.add(u)
            memo[v] = frozenset(acc)
            return memo[v]

        self._existe(slug)
        return resolve(slug)

    def antes_sem_memoria(self, slug: str, contador: Contador | None = None) -> frozenset[str]:
        """A mesma recorrência, sem memória — só para contar o desperdício."""
        c = contador or Contador()

        def resolve(v: str) -> frozenset[str]:
            c.conta("chamadas")
            acc: set[str] = set()
            for u in self.labs[v].requer:
                acc |= resolve(u)
                acc.add(u)
            return frozenset(acc)

        self._existe(slug)
        return resolve(slug)

    def minutos_para_liberar(self, slug: str, concluidos: set[str]) -> int:
        """Quantos minutos de pré-requisitos ainda faltam antes de poder abrir ``slug``."""
        return sum(self.labs[u].minutos for u in self.antes(slug) - concluidos)

    # -- 2. Caminho crítico (memoizado e tabulado) -------------------------------

    def critico(self, slug: str, contador: Contador | None = None) -> tuple[int, list[str]]:
        """(minutos, cadeia) da cadeia de pré-requisitos mais longa que termina em ``slug``."""
        c = contador or Contador()
        memo: dict[str, tuple[int, str | None]] = {}

        def resolve(v: str) -> int:
            c.conta("chamadas")
            if v in memo:
                c.conta("acertos")
                return memo[v][0]
            melhor, de = 0, None
            for u in sorted(self.labs[v].requer):
                m = resolve(u)
                if m > melhor:
                    melhor, de = m, u
            memo[v] = (melhor + self.labs[v].minutos, de)
            return memo[v][0]

        self._existe(slug)
        total = resolve(slug)
        cadeia = [slug]
        while (de := memo[cadeia[-1]][1]) is not None:
            cadeia.append(de)
        return total, cadeia[::-1]

    def critico_tabulado(self) -> dict[str, int]:
        """A mesma recorrência preenchida em ordem topológica, sem recursão."""
        tabela: dict[str, int] = {}
        for v in self.ordem:  # todo pré-requisito de v já está na tabela
            lab = self.labs[v]
            tabela[v] = lab.minutos + max((tabela[u] for u in lab.requer), default=0)
        return tabela

    # -- 3. O que dá para fazer hoje ---------------------------------------------

    def liberados(self, concluidos: set[str]) -> list[Lab]:
        """Labs ainda não feitos cujos pré-requisitos diretos estão todos concluídos."""
        for s in concluidos:
            self._existe(s)
        return [
            self.labs[s]
            for s in self.ordem
            if s not in concluidos and all(r in concluidos for r in self.labs[s].requer)
        ]

    def _existe(self, slug: str) -> None:
        if slug not in self.labs:
            raise KeyError(f"Lab desconhecido: {slug!r}.")


def carregar_trilha(caminho: Path = DADOS) -> Trilha:
    dados = json.loads(caminho.read_text(encoding="utf-8"))
    return Trilha(
        [
            Lab(l["slug"], l["titulo"], l["handbook"], l["minutos"], l["pontos"], tuple(l["requer"]))
            for l in dados["labs"]
        ]
    )
