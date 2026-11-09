# Roteiro do handbook de algoritmos

Um roteiro por lab: a pergunta, o erro que ele desfaz, a mídia e o porquê, o que
o showcase conta, o que a simulação deixa quebrar, o que a terceira dimensão
significa, os ícones, com quem o lab conversa, e o critério de pronto. A forma
está em `.claude/skills/openlabs-lab/SKILL.md`.

Atualize este arquivo **no mesmo PR** que cria ou muda um lab.

## O que este handbook é

Uma matéria de lógica e algoritmos que roda. A grade sobe como uma disciplina:
a estrutura que guarda, o custo de usá-la, a ordenação como a primeira corrida
entre classes, o grafo como a estrutura que modela o mundo, os caminhos nele, e
as duas formas de decidir — a gulosa e a que lembra.

A ideia que atravessa tudo é **competição medida**: algoritmos da mesma tarefa
rodam sobre a mesma entrada, no mesmo relógio, e o placar sai do modelo. Nenhum
número da página é escrito à mão.

O desenho original das fases 1–3 (fila, hash, a bancada de ordenação em que
trocar o algoritmo é trocar o controlador) está em
`docs/superpowers/specs/2026-08-30-algo-fases-1-3-design.md`, recuperado de uma
sessão local que nunca foi enviada. A ordenação foi construída como corrida em
React livre em vez de bancada no motor de fluxos: o que ensina é ver as cinco
lado a lado, e cinco palcos do `depth-ui` no mesmo relógio não cabem na tela.

## As regras que valem para todo lab daqui

1. **Contado, não afirmado.** Toda classe O(·) aparece junto da contagem de um
   algoritmo que rodou. A fórmula, quando aparece, é tracejada ao lado.
2. **O modelo é instrumentado.** Os algoritmos rodam sobre estruturas que
   contam cada operação (`Vetor` em `ordenacao.ts`, eventos em `caminho.ts`). A
   corrida, o filme e o gráfico leem a mesma fita; eles não podem discordar.
3. **Tempo real é medido no aparelho do leitor, quando ele pede.** Contagem é
   exata e igual em qualquer máquina; tempo é `performance.now()`, mediana, e
   o texto diz que é ruidoso. Nenhum lab mede no carregamento.
4. **Semeado.** Todo sorteio passa por `semente.ts`. Mesma semente, mesmo vetor,
   mesmo placar — é o que deixa o teste citar números.
5. **Recusa onde a violação aparece**, com a posição e o porquê (vetor com item
   não numérico, aresta de um ponto nele mesmo, rua negativa no Dijkstra, moeda
   repetida).
6. **A altura no 3D é tempo de caminho** (lab do mapa). Nos outros labs não há
   3D: barras e grafos planos não ganham nada com profundidade.

## Ícones do handbook (`ICONES_ALGO`, `packages/algo-domain/src/icones.ts`)

| ícone | papel | onde aparece |
|---|---|---|
| `casa` | origem da busca | mapa |
| `porto` | destino da busca | mapa |
| `lugar` | um lugar qualquer do mapa | mapa |
| `auxiliar` | memória extra (a fita do merge) | corrida |
| `contador` | a conta de operações | crescimento |
| `moeda`, `tabela` | a bandeja de moedas, a tabela da PD | troco |
| `no`, `aresta`, `fronteira`, `comparar`, `trocar` | reservados no catálogo | *a aplicar* (o círculo do nó leu como artefato no filme do grafo e foi retirado de lá) |

## A espinha: fases e labs

### Fase 1 — What holds the data

#### fifo — *A queue, and what fills it* · em breve
Desenho pronto no spec recuperado (§2): `source → buffer → sink`, política de
recusa como parâmetro, ocupação por `Message.weight`.

### Fase 2 — One pass at a time

#### rpn — *A stack machine, running* · disponível (fluxo)

### Fase 3 — How work grows

#### how-work-grows — *Six ways to grow: O(1) to O(2ⁿ), measured* · disponível (filme + livre)
- **Pergunta:** o que O(n) quer dizer, na prática?
- **Mal-entendido:** "Big-O é uma fórmula / um tempo"; "hardware melhor resolve".
- **Mídia:** filme de barras horizontais em escala log (a quadrática apaga as
  outras em escala linear) + gráfico log–log em SVG livre.
- **Showcase:** n = 8, 16, 64, 512, 4096; a exponencial para de rodar depois de
  20 e o filme diz quanto levaria. Fecha com o teste da duplicação.
- **Simulação:** escolher n, ligar a fórmula tracejada, trocar ops/s, e
  cronometrar no aparelho (cada medida repete até 4 ms; tabela de razões de
  tempo ao lado das razões de contagem).
