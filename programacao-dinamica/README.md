# Planejador do OpenLabs no Telecentro

Entrega da disciplina **Dynamic Programming** (Global Solution 2026.2 · CitizenTech · Engenharia de Software, 2º ano).

<!-- INTEGRANTES:INICIO -->
## Integrantes

| Nome | RM |
|---|---|
| _preencha `entrega/equipe.json` e rode `python empacotar.py`_ | — |
<!-- INTEGRANTES:FIM -->

## Ficha da CitizenTech

| | |
|---|---|
| **Nome** | OpenLabs no Telecentro |
| **Cidade e bairro** | São Paulo. O planejador roda no centro (Paulista ao Centro), onde está o mapa real de ruas; os telecentros do banco ficam na periferia (Jardim Ângela, Cidade Tiradentes, Capão Redondo). |
| **Cidadão beneficiado** | Quem não tem computador nem internet boa em casa e aprende tecnologia no telecentro. Por exemplo, a aposentada que anda devagar, o estudante do ensino médio e o ambulante que só tem o fim da tarde. |
| **Problema, em uma frase** | O tempo de computador no telecentro é curto e disputado. A pessoa não sabe qual telecentro fica mais perto a pé, nem o que estudar no tempo que tem. O monitor não sabe como dividir o computador de atendimento entre quem mais precisa. |
| **Como funciona** | O OpenLabs é um site de labs interativos que roda no navegador dos computadores do telecentro. Este planejador decide três coisas: aonde ir, o que estudar na sessão e quem usa o computador de atendimento. |
| **O que cada parte faz** | Site (labs), banco Oracle (alunos, progresso, avaliações), rede do telecentro (Packet Tracer), API Java. **Esta parte:** os algoritmos de decisão, em Python. |
| **Link do repositório** | https://github.com/CabriniJr/open-labs (pasta `programacao-dinamica/`) |
| **Indicador de impacto** | (1) % de cruzamentos a até 15 min a pé de um telecentro. (2) Pontos de aprendizagem por sessão, comparados à escolha gulosa. (3) Prioridade atendida no computador de atendimento. |
| **ODS conectados** | **4** (educação de qualidade), **10** (redução das desigualdades) e **11** (cidades e comunidades sustentáveis). |

## O que o programa faz

```
python main.py
```

Para cada pessoa simulada, o programa responde quatro perguntas. Cada pergunta usa uma técnica:

| # | Pergunta | Técnica | Algoritmo | Arquivo |
|---|---|---|---|---|
| 1 | Qual telecentro fica mais perto **a pé**, e por quais ruas? | **Grafos** | Dijkstra multi-fonte sobre 1 964 cruzamentos reais | `planejador/mapa.py` |
| 2 | O que falta fazer antes do lab que a pessoa quer? | **Grafos + Memoização** | DAG de pré-requisitos, ordem topológica (Kahn), ancestrais e caminho crítico memoizados | `planejador/trilha.py` |
| 3 | Quais labs cabem nos minutos da sessão, para aprender o máximo? | **Tabulação** | Mochila 0/1 com a tabela inteira e a reconstrução | `planejador/sessao.py` |
| 4 | Quem usa o computador de atendimento ao longo do dia? | **Memoização e Tabulação** | Intervalos ponderados: recursão ingênua, memoizada e tabulada | `planejador/agenda.py` |

O programa também mostra o **indicador de cobertura**: quantos cruzamentos do mapa ficam a até 15 minutos a pé de um telecentro. A conta usa o passo de quem anda devagar (1 m/s).

Trecho da saída:

```
═══ Dona Cida — aposentada, 67 anos, anda devagar ═══

1. Grafos · o telecentro mais perto de Dona Cida
Mora perto de Hospital Sírio-Libanês. Mais perto: Telecentro Bixiga (Bixiga).
1.363 m a pé · 25 min no passo de Dona Cida (0.9 m/s) · 14 trechos de rua.
Caminho: Rua Barata Ribeiro (473 m) → Praça 14 Bis (126 m) → … → Rua Treze de Maio (387 m)

3. Tabulação · o que cabe em 60 min de computador
  • Seis jeitos de crescer: de O(1) a O(2ⁿ), medidos [how-work-grows] — 25 min, 4 pts
  • Como o banco do OpenLabs funciona no telecentro [telecentro-database] — 30 min, 5 pts
Total: 9 pontos em 55 de 60 min.

4. Memoização e Tabulação · o computador de atendimento, um dia
Prioridade somada: 34, com 13 de 24 pedidos.
A regra 'o que termina primeiro' atenderia 14 pedidos, mas só 27 de prioridade — e deixaria sem atendimento: Conceição, Joana.
Trabalho: recursão ingênua 417.427 chamadas · memoizada 49 · tabela 24 células.
```

