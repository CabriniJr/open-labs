"""Planejador do OpenLabs no Telecentro.

Três decisões que o telecentro toma todo dia, cada uma com uma técnica de
Programação Dinâmica:

- ``mapa``    — Grafos: qual telecentro fica mais perto a pé (Dijkstra multi-fonte
                nas ruas reais do centro de São Paulo).
- ``trilha``  — Grafos + Memoização: o que falta para liberar um lab (DAG de
                pré-requisitos, ordem topológica e caminho crítico).
- ``agenda``  — Memoização e Tabulação: quem usa o computador de atendimento
                (intervalos ponderados, com a recursão ingênua contada ao lado).
- ``sessao``  — Tabulação: quais labs cabem nos minutos da sessão (mochila 0/1
                com a tabela inteira e a reconstrução).
"""
