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
6. **Som tem sentido ou não existe.** Na ordenação o tom é o valor tocado; no
   mapa, a distância já percorrida. Nada toca antes de um gesto do leitor, e o
   botão de som lembra a escolha (`lib/som.ts`).
7. **Competição é entre classes.** Toda corrida oferece as classes prontas: dentro
   de uma, a disputa é de constantes; entre classes, de expoente.

## Ícones do handbook (`ICONES_ALGO`, `packages/algo-domain/src/icones.ts`)

| ícone | papel | onde aparece |
|---|---|---|
| `casa`, `porto`, `lugar` | origem, destino e lugar | *sem uso* desde que o mapa virou canvas real (as pontas são discos coloridos) |
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

#### sorting — *Sorting, swap by swap: eight algorithms, three classes* (`labs/sorting-race`) · disponível (canvas + som + livre)
- **Pergunta:** o que separa dois algoritmos de ordenação — e duas classes?
- **Classes que competem:** O(n²) (bubble, insertion, selection), O(n log n)
  (merge, quick, heap) e O(n + k), que não compara (counting, radix).
- **Mídia:** barras em canvas, cor = valor (rampa das espécies), a operação de
  agora acesa (clara ao comparar, viva ao trocar/escrever, alta ao ler), onda de
  conferência no fim. **Som:** o tom é o VALOR tocado (escala subindo quando
  ordena), pan por pista, arpejo para o vencedor (`lib/som.ts`).
- **Showcase:** seis capítulos narrados com corrida automática — as três classes,
  "o expoente vence a constante", entrada ordenada, quase ordenada, sem comparação.
- **Simulação:** até 4 pistas no mesmo relógio, classe pronta ou escolha livre,
  n até 256, formato, lista própria, pseudocódigo com a linha acesa, gráfico ao
  vivo (% no lugar final) e Big-O log–log com as fórmulas tracejadas.
- **Por que canvas e não o motor de filme:** 256 barras × 4 pistas × 60 quadros;
  o filme em SVG é para dezenas de peças, não milhares de retângulos por segundo.

### Fase 5 — Graphs

#### what-is-a-graph — *What a graph is: two points and a line* · disponível (filme + livre)
- **Pergunta:** o que é um grafo, e como um programa o guarda?
- **Showcase:** dois pontos → aresta → peso → direção → terceiro ponto em que o
  desvio (3 + 3) vence a reta (7). O painel mostra lista e matriz do instante.
- **Simulação:** editor por clique (e por formulário, sem ponteiro), exemplos
  (dois pontos, triângulo, árvore, mão única), lista, matriz, graus, pedaços, e
  o nome do que foi montado (árvore, ciclo, completo…).

### Fase 6 — Paths through a graph

#### shortest-path — *Shortest paths on the real streets of São Paulo* · disponível (canvas + som + livre)
- **Pergunta:** por que "o mais perto" e "o com menos esquinas" não são o mais rápido?
- **O mapa é real:** OpenStreetMap, Paulista ao Centro (≈ 4 × 4,4 km), 1 964
  cruzamentos, 3 689 arestas dirigidas com mão única. Extraído por
  `scripts/osm-mapa-cidade.py` (pela API oficial do OSM, uma vez) para
  `packages/algo-domain/src/mapa-real/sao-paulo.json`; o site carrega sob demanda
  (`carregarSaoPaulo()`). Crédito ODbL na página. **Google Maps não serve**: os
  termos proíbem extrair a malha viária.
- **Classes que competem:** exatos (Dijkstra, A*, Dijkstra bidirecional), rápidos
  sem garantia (guloso, A* ponderado ε = 2), cego para o tempo (BFS).
- **Mídia:** três canvas empilhados por pista (base, pintura incremental,
  sobreposição); a cor é o tempo até chegar, a bidirecional pinta a onda do
  destino em tom frio; rastro luminoso, pulso no cruzamento atual, rota animada.
  **Som:** tom = distância já percorrida, pan por pista, arpejo na chegada.
- **Showcase:** seis capítulos com pares reais — MASP → Mercadão, Sírio-Libanês →
  Luz (A* 119 × Dijkstra 941), Bixiga → São Bento (bidirecional vence o A*),
  guloso errando por 3 min 49 s, A* com pressa, BFS contando esquinas.
- **Simulação — todas no mesmo mapa:** um canvas só, cada busca pintando na cor da
  pista; no fim, as rotas viram faixas concêntricas (vão escuro só onde coincidem).
  Opção "lado a lado" para quem quer as pistas separadas.
- **Paradas com bonecos:** de 2 a 4 personagens próprios do lab (chapéu de
  explorador na cor da parada, alvo no chão). Arrastado, o boneco pendura pela
  cabeça e balança com física de mola (ragdoll: braços e pernas atrasados); solto,
  cai, amassa e quica no cruzamento mais perto; parado, respira, pisca e acena
  (CSS, defasado por boneco). Setas do teclado também movem. A ordem das paradas
  do meio é a de menor tempo, testando todas as permutações com Dijkstra
  (`mapa-real/paradas.ts`).
- **Quem vence onde:** seis cenários reais × seis buscas, com ★ (exata que menos
  trabalhou) e ⚡ (terminou primeiro). O A* vence com linha reta clara; a
  bidirecional, atrás das mãos únicas e no passeio de três paradas.
- Embaixo: pseudocódigo aceso, gráfico ao vivo e Big-O do mapa (resolvidos ×
  distância em 48 viagens: o Dijkstra cresce com a área).
- **Desempenho conhecido:** 60 fps com CPU normal; com CPU 4× mais lenta no
  Chromium sem tela (pintura por software), ~26 fps na simulação com 3 pistas
  largas e ~49 fps no showcase. O gargalo medido é a rasterização dos canvas
  (sem as pistas: 60 fps). Em aparelho com GPU a pintura é acelerada.

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
