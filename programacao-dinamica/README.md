# OpenLabs · o handbook de algoritmos, em Python

Entrega da disciplina **Dynamic Programming** (Global Solution 2026.2 · CitizenTech · Engenharia de Software, 2º ano).

<!-- INTEGRANTES:INICIO -->
## Integrantes

| Nome | RM |
|---|---|
| _preencha `entrega/equipe.json` e rode `python empacotar.py`_ | — |
<!-- INTEGRANTES:FIM -->

## O que é esta entrega, em uma frase

**É o handbook *Algorithms* do OpenLabs em código Python**: os mesmos algoritmos, os mesmos dados e os mesmos números que os labs gráficos do OpenLabs mostram, para estudar lendo, rodando e mudando. Tudo é gratuito, roda no computador do aluno e funciona sem internet.

| | |
|---|---|
| O handbook no ar | https://cabrinijr.github.io/open-labs/handbooks/algorithms/ |
| O mesmo handbook no seu computador | `python main.py --servir` → http://localhost:8000/handbooks/algorithms/ (sem internet) |
| O código | `handbook/` (uma aula por lab) · `python main.py` |

## Ficha da CitizenTech

| | |
|---|---|
| **Nome da CitizenTech** | OpenLabs no Telecentro |
| **Cidade e bairro** | São Paulo (SP), Jardim Ângela, no Telecentro Jardim Ângela |
| **Cidadão beneficiado** | Quem não tem computador nem internet em casa e quer aprender tecnologia: estudantes de escola pública, jovens e adultos da comunidade, no computador público do telecentro. |
| **Problema, em uma frase** | O ensino de tecnologia gratuito e prático não chega a quem mais precisa dele. |
| **Como funciona** | O OpenLabs é uma plataforma gratuita de handbooks que rodam: cada tema vira labs com animação (*showcase*) e simulação, no navegador, inclusive no servidor local do telecentro e sem internet. |
| **O que cada parte faz** | Rede do telecentro (Packet Tracer), banco Oracle (alunos, labs, progresso), API Java, análise de dados (quem volta ao telecentro). **Esta parte:** o handbook de algoritmos, em código Python que acompanha os labs. |
| **Link do repositório** | https://github.com/CabriniJr/open-labs (pasta `programacao-dinamica/`) |
| **Indicador de impacto** | Labs concluídos por aluno do telecentro; aulas do handbook rodadas sem internet; o aluno consegue mudar o código e prever o resultado do lab. |
| **ODS conectados** | **4** (educação de qualidade: material gratuito e prático), **9** (inovação e infraestrutura: roda em computador simples e sem internet), **10** (redução das desigualdades: o mesmo curso para quem não pode pagar) e **11** (cidades e comunidades: o telecentro do bairro como sala de aula). |

## A necessidade da CitizenTech que este código resolve

Um lab do OpenLabs mostra o algoritmo **acontecendo**: a tabela enchendo, a fila do Dijkstra crescendo pelas ruas, o guloso errando o troco. Mas quem estuda precisa também do **código**, para ler, rodar e mudar, e precisa que esse código dê **exatamente** o que o lab mostrou. Senão, o aluno aprende uma coisa na tela e outra no código.

Esta entrega é esse código. Cada aula é um lab do handbook, com os mesmos dados e cenários, e um teste confere número por número que o Python dá o que o lab dá. Ela também resolve o acesso: `python main.py --servir` sobe o OpenLabs inteiro no computador, só com Python, sem internet, como num telecentro.

## Como rodar (Python 3.10 ou mais novo, só a biblioteca padrão)

```
python main.py                      # o índice: as aulas e os links dos labs
python main.py todas                # as quatro aulas
python main.py mochila              # uma aula: crescimento, caminho, troco ou mochila
python main.py mochila --passo      # com o passo a passo (a tabela inteira, a fila do Dijkstra)
python main.py mochila --abrir      # e abre o lab gráfico da aula no navegador
python main.py --servir             # o OpenLabs inteiro em http://localhost:8000, sem internet
python benchmark.py                 # a eficiência, contada e cronometrada
python -m unittest discover -s tests -t .   # 21 testes, incluindo a conferência contra os labs
```

Cada aula tem as suas opções:

```
python main.py crescimento --n 16
python main.py caminho --cenario maze           # short, across, aimed, maze, tour, errands
python main.py troco --sistema pre-decimal      # brl, pre-decimal, toy, no-one (e --valor)
python main.py mochila --cenario trap --sessao 120   # rafa, trap, cida
```

## As aulas: cada uma é um lab do handbook