## Como rodar

O programa precisa do **Python 3.10 ou mais novo** e usa só a biblioteca padrão. Não é preciso instalar nada nem ter internet.

```
python main.py                          # as três pessoas, a cobertura e a agenda
python main.py --aluno Rafa             # só uma pessoa
python main.py --aluno Rafa --sessao 120 --tabela   # outra sessão, com a tabela T[i][t]
python main.py --agenda                 # só o computador de atendimento
python main.py --lugares                # os lugares do mapa que dá para usar nos dados
python benchmark.py                     # a eficiência, contada e cronometrada
python -m unittest discover -s tests -t .   # os 22 testes
```

No Windows, se os acentos saírem quebrados no terminal, use `python -X utf8 main.py`.

Para mudar o cenário, edite os arquivos em `dados/`. Por exemplo: outra pessoa, outro tempo de sessão, outro pedido de computador ou outro pré-requisito. Dados errados são recusados com uma mensagem que diz o motivo. Exemplos: horário `25:00`, lab que requer um lab que não existe, ciclo de pré-requisitos, lugar fora do mapa.

## Os algoritmos

### 1. Grafos: o telecentro mais perto (`mapa.py`)

Cada cruzamento é um vértice. Cada trecho de rua é uma aresta, com o comprimento em metros. A pé, a mão única não vale, então o grafo é não dirigido. Vias expressas ficam de fora.

A menor distância segue a recorrência de Bellman: `dist(v) = min(dist(u) + comprimento(u, v))`, com `dist(telecentro) = 0`. Cada `dist(v)` é um subproblema resolvido uma única vez e reaproveitado por todos os vizinhos. Isso é Programação Dinâmica num grafo. O Dijkstra é a ordem de avaliação que garante que, quando um cruzamento sai do heap, a resposta dele já é final.

**A escolha que importa.** Todos os telecentros entram no heap com distância 0 (**multi-fonte**). Assim, uma única busca responde o telecentro mais perto de **todos** os cruzamentos. A alternativa seria uma busca por par (cruzamento, telecentro). A reconstrução da rota segue o vetor `anterior` até o telecentro.

Complexidade: O((V + E) log V) com heap binário (`heapq`).

### 2. Grafos + Memoização: a trilha de estudo (`trilha.py`)

Os 17 labs do catálogo formam um **DAG**. Uma aresta `A → B` quer dizer "faça A antes de B". Na carga, o programa recusa pré-requisito inexistente, lab repetido e ciclo (Kahn não consegue esvaziar o grafo).

- `antes(v) = ⋃ (antes(u) ∪ {u})` lista todos os pré-requisitos, diretos e indiretos. Com o que já foi concluído, dá os **minutos que faltam** até liberar o lab.
- `critico(v) = minutos(v) + max(critico(u))` é a cadeia mais longa de pré-requisitos em minutos, com a reconstrução. O mesmo valor sai de duas formas: memoizado (de cima para baixo) e tabulado em ordem topológica (`critico_tabulado`). Os testes conferem que as duas concordam.
- `liberados(concluídos)` lista o que dá para fazer hoje. Essa lista alimenta a mochila.

**Por que memoizar.** Sem memória, um ancestral é recalculado uma vez para cada caminho que chega até ele. Num DAG, o número de caminhos pode crescer exponencialmente. Com memória, cada lab é resolvido uma vez: O(V + E).

### 3. Tabulação: o que cabe na sessão (`sessao.py`)

É a mochila 0/1. A capacidade é o tempo de computador, o peso de cada lab são os minutos e o valor são os pontos (objetivos de aprendizagem).

```
T[0][t] = 0
T[i][t] = max( T[i-1][t],  pontos(i) + T[i-1][t - minutos(i)] )   se minutos(i) ≤ t
```

