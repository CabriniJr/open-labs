"""Gera a base ``dados/sessoes_telecentro.csv`` — uma linha por sessão de estudo.

    python gerar_dados.py

**A base é simulada, e o processo que a gera está todo aqui.** Nenhum dado pessoal
real foi usado. Duas partes vêm de fontes reais:

- a **distância a pé** de cada pessoa até o telecentro mais próximo é calculada nas
  ruas de verdade do centro de São Paulo (OpenStreetMap, ODbL), pelo mesmo
  Dijkstra multi-fonte do planejador de Programação Dinâmica
  (``../programacao-dinamica/planejador/mapa.py``);
- os **labs** e os seus minutos estimados são o catálogo real do OpenLabs
  (``../programacao-dinamica/dados/labs.json``).

O resto — idade, internet em casa, período, tempo no lab, uso do showcase, nota e
retorno — é sorteado com semente fixa a partir das regras abaixo, escritas pela
equipe como hipóteses plausíveis. O notebook tenta **recuperar** essas regras sem
conhecê-las, e diz o que um modelo consegue e não consegue afirmar a partir delas.

Mesma semente, mesmo CSV: o teste de ``empacotar.py`` confere.
"""

from __future__ import annotations

import csv
import json
import math
import random
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI.parent / "programacao-dinamica"))

from planejador.mapa import carregar_mapa, dijkstra_multifonte  # noqa: E402
from planejador.telecentro import carregar_telecentros  # noqa: E402

SEMENTE = 2026
PESSOAS = 420
DESTINO = AQUI / "dados" / "sessoes_telecentro.csv"
LABS = AQUI.parent / "programacao-dinamica" / "dados" / "labs.json"

COLUNAS = [
    "id_sessao", "id_aluno", "telecentro", "idade", "internet_em_casa", "distancia_m",
    "minutos_caminhada", "periodo", "lab", "handbook", "minutos_estimados",
    "labs_concluidos_antes", "minutos_no_lab", "usou_showcase", "nota", "voltou_em_7_dias",
]


def velocidade(idade: int) -> float:
    """m/s: quem é mais velho anda mais devagar (1,35 m/s aos 20, ~0,95 aos 75)."""
    return max(0.8, 1.45 - 0.0075 * max(idade - 15, 0))


def sigmoide(z: float) -> float:
    return 1 / (1 + math.exp(-z))


def gerar() -> list[dict]:
    r = random.Random(SEMENTE)
    mapa = carregar_mapa()
    telecentros, _ = carregar_telecentros(mapa)
    cobertura = dijkstra_multifonte(mapa, [t.no for t in telecentros])
    alcancaveis = [v for v in range(mapa.n) if cobertura.distancia[v] < math.inf]
    labs = json.loads(LABS.read_text(encoding="utf-8"))["labs"]

    linhas: list[dict] = []
    id_sessao = 0
    for id_aluno in range(1, PESSOAS + 1):
        casa = r.choice(alcancaveis)
        distancia = cobertura.distancia[casa]
        telecentro = telecentros[cobertura.dono[casa]].nome
        idade = int(min(78, max(14, r.gauss(36, 16))))
        # Internet boa em casa é menos comum entre os mais velhos.
        internet = 1 if r.random() < 0.62 - 0.006 * max(idade - 25, 0) else 0
        caminhada = distancia / velocidade(idade) / 60
        periodo = r.choices(["manha", "tarde", "noite"], weights=[0.35, 0.4, 0.25])[0]
        engajamento = r.gauss(0, 1)  # traço que o dado não mostra: motivação

        # Quem mora longe volta menos, então faz menos sessões.
        sessoes = 1 + sum(r.random() < sigmoide(1.1 - 0.07 * caminhada + 0.5 * engajamento) for _ in range(4))
        feitos = 0
        for _ in range(sessoes):
            id_sessao += 1
            lab = r.choice(labs)
            showcase = 1 if r.random() < 0.55 + 0.1 * engajamento else 0
            tempo = max(5.0, r.gauss(lab["minutos"] * (1.0 + 0.12 * engajamento), lab["minutos"] * 0.25))
            ritmo = min(tempo / lab["minutos"], 1.6)

            # A regra da nota (alvo da regressão linear).
            nota = (
                4.2
                + 0.32 * min(feitos, 8)
                + 1.1 * showcase
                + 2.2 * (ritmo - 1.0)
                - 0.018 * (idade - 36)
                + 0.5 * internet
                + 0.35 * engajamento
                + r.gauss(0, 1.1)
            )
            nota = round(min(10.0, max(0.0, nota)), 1)

            # A regra do retorno (alvo da regressão logística).
            z = (
                1.15
                - 0.085 * caminhada
                + 0.28 * (nota - 6)
                - 0.45 * (periodo == "noite")
                - 0.35 * internet
                + 0.6 * engajamento
            )
            voltou = 1 if r.random() < sigmoide(z) else 0

            linhas.append(
                {
                    "id_sessao": id_sessao,
                    "id_aluno": id_aluno,
                    "telecentro": telecentro,
                    "idade": idade,
                    "internet_em_casa": internet,
                    "distancia_m": round(distancia),
                    "minutos_caminhada": round(caminhada, 1),
                    "periodo": periodo,
                    "lab": lab["slug"],
                    "handbook": lab["handbook"],
                    "minutos_estimados": lab["minutos"],
                    "labs_concluidos_antes": feitos,
                    "minutos_no_lab": round(tempo, 1),
                    "usou_showcase": showcase,
                    "nota": nota,
                    "voltou_em_7_dias": voltou,
                }
            )
            if nota >= 6:
                feitos += 1

    # Problemas de dado de verdade, para a preparação ter o que fazer: o cadastro
    # sem idade (~3%) e o cronômetro que ficou ligado (~1%).
    for linha in linhas:
        if r.random() < 0.03:
            linha["idade"] = ""
        if r.random() < 0.01:
            linha["minutos_no_lab"] = round(linha["minutos_no_lab"] + r.uniform(180, 600), 1)
    return linhas


def principal() -> None:
    linhas = gerar()
    DESTINO.parent.mkdir(exist_ok=True)
    with DESTINO.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLUNAS, lineterminator="\n")
        w.writeheader()
        w.writerows(linhas)
    voltou = sum(l["voltou_em_7_dias"] for l in linhas) / len(linhas)
    print(f"{len(linhas)} sessões de {PESSOAS} pessoas → {DESTINO.name} · {voltou:.0%} voltaram em 7 dias")


if __name__ == "__main__":
    principal()