| Aula | Fase do handbook e lab | Técnica | Pergunta | Arquivo |
|---|---|---|---|---|
| `crescimento` | 3 · [How work grows](https://cabrinijr.github.io/open-labs/labs/how-work-grows/) | **Memoização e Tabulação** | Por que tentar todos os subconjuntos custa 2ⁿ, e como uma tabela troca isso por n × alvo? | `handbook/crescimento.py` |
| `caminho` | 6 · [Shortest paths](https://cabrinijr.github.io/open-labs/labs/shortest-path/) | **Grafos** + PD sobre subconjuntos | Qual o caminho mais rápido nas ruas reais de São Paulo, e em que ordem visitar várias paradas? | `handbook/caminho.py` |
| `troco` | 7 · [Greedy change](https://cabrinijr.github.io/open-labs/labs/greedy-change/) | **Tabulação e Memoização** | Quando pegar sempre a maior moeda dá o troco com menos moedas, e quando não dá? | `handbook/troco.py` |
| `mochila` | 8 · [The table that remembers](https://cabrinijr.github.io/open-labs/labs/knapsack-session/) | **Tabulação e Memoização** | Com 90 minutos de computador, quais labs estudar para aprender o máximo? | `handbook/mochila.py` |

## Os algoritmos

### 1. Soma de subconjunto (`crescimento.py`) — Memoização e Tabulação

O lab *How work grows* mede a classe exponencial com a soma de subconjunto: tentar os 2ⁿ subconjuntos. A entrada é a do lab, sorteada com o mesmo gerador (mulberry32, portado bit a bit em `semente.py`).

```
pode(i, s) = verdadeiro se s = 0;  falso se i = n
pode(i, s) = pode(i+1, s)  ou  pode(i+1, s − v[i])      (o segundo, se v[i] ≤ s)
```

- **Memoização:** `memoizada` guarda cada `(i, s)` e resolve cada um uma vez.
- **Tabulação:** `tabela` preenche `T[i][s]` linha por linha e reconstrói os itens andando de baixo para cima.
- **A lição:** a tabela custa n × (alvo + 1). Com poucos itens a força bruta ainda ganha; a cada item ela dobra. Com n = 20 são 1 048 576 subconjuntos contra 4 636 estados memoizados. O custo da PD cresce com o tamanho dos números, não com 2ⁿ: ela é pseudo-polinomial.

### 2. Caminhos mínimos (`caminho.py`) — Grafos

O mapa é o do lab, o centro de São Paulo tirado do OpenStreetMap: 1 964 cruzamentos (vértices), 3 689 trechos de rua (arestas dirigidas, porque há mão única) e o peso em décimos de segundo pela velocidade da via.

- **Dijkstra** com fila de prioridade (`heapq`) e o mesmo desempate do lab (quem entrou primeiro sai primeiro). Fecha sempre o cruzamento aberto de menor distância, e essa distância já é a definitiva. Devolve a rota rua por rua e a ordem em que os cruzamentos foram fechados (`--passo`).
- **Várias paradas, por PD sobre subconjuntos (Held–Karp):** `melhor(S, j)` = o menor tempo saindo da origem, passando por todas as paradas de `S` e terminando em `j`. São 2ᵏ × k estados em vez de (k − 1)! ordens. O lab tenta as ordens; a aula mostra que a PD chega à mesma resposta (o teste confere nos seis cenários do lab).

### 3. Troco (`troco.py`) — Tabulação e Memoização

```
minimo[0] = 0
minimo[v] = 1 + min(minimo[v − m])   para cada moeda m ≤ v
```

- **Guloso:** a maior moeda que cabe. Ótimo nas moedas do real; com {1, 3, 4} e troco 6, dá 4 + 1 + 1 quando 3 + 3 existia. Nas moedas inglesas de antes de 1971, erra no 48 (30 + 12 + 6 contra 24 + 24).
- **Tabulação:** `tabela`/`otimo` resolve todos os valores de 0 até o pedido e reconstrói pela última moeda de cada valor. Custa valor × moedas.
- **Memoização:** `memoizado`, a mesma recorrência de cima para baixo. `sem_memoria` mostra o que acontece sem guardar: para troco 30, 2 550 408 chamadas contra 31 valores resolvidos.
- `menor_contraexemplo` acha o primeiro valor em que o guloso erra em qualquer sistema de moedas.

### 4. Mochila 0/1 da sessão (`mochila.py`) — Tabulação e Memoização

```
T[0][c] = 0
T[i][c] = max( T[i−1][c],  pontos(i) + T[i−1][c − colunas(i)] )   se o lab i cabe
```

- O catálogo é o do lab, com labs reais do OpenLabs e o tempo em blocos de 5 minutos.
- **Tabulação:** `tabulada` preenche a tabela e reconstrói o plano (se a célula mudou em relação à de cima, o lab entrou). `--passo` imprime a tabela inteira com as células da reconstrução marcadas.
- **Memoização:** `memoizada` e `sem_memoria` contam as chamadas exatamente como o lab conta.
- **A lição:** no cenário da Rafa (90 minutos), a gulosa por pontos por minuto faz 13 pontos e a tabela faz 14. A força bruta (2ⁿ subconjuntos) confere.

## O Python é o lab: a conferência

`dados/referencia_openlabs.json` é o que o **código dos labs** (o TypeScript de `packages/algo-domain`, que roda no site) calcula para cada cenário. Ele é exportado por `exportar_referencia.mjs`. `tests/test_handbook.py` refaz cada conta em Python e confere número por número: o vetor sorteado, os subconjuntos contados, as moedas de cada sistema, a tabela inteira da mochila, as chamadas com e sem memória, os tempos entre as paradas e a melhor ordem. No repositório, um teste do lado do site (`referencia-pd.test.ts`) falha se um lab mudar e a referência ficar velha.

## Eficiência

`python benchmark.py` imprime estas tabelas com os tempos desta máquina. As contagens são exatas.

| Aula | Problema | Sem PD | Com PD |
|---|---|---:|---:|
| crescimento | soma de subconjunto, n = 20 | 1 048 576 subconjuntos | 4 636 estados (memo) · 20 000 células (tabela) |
| caminho | melhor ordem de 10 paradas | 362 880 ordens | 2 304 estados (Held–Karp) |
| troco | troco 30 com {1, 3, 4} | 2 550 408 chamadas | 31 valores (memo) · 90 passos (tabela) |
| mochila | 12 labs, 180 min | 4 096 subconjuntos · 7 142 chamadas | 443 chamadas (memo) · 444 células (tabela) |

O Dijkstra entre os 15 lugares do mapa (210 pares) resolve 187 155 cruzamentos ao todo, em cerca de um décimo de segundo.

## O OpenLabs no seu computador

`python main.py --servir` sobe o site do OpenLabs que vem em `site/` (construído pelo `pnpm build` do repositório) num servidor local, abre o navegador no handbook de algoritmos e funciona **sem internet**. Os links de cada aula passam a apontar para ele com `--local`:

```
python main.py --servir                    # num terminal
python main.py mochila --local --abrir     # noutro: a aula, e o lab local no navegador
```

É o mesmo que um telecentro faria no servidor dele: colocar o OpenLabs na rede local.

## Dados e de onde vieram

| Arquivo | O que é | Fonte |
|---|---|---|
| `dados/sao-paulo.json` | 1 964 cruzamentos e as ruas do centro de São Paulo | **Real**: © OpenStreetMap contributors, licença ODbL. É o mesmo arquivo do lab *Shortest paths*. |
| `dados/referencia_openlabs.json` | os resultados dos labs | Gerado do código dos labs (`exportar_referencia.mjs`). |
| catálogo e cenários da mochila, sistemas de moedas | dados das aulas | Os mesmos dos labs: labs reais do OpenLabs (os pontos são estimativa da equipe), moedas reais e históricas. |

Nenhum dado pessoal real: as "pessoas" dos cenários (a Rafa, a Dona Cida) são personagens dos labs.

## Limites, ditos com franqueza

- O peso do mapa é o tempo de carro pela velocidade da via, como no lab, não a pé.
- A soma de subconjunto pela tabela só é rápida porque os números são pequenos: com números de milhões, a tabela também explode (é o "pseudo" de pseudo-polinomial).
- Held–Karp é exponencial em k (2ᵏ × k). É muito melhor que k!, mas não serve para centenas de paradas.
- Os pontos de aprendizagem de cada lab são estimativa da equipe, não uma medida.

## As outras partes da mesma CitizenTech

- **OpenLabs (o site):** https://cabrinijr.github.io/open-labs/ · o handbook de algoritmos tem os labs destas aulas.
- **Network:** a rede do telecentro (`labs/telecentro-network/`) e o lab de como alguém entra no Wi-Fi.
- **Database Design:** o banco do telecentro (`database/`); `T_LAB` tem os mesmos labs do catálogo da mochila.
- **Data Science:** quem volta ao telecentro (`data-science/`).

## Uso de IA

O código e o texto foram feitos com apoio do Claude Code, como copiloto. Os pedidos e o que a equipe precisa saber explicar estão em `prompts.md`.

## Estrutura

```
main.py                     o índice, as quatro aulas e o --servir
benchmark.py                a eficiência, medida
handbook/
  __init__.py               o catálogo das aulas e os links dos labs
  crescimento.py            fase 3 · soma de subconjunto: força bruta, memoização, tabela
  caminho.py                fase 6 · Dijkstra no mapa real e Held–Karp
  troco.py                  fase 7 · guloso, tabela, memoização, contraexemplo
  mochila.py                fase 8 · tabela, reconstrução, memoização, gulosa, força bruta
  semente.py                o gerador semeado dos labs (mulberry32)
tests/test_handbook.py      21 testes, com a conferência contra os labs
dados/                      o mapa e a referência dos labs
exportar_referencia.mjs     gera a referência a partir do código dos labs
site/                       o OpenLabs construído, para --servir (só no ZIP)
prompts.md                  o uso de IA
```
