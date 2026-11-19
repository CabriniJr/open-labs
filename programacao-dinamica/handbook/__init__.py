"""O handbook de algoritmos do OpenLabs, em Python.

Cada módulo é um lab do handbook *Algorithms* do OpenLabs (https://cabrinijr.github.io/open-labs/handbooks/algorithms/),
com os mesmos dados, os mesmos cenários e os mesmos números que o lab mostra na
tela. O lab ensina vendo; este código ensina lendo e rodando. Os dois são
gratuitos.

- ``crescimento`` — fase 3, *How work grows*: a soma de subconjunto que custa 2ⁿ,
  e a tabela que a resolve em n × alvo (Memoização e Tabulação).
- ``caminho``     — fase 6, *Shortest paths*: Dijkstra nas ruas reais de São Paulo,
  e a melhor ordem de várias paradas por PD sobre subconjuntos (Grafos).
- ``troco``       — fase 7, *Greedy change*: o guloso que erra o troco, e a
  tabela que nunca erra (Tabulação e Memoização).
- ``mochila``     — fase 8, *The table that remembers*: o que cabe numa sessão de
  estudo no telecentro (Tabulação e Memoização).
"""

from __future__ import annotations

from dataclasses import dataclass

SITE = "https://cabrinijr.github.io/open-labs"
LOCAL = "http://localhost:8000"


@dataclass(frozen=True)
class Aula:
    id: str
    fase: int
    titulo: str
    lab: str
    tecnicas: str
    pergunta: str

    def url(self, local: bool = False) -> str:
        return f"{LOCAL if local else SITE}/labs/{self.lab}/"


AULAS: tuple[Aula, ...] = (
    Aula("crescimento", 3, "Como o trabalho cresce", "how-work-grows", "Memoização e Tabulação",
         "Por que tentar todos os subconjuntos custa 2ⁿ, e como uma tabela derruba isso para n × alvo?"),
    Aula("caminho", 6, "Caminhos mínimos nas ruas reais de São Paulo", "shortest-path", "Grafos (Dijkstra) + PD sobre subconjuntos",
         "Qual o caminho mais rápido entre dois pontos do centro, e em que ordem visitar várias paradas?"),
    Aula("troco", 7, "O guloso, e o caso que ele erra", "greedy-change", "Tabulação e Memoização",
         "Quando pegar sempre a maior moeda dá o troco com menos moedas, e quando não dá?"),
    Aula("mochila", 8, "A tabela que lembra: o que cabe numa sessão", "knapsack-session", "Tabulação e Memoização",
         "Com 90 minutos de computador no telecentro, quais labs estudar para aprender o máximo?"),
)

HANDBOOK = f"{SITE}/handbooks/algorithms/"


def aula(id_: str) -> Aula:
    for a in AULAS:
        if a.id == id_:
            return a
    raise KeyError(f"aula desconhecida: {id_}. As aulas são: {', '.join(a.id for a in AULAS)}")
