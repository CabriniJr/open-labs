# Prompts usados (IA como copiloto)

Os combinados da GS pedem que a equipe registre os prompts usados com IA. Este arquivo registra os desta parte. A ferramenta foi o Claude Code, assistente de programação da Anthropic, usado dentro do repositório do OpenLabs.

## 11/11/2026: o planejador

**Pedido da equipe:**

> vamos seguir o desenvolvimento e melhorias da plataforma, também vamos fazer os entregaveis da gs relacionados, foco agora é algoritmos

A IA leu o enunciado da GS e propôs três cenários para a disciplina de Dynamic Programming. A equipe escolheu este:

> Planejador do telecentro. Grafos: rota pelas ruas reais de SP até o telecentro mais próximo (Dijkstra) + ordem dos labs por pré-requisito (DAG, memoizado). Memoização: agenda dos computadores com prioridade (intervalos ponderados). Tabulação: quais labs cabem numa sessão de X minutos (mochila 0/1).

**O que a IA fez:** escreveu o código de `planejador/`, os testes, o `benchmark.py`, o `empacotar.py`, os dados simulados e este README. Reaproveitou o mapa do OpenStreetMap que o repositório já tinha.

**O que a equipe precisa conferir e saber explicar:**

- [ ] as quatro recorrências (seção "Os algoritmos" do README) e por que cada uma é Programação Dinâmica;
- [ ] por que a busca multi-fonte responde todos os cruzamentos com uma busca só;
- [ ] por que a recursão ingênua da agenda segue Fibonacci, e a memoizada faz 2n + 1 chamadas;
- [ ] como a reconstrução da mochila sabe quais labs entraram;
- [ ] onde a regra gulosa erra, nos dois casos;
- [ ] os pontos e pré-requisitos de `dados/labs.json` e as prioridades de `dados/reservas.json`, que são escolhas da equipe.