- **Representantes:** ler posição (O(1)), busca binária (O(log n)), busca linear
  (O(n)), merge sort (O(n log n)), selection sort (O(n²)), soma de subconjunto
  por força bruta (O(2ⁿ)).

### Fase 4 — Sorting

#### sorting — *Sorting, swap by swap* (`labs/sorting-race`) · disponível (filme + livre)
- **Pergunta:** o que separa dois algoritmos de ordenação?
- **Tese:** não é a operação, é quem decide o próximo par.
- **Showcase:** oito barras, um capítulo por fase da fita (passada, intercalação,
  partição); comparar acende, trocar cruza, o merge desce para a fita auxiliar.
- **Simulação:** cinco pistas no mesmo relógio (um passo = uma comparação, troca
  ou escrita), formato da entrada, lista própria, pódio, e medição de tempo real
  com n até 4 000.
- **Quebre:** vetor ordenado põe o quicksort (pivô no último) em último lugar.

### Fase 5 — Graphs

#### what-is-a-graph — *What a graph is: two points and a line* · disponível (filme + livre)
- **Pergunta:** o que é um grafo, e como um programa o guarda?
- **Showcase:** dois pontos → aresta → peso → direção → terceiro ponto em que o
  desvio (3 + 3) vence a reta (7). O painel mostra lista e matriz do instante.
- **Simulação:** editor por clique (e por formulário, sem ponteiro), exemplos
  (dois pontos, triângulo, árvore, mão única), lista, matriz, graus, pedaços, e
  o nome do que foi montado (árvore, ciclo, completo…).

### Fase 6 — Paths through a graph

#### shortest-path — *Four ways across a city: BFS, greedy, Dijkstra and A** · disponível (filme + 3D + livre)
- **Pergunta:** por que "o mais perto" e "o com menos ruas" não são o mais rápido?
- **Tese:** as quatro buscas são o mesmo laço; só muda o que "melhor" quer dizer.
- **Mapa:** 12 lugares, 20 ruas. Duas armadilhas desenhadas: o centro
  congestionado + a balsa lenta (pegam o guloso: 68 min) e a via expressa
  congestionada com poucas ruas (pega a BFS: 3 ruas, 55 min). Dijkstra e A*:
  26 min; A* examina 6 lugares contra 11.
- **3D:** a altura de um lugar resolvido é o tempo para chegar nele.
- **Simulação:** origem, destino, congestionar rua por clique, balsa mágica
  negativa (Dijkstra e A* recusam e citam Bellman-Ford), passo a passo, placar.

### Fase 7 — Greedy

#### greedy — *Greedy, and the case it misses* (`labs/greedy-change`) · disponível (filme + livre)
- **Pergunta:** quando decidir com o que está na frente basta?
- **Sistemas:** real (canônico), Grã-Bretanha antes de 1971 (48 pence), {1, 3, 4}
  (6), {5, 7} (sem moeda de 1).
- **Showcase:** guloso moeda a moeda, a tabela da PD enchendo, a reconstrução.
- **Simulação:** sistema próprio, valor até 500, faixa da tabela com o caminho de
  volta, e o menor contraexemplo achado automaticamente.

### Fase 8 — Dynamic programming

#### dynamic — *The table that remembers* · em breve
O lab do troco já mostra a tabela; este deve ir além (mochila, ou subsequência
comum), com a tabela 2D e a reconstrução.

## Correlações

- crescimento ↔ corrida: as classes O(n²) e O(n log n) do gráfico são as das
  pistas; a seleção e o merge são os mesmos algoritmos nos dois.
- grafo → mapa: o triângulo (7 contra 3 + 3) é o mapa em três pontos.
- mapa ↔ troco: Dijkstra é guloso no critério certo; o troco mostra o guloso
  no critério errado.
- troco → crescimento: a tabela custa `valor × moedas`; tentar todo subconjunto
  é a linha O(2ⁿ).

## Critério de pronto (todos os cinco cumprem hoje)

`pnpm test`, `typecheck` (sem erro novo), `boundaries`, `catalogo`, `handbooks`,
`locale:check`, e2e em `apps/site/tests/algorithms-course.spec.ts` (desktop e
celular) e `pnpm qa:labs` sem falha nem alerta, com as fotos olhadas.

## Fila

1. `fifo` e o lab da tabela hash, do spec recuperado.
2. `dynamic` (fase 8).
3. Avaliações por lab (`handbooks/algorithms/assessments.json`), no formato do
   handbook de Kubernetes.
4. Os seis artigos marcados como `coming` no `handbook.yaml`.