A tabela de (n + 1) × (tempo + 1) células é preenchida linha a linha, e `--tabela` mostra a tabela inteira. Na reconstrução, se `T[i][t] ≠ T[i-1][t]`, o lab `i` entrou. O programa tem mais três versões da mesma pergunta, para comparar:

- `mochila_memoizada`: a mesma recorrência, de cima para baixo;
- `mochila_forca_bruta`: testa todos os 2ⁿ subconjuntos e serve para conferir;
- `mochila_gulosa`: escolhe por pontos por minuto. É rápida, mas erra: na sessão de 90 min do Rafa, faz 13 pontos em vez de 14.

Complexidade: O(n · tempo) de tempo e de memória.

### 4. Memoização e Tabulação: o computador de atendimento (`agenda.py`)

Os pedidos de um dia se sobrepõem, e cada um tem uma prioridade. Serviço público vale 5, emprego 4, curso 3, estudo 2 e lazer 1. O programa escolhe os pedidos que não se sobrepõem e somam a maior prioridade: é o problema dos **intervalos ponderados**.

Com os pedidos em ordem de fim, `p(j)` é o último pedido que termina até o início de `j`. Ele sai por busca binária (`bisect`).

```
M(0) = 0
M(j) = max( M(j-1),  prioridade(j) + M(p(j)) )
```

O mesmo problema tem três implementações, e os testes conferem as três contra a força bruta em 40 dias sorteados:

| versão | como | custo |
|---|---|---|
| `ingenua` | a recorrência direta | exponencial: as chamadas seguem Fibonacci |
| `memoizada` | a mesma recursão, com dicionário | 2n + 1 chamadas |
| `tabulada` | `M[0..n]` de baixo para cima, sem recursão, com a reconstrução | n células |

A regra gulosa "o que termina primeiro" é ótima para **contar** pedidos, mas não para a prioridade. No dia de exemplo, ela atende 14 pedidos e soma 27. A PD atende 13 e soma 34, e a gulosa deixaria sem atendimento duas pessoas que iam resolver serviço público.

## Eficiência

Saída de `python benchmark.py` numa máquina da equipe. As contagens são exatas e iguais em qualquer máquina. Os tempos mudam de computador para computador, e o que vale comparar é a proporção entre eles.

### Agenda: intervalos ponderados (memoização × tabulação)

| pedidos | ingênua: chamadas | ingênua: tempo | memoizada: chamadas | memoizada: tempo | tabulada: células | tabulada: tempo |
|---:|---:|---:|---:|---:|---:|---:|
| 10 | 287 | 0.13 ms | 21 | 0.02 ms | 10 | 0.01 ms |
| 15 | 3.193 | 0.71 ms | 31 | 0.01 ms | 15 | 0.01 ms |
| 20 | 35.421 | 8.67 ms | 41 | 0.01 ms | 20 | 0.01 ms |
| 25 | 392.835 | 92.07 ms | 51 | 0.03 ms | 25 | 0.02 ms |
| 30 | — | — | 61 | 0.03 ms | 30 | 0.02 ms |
| 1.000 | — | — | 2.001 | 1.38 ms | 1.000 | 0.40 ms |
| 5.000 | — | — | 10.001 | 3.93 ms | 5.000 | 2.14 ms |

### Sessão: mochila 0/1 (tabulação × força bruta), sessão de 90 min

| labs | força bruta: subconjuntos | força bruta: tempo | tabela: células | tabela: tempo |
|---:|---:|---:|---:|---:|
| 8 | 256 | 0.20 ms | 728 | 0.11 ms |
| 12 | 4.096 | 2.46 ms | 1.092 | 0.17 ms |
| 16 | 65.536 | 40.67 ms | 1.456 | 0.23 ms |
| 18 | 262.144 | 0.2 s | 1.638 | 0.26 ms |
| 40 | 1.099.511.627.776 | — | 3.640 | 0.58 ms |
| 200 | 2^200 | — | 18.200 | 2.97 ms |

### Trilha: pré-requisitos com caminhos que se repetem

| diamantes | caminhos até o último | sem memória: chamadas | com memória: chamadas |
|---:|---:|---:|---:|
| 4 | 16 | 61 | 17 |
| 8 | 256 | 1.021 | 33 |
| 12 | 4.096 | 16.381 | 49 |
| 16 | 65.536 | 262.141 | 65 |

### Mapa: telecentro mais perto de todos os cruzamentos

| estratégia | cruzamentos resolvidos | tempo |
|---|---:|---:|
| uma busca de um par por telecentro, para os 1.964 cruzamentos | 6.495.144 | ≈ 7.6 s |
| uma busca multi-fonte (todos os telecentros com distância 0) | 1.964 | 2.71 ms |

## Dados e de onde vieram

Nenhum dado pessoal real foi usado.

| arquivo | o que é | origem |
|---|---|---|
| `dados/sao-paulo.json` | 1 964 cruzamentos e as ruas do centro de São Paulo | **real**: © OpenStreetMap contributors, licença ODbL (https://www.openstreetmap.org/copyright). Extraído uma vez pelo script `scripts/osm-mapa-cidade.py` do repositório. |
| `dados/labs.json` | os 17 labs, com minutos, pontos e pré-requisitos | os títulos são o catálogo **real** do OpenLabs. Os minutos são os mesmos do banco da GS de Database Design. Pontos e pré-requisitos são estimativa da equipe. |
| `dados/telecentros.json` | 4 telecentros e 3 pessoas | **simulado**. Os telecentros estão junto a lugares conhecidos do mapa, mas não existem nesses endereços. As pessoas são fictícias. |
| `dados/reservas.json` | 24 pedidos de um dia para o computador de atendimento | **simulado**. As prioridades são uma regra proposta pela equipe. |

No repositório, o mapa não é copiado para `dados/`. O programa lê o mapa direto de `packages/algo-domain/src/mapa-real/`, o mesmo arquivo que o lab *Shortest paths* do site usa. O ZIP da entrega leva uma cópia.

## Limites, ditos com franqueza

- **A sessão escolhe só entre os labs já liberados.** Se a pessoa termina um lab no meio da sessão e isso libera outro, o planejador não aproveita. Para aproveitar, seria preciso uma mochila com precedência, que é um problema mais difícil.
- **A pé, todas as ruas valem o mesmo.** O programa não conhece calçada ruim, ladeira, iluminação ou travessia perigosa. Com esses dados, bastaria trocar o comprimento da aresta por um custo de acessibilidade, e o algoritmo continuaria o mesmo.
- **O computador de atendimento é um só.** Com vários computadores, o problema vira agendamento em várias máquinas, e a recorrência de uma linha não serve mais.
- **Os pontos de cada lab são estimativas.** Com o banco em uso, eles podem vir das notas reais das avaliações (`T_TENTATIVA`).

## As outras partes da mesma CitizenTech

- **Site:** três labs mostram estes algoritmos em animação. *The table that remembers* (`/labs/knapsack-session/`) é **a mesma mochila da sessão**, com o mesmo catálogo: a tabela enche na tela, cada célula explica a própria conta, e no cenário do Rafa também dá 14 contra 13. *Shortest paths on the real streets of São Paulo* usa o mesmo mapa e o mesmo Dijkstra. *Greedy, and the case it misses* mostra o guloso contra a tabela, com moedas.
- **Database Design:** `database/` tem as tabelas `T_LAB` (com `nr_minutos`), `T_PROGRESSO` (o que cada aluno concluiu) e `T_TELECENTRO`. São as entradas deste planejador num telecentro de verdade.
- **Network Architect:** a rede do telecentro em Packet Tracer, onde os computadores públicos rodam o site.

## Uso de IA

O código foi escrito com apoio de IA (Claude Code). Os pedidos estão em `prompts.md`. A equipe revisou o código e precisa saber explicar cada linha.

## Estrutura

```
main.py            a demonstração de ponta a ponta
benchmark.py       eficiência contada e cronometrada
empacotar.py       gera o ZIP da entrega (só no repositório)
planejador/
  mapa.py          grafos: Dijkstra multi-fonte, rota, cobertura
  trilha.py        grafos + memoização: DAG, Kahn, ancestrais, caminho crítico
  sessao.py        tabulação: mochila 0/1 (+ memoizada, força bruta e gulosa)
  agenda.py        memoização e tabulação: intervalos ponderados (+ ingênua e gulosa)
  telecentro.py    telecentros e pessoas, ligados ao mapa
  medidor.py       contador de operações e cronômetro
dados/             os dados de entrada (ver a tabela acima)
tests/             22 testes (unittest), cada PD conferida contra força bruta
```
