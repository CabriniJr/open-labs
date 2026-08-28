# Motor de simulação composicional — Design

**Data:** 2026-08-28
**Repositório:** https://github.com/CabriniJr/otel-visual-handbook
**Status:** aprovado nas seções 1–5, aguardando revisão do documento
**Substitui:** o modelo de níveis fixos (`LevelId = flow|mechanism|wire|payload`) da
spec `2026-08-28-otel-visual-handbook-design.md` §4. O resto daquela spec continua
valendo (princípios, direção visual, mapa clicável, anexos executáveis).

---

## 1. O problema com o modelo anterior

A Entrega 1 embutiu quatro níveis fixos no motor genérico. Dois defeitos:

1. **`wire` e `payload` são vocabulário de domínio dentro de `depth-core`.** A guarda
   de fronteira do CI não pegou porque são strings, mas a violação é real: o motor
   sabe que existe "um fio" e "um payload".
2. **Profundidade era uma escada, não uma estrutura.** Quatro degraus iguais para
   todo cenário, decididos pelo motor. Mas a profundidade real de um assunto é
   dada pelo **objeto** que se está explicando, não por uma constante.

O motor não deve definir camadas. Ele deve deixar o autor **compor objetos**, e a
camada emerge disso.

---

## 2. A primitiva

**Tudo é objeto.** Um objeto pode desempenhar três papéis — `Node` (ocupa um lugar),
`Message` (viaja), `Channel` (liga dois nós) — e os três usam o mesmo tipo, o mesmo
`Kind` e a mesma regra de abertura. Abrir um canal gRPC para ver HTTP/2, streams e
frames é a mesma operação que abrir um BatchSpanProcessor para ver a fila.

**`Channel` é a linha, nunca um bloco.** Bloco é processador: coisa que *age* sobre o
dado. Linha é o que *carrega*. Um canal desenhado como caixa ensina errado — sugere
que o dado é processado por ele em vez de transportado. A aresta é clicável,
selecionável e abrível como qualquer objeto; ao entrar nela, as portas ENTRA/SAI da
moldura são os dois blocos que ela liga.

```ts
type Kind =
  | "composite" | "source" | "router" | "pipeline"
  | "buffer" | "sink" | "static";
type Role = "node" | "message" | "channel";

interface ObjectSpec<S = unknown> {
  id: string;
  kind: Kind;
  role: Role;
  label: string;
  ports: { in: readonly string[]; out: readonly string[] };
  children?: readonly ObjectSpec[];   // tem filhos → é abrível
  leaf?: true;                        // válvula: folha mesmo tendo filhos
  behavior?: Behavior<S>;             // obrigatório em folha com papel ativo
  params?: readonly ParamSpec[];      // controles do objeto
  explain: ExplainRef;                // texto + âncora na spec oficial
}

type Behavior<S> = (
  inbox: readonly Message[],
  state: S,
  ctx: StepContext,
) => { state: S; outbox: readonly Emission[] };

interface Emission { port: string; message: Message }
```

**Bottom-up é obrigatório, não estilístico.** Só folhas têm comportamento. Um objeto
composto **não** pode ter comportamento próprio: o que ele faz é o resultado de rodar
os filhos. Sem isso, o L0 e o interior viram duas verdades que divergem em silêncio
no primeiro ajuste de parâmetro — o pior bug possível num handbook, porque passa nos
testes.

### 2.1 A vista agregada é de graça

Um objeto não-focado desenha como um bloco só, e os pacotes visíveis nas bordas dele
são **exatamente** as mensagens que cruzaram as portas dele naquele tick. O L0 não é
um cenário autorado: é uma projeção de fronteira do mesmo run que o interior mostra
em detalhe. É estruturalmente impossível o L0 mentir sobre o L2.

### 2.2 Regra de abertura

**Um objeto é abrível se, e só se, seus filhos trocam mensagens que o leitor consegue
ver acontecer.** Se abrir não revela troca — revela só campos — não é filho: é prosa
no inspector.

Consequência importante: *granular* e *profundo* são coisas diferentes. O Sampler é
**folha** e ainda assim é o objeto mais visual da sessão, porque a explicação dele
*é* o comportamento externo: entram N, seguem X, caem Y.

Válvula: o autor pode marcar `leaf: true` num objeto que tem tráfego interno mas cujo
tráfego é ruído. Isso é explícito no cenário, nunca implícito.

**Filhos dinâmicos.** Um terceiro caso, que o protótipo revelou: a fila do
BatchSpanProcessor é abrível, mas os filhos dela **são o conteúdo**, não uma sub-árvore
declarada — você entra e vê os spans que estão esperando, um por um, cada um
selecionável. `dynamic: true` marca isso. Vale para qualquer `buffer` em qualquer
handbook.

### 2.3 Mensagens trocam de kind nas fronteiras

Uma mensagem muda de `Kind` ao atravessar um objeto que a transforma. Span em memória
(`blob`, massa amorfa) → atravessa o exporter → vira `document` OTLP (retângulo com
estrutura visível) → entra no canal → vira `frame[]` gRPC (sequência de tijolos).

O leitor **não lê** que o exporter serializa. Ele **vê** o blob virar documento na
fronteira.

**Isso substitui o eixo de lentes.** Uma versão anterior deste design tinha dois
eixos (profundidade × lente: fluxo/fio/payload). Com mensagem-como-objeto, "wire" e
"payload" *são objetos* — o payload OTLP é uma mensagem `document`, o quadro gRPC é
uma `frame`. Abrir a mensagem focada é a operação de sempre. Uma primitiva só.

O que se perde, conscientemente: "The Wire" deixa de ser seção com identidade própria
e passa a ser algo que o leitor **encontra descendo**, quando o span vira bytes.

---

## 3. `Kind` é um arquétipo, não uma classe

Não há hierarquia de tipos no conteúdo. Há **arquétipos** — o mesmo padrão data-driven
de `Kind` já usado no Atlas. Cada `Kind` entrega **cinco** coisas, e é por isso que ele
paga o próprio custo: comportamento, contrato visual, medidores grátis, **regime
nomeado** e **perturbações** (§11 e §12). Escrever um arquétipo é caro uma vez e
gratuito em todo handbook seguinte.

| `Kind`      | Comportamento                          | Visual                          | Medidores grátis                |
|-------------|----------------------------------------|---------------------------------|---------------------------------|
| `composite` | nenhum próprio: só hospeda os filhos   | moldura que contém os filhos    | tráfego que cruza a fronteira   |
| `source`   | emite no ritmo de um parâmetro         | origem, pulso de emissão        | taxa de emissão                 |
| `router`   | política decide a porta de saída       | bifurcação, saída de descarte   | entraram / seguiram / caíram    |
| `pipeline` | encadeia filhos **na ordem declarada** | trilho com estágios             | vazão por estágio               |
| `buffer`   | acumula e drena por gatilho            | recipiente com nível            | ocupação, vazão, transbordo     |
| `sink`     | consome e (opcionalmente) transforma   | terminal                        | recebidos, latência             |
| `static`   | nenhum — existe, é clicável, explica   | placa anexada ao pai            | nenhum                          |

`static` é de primeira classe (Resource, SpanLimits). Sem ele, o autor é tentado a
inventar fluxo onde não há.

`composite` é o oposto útil de `pipeline`: contêiner **sem ordem imposta**. Um
`pipeline` afirma que os filhos rodam em sequência e que a ordem importa — afirmação
forte, e falsa para a maioria dos contêineres. `composite` não afirma nada além de
"estes objetos vivem aqui dentro e trocam mensagens entre si". Quase todo
provider/runtime/agent de qualquer domínio tem essa forma, então ele se paga pela
regra de reuso desta seção.

O contrato visual inclui a **animação diegética** do arquétipo: um `buffer` enche como
água, com a superfície ondulando, e esvazia com um pulso quando entrega. Um bloco que
apenas *contém* um buffer enche junto, mais discreto — a abstração mostra o
comportamento do que ela guarda. Um `pipeline` tem divisórias de altura cheia e
chevrons de direção; um `composite`, moldura tracejada por dentro. A diferença entre
"contêiner com trilho" e "contêiner sem" se lê no desenho, sem legenda.

**Trava de custo:** o contrato visual pertence ao **`Kind`, nunca ao objeto**. Sampler
*é* um `router` — não ganha arte própria, ganha rótulo e política. Se um objeto parece
precisar de visual próprio, ou ele revelou um `Kind` novo (que então serve a outros
handbooks), ou é vaidade. Sem essa trava, cada objeto vira ilustração sob medida e
nada termina.

---

## 4. Runtime, foco e navegação

### 4.1 O tick

Entrega os inboxes → roda cada folha em ordem topológica → coleta os outboxes → move
as mensagens pelos canais, aplicando a transformação de kind nas fronteiras.

Puro e determinístico. O RNG continua sendo função de `(seed, tick)`. O `Engine`
atual sobrevive: histórico append-only, `seek` exato por releitura. A única mudança é
que o snapshot por tick passa a ser o estado da **árvore**, não um blob.

### 4.2 Foco é um caminho

Não existe "L2". Existe `/tracerProvider/spanProcessors/batch`. O rail do `DepthShell`
deixa de ser escada fixa e vira breadcrumb do caminho.

**L0 é sempre o objeto em foco.** Cada sessão declara sua raiz, e a mesma árvore serve
todas: na sessão do TracerProvider o L0 é o provider; numa sessão sobre batching o L0
é o BatchSpanProcessor. Nenhum caso especial.

### 4.3 Selecionar ≠ abrir

- **Clicar seleciona:** o objeto acende, o resto esmaece, a explicação aparece abaixo.
  O leitor não sai de onde está.
- **Abrir desce** (duplo clique, ou o botão de expandir que só existe em objeto
  abrível): aquele objeto vira o foco e o interior vira o palco.

Se os dois gestos forem um só, o curioso não consegue perguntar "o que é isso?" sem
se perder.

**Mensagens também são selecionáveis.** Clicar num pacote em trânsito prende a seleção
nele; o inspector mostra aquela mensagem naquele tick, inclusive depois de ela trocar
de kind. Dá para selecionar um span, avançar, e ver o mesmo objeto virar documento e
depois frames.

### 4.4 Deep link

Foco + tick + seleção vão para a URL. Num handbook isso não é conveniência: é o que
permite o texto dizer "veja o sampler descartando este span" e levar o leitor ali.

---

## 5. Controles e medidores

Referência: os labs do PhET, com a regra adotada literalmente — **nenhum controle sem
um medidor que responda a ele na mesma tela.** Controle cuja consequência só se
descobre lendo é decoração.

### 5.1 Controles pertencem ao objeto

Um objeto declara seus parâmetros (`sampler.ratio`, `batch.maxQueueSize`,
`batch.scheduledDelay`, `source.spansPerSecond`) e eles aparecem quando ele está em
foco ou selecionado. Isso mata o painel de doze sliders no topo do lab: o leitor vê
só os controles do que está olhando. Casa com a decisão anterior — parâmetro é valor
e pode viver raso; composição é estrutura e vive no fundo.

### 5.2 Parâmetro é evento no tempo

Hoje `setInputs` zera o histórico e volta ao tick 0. Num lab PhET você arrasta o
slider e o mundo **reage**, não recomeça — mas rebobinar precisa continuar exato.

Solução: o parâmetro vira um **evento gravado no histórico junto com o tick em que
mudou**. A simulação continua de onde estava, e `seek` continua exato porque
rebobinar reproduz a mesma linha do tempo de parâmetros. É o que separa "simulação"
de "gráfico animado".

**Isto é requisito duro, não otimização:** mudar um parâmetro **nunca** volta o tick
para 0. O mundo reage de onde está. Um lab que recomeça a cada arrasto de slider não
é um lab — o leitor perde o estado que ele acabou de construir e nunca vê a
*transição* entre dois regimes, que é justamente onde está o aprendizado.

### 5.3 Medidor lê porta, nunca estado interno

Um medidor é função pura sobre as mensagens que cruzaram uma porta até o tick atual.
Nunca espia dentro do objeto. Isso o mantém honesto — mede o que o leitor **vê**
acontecer — e é o que permite ele vir junto com o `Kind` (tabela §3).

### 5.4 "Eficiência" exige medidor pareado

Um sampler que descarta 99% marcaria "eficiência 99%", e o leitor concluiria que
descartar mais é sempre melhor. Amostragem é uma **troca**, e a troca precisa estar
na tela.

**Regra:** todo `router` com política probabilística tem medidores obrigatoriamente
pareados — volume economizado **ao lado** do que se perdeu (traces incompletos, erro
raro não capturado). É onde o handbook se separa de um diagrama bonito.

---

## 6. Arquitetura de pacotes

Decisão: **reescrever `depth-core` no lugar.** O modelo antigo não é uma versão
anterior útil do novo — é uma hipótese descartada. Mantê-la viva num pacote paralelo
ou como caso especial da API nova só paga imposto. Consumidores hoje são poucos (o
herói da landing, `FlowDiagram`, `DepthShell`) e a Entrega 2 nunca começou: é o
momento mais barato de quebrar.

| Caminho | Responsabilidade |
|---|---|
| `packages/depth-core/src/types.ts` | `ObjectSpec`, `Kind`, `Role`, `Message`, `Behavior`, `ParamSpec` |
| `packages/depth-core/src/tree.ts` | árvore, caminhos de foco, resolução, regra de abertura |
| `packages/depth-core/src/scheduler.ts` | um tick: inbox → folhas → outbox → canais |
| `packages/depth-core/src/engine.ts` | histórico, `seek` exato, eventos de parâmetro |
| `packages/depth-core/src/meters.ts` | medidores derivados de tráfego de porta |
| `packages/depth-core/src/kinds/*.ts` | comportamento dos seis arquétipos |
| `packages/depth-core/src/random.ts`, `diff.ts` | preservados como estão |
| `packages/depth-ui/src/kinds/*.tsx` | contrato visual e animação de cada arquétipo |
| `packages/depth-ui/src/Stage.tsx` | palco: foco, seleção, abrir/descer |
| `packages/depth-ui/src/Breadcrumb.tsx` | substitui o rail de níveis fixos |
| `packages/depth-ui/src/Inspector.tsx` | explicação + params + medidores do selecionado |
| `packages/otel-domain/src/tracer-provider/` | a árvore fiel, políticas, textos ancorados |
| `packages/otel-domain/src/transforms/` | span → OTLP → frames gRPC |

Durante a reescrita, o modelo antigo pode coexistir dentro de `depth-core` para manter
`main` verde entre commits. Ele **precisa estar deletado** antes de a entrega fechar —
coexistência é andaime, não arquitetura.

**Guarda de fronteira ampliada.** `scripts/check-boundaries.mjs` ganha os termos
`tracerprovider`, `spanprocessor`, `batchspanprocessor`, `sampler`, `grpc`, `http2`,
`protobuf`, `w3c`. Protocolo é domínio: o motor não pode saber que gRPC existe.

---

## 7. A árvore do TracerProvider

Recorte desta rodada: **só o TracerProvider, completo.** Meter e Logger provider vêm
depois, reaproveitando os mesmos `Kind`s. Reuso não se prova com dois L0 vazios; se
prova quando o segundo provider custa um terço do primeiro — e isso só se descobre
construindo o primeiro até o fim.

```
Tracer (API)          source     FOLHA  — entrada do provider, NÃO é parte dele
   │
TracerProvider        composite  ABRE   — contêiner sem ordem imposta
├ Resource            static    FOLHA   — dado anexado, não troca mensagem
├ IdGenerator         static    FOLHA
├ SpanLimits          static    FOLHA
├ Sampler             router    FOLHA   — entra span, sai keep/drop
└ SpanProcessor[]     pipeline  ABRE    — a ordem importa e é visível
   └ BatchSpanProcessor pipeline ABRE   — fila enchendo, gatilho disparando
      ├ fila           buffer   FOLHA   — abrível como mensagem: dá pra ver o conteúdo
      ├ gatilhos       static   FOLHA   — maxQueueSize / scheduledDelay são parâmetros
      └ SpanExporter   sink     FOLHA   — transforma blob → document OTLP
         │
         ╌╌╌╌╌╌╌╌╌╌╌╌  ARESTA, NÃO BLOCO — o canal OTLP é a linha que liga o
                       exporter ao backend. Clicável e abrível: dentro dela,
                       gRPC, HTTP/2, multiplexação, controle de fluxo, frames.
```

**Fidelidade é o produto.** Duas correções ao esboço inicial da conversa, ambas
ancoradas na spec oficial: a **chamada da API não é parte do provider** (é a entrada
dele, `Tracer.startSpan`), e **BatchSpanProcessor é um SpanProcessor**, não um irmão —
é a implementação concreta, que é onde a ideia de "herança" aparece no lugar certo
(arquétipo, não taxonomia). Toda afirmação técnica leva link para a spec, conforme o
princípio 2 da spec original.

**O TracerProvider é `composite`, não `pipeline`.** Marcá-lo como `pipeline` seria
infiel: o Sampler é **consultado** pelo Tracer no início do span, e a cadeia de
SpanProcessors roda no **fim** dele. Não é um trilho único, e forçar um trilho
ensinaria o ciclo de vida do span errado. `composite` diz a verdade — estes objetos
vivem dentro do provider — e deixa `pipeline` para onde a ordem realmente importa,
que é a lista de SpanProcessors. Essa distinção passa a ser, ela própria, uma coisa
que o leitor aprende olhando: contêiner com trilho versus contêiner sem.

---

## 8. Testes

O que precisa ser testado é o que garante que o modelo não mente:

1. **Comportamento por `Kind`** — unitário, sem pixels, um arquivo por arquétipo.
2. **Agregado = fronteira** (property test): para qualquer objeto composto e qualquer
   tick, o que a vista agregada desenha é exatamente o conjunto de mensagens que
   cruzaram as portas dele. Este é o teste que impede o L0 de mentir.
3. **Determinismo com eventos de parâmetro:** `seek(t)` após uma sequência de mudanças
   de parâmetro é idêntico ao replay do tick 0 até `t` com a mesma linha do tempo.
4. **Continuidade sob mudança de parâmetro:** mudar um parâmetro no tick `t` mantém o
   tick em `t` e preserva o estado acumulado. Teste de regressão contra o
   comportamento antigo do `setInputs`.
5. **Honestidade dos medidores:** um medidor só consegue ler tráfego de porta —
   verificado por tipo e por teste, não por disciplina.
6. **Fidelidade da árvore:** a estrutura do TracerProvider bate com um fixture
   declarado, cada nó com sua âncora na spec oficial.
7. **Contrato de fidelidade:** todo parâmetro de todo cenário resolve para um ajuste
   real documentado, com link. Falha o CI se algum não resolver.
8. **Vocabulário do motor não vaza:** nenhuma string de `Kind`/arquétipo fora de bloco
   marcado como modo autor.
9. **Contenção:** nada é pintado fora da moldura do foco; aresta com os dois extremos
   fora do foco não é desenhada.
10. **Smoke Playwright:** abrir o provider → abrir o batch → selecionar um span →
   avançar ticks → confirmar que o kind da mensagem mudou.

---

## 9. Recorte em sessões

Cada sessão fecha com `main` verde e o progresso registrado em `docs/PROGRESS.md`.

| # | Sessão | Entrega |
|---|---|---|
| S1 | Motor composicional | `types`, `tree`, `scheduler`, `engine` com eventos de parâmetro, `meters` + testes 1–5 |
| S2 | Arquétipos | os sete `Kind`s: comportamento em `depth-core`, visual em `depth-ui` |
| S3 | Palco e navegação | foco por caminho, breadcrumb, selecionar vs abrir, inspector, deep link |
| S4 | Domínio TracerProvider | árvore fiel, transformações de mensagem, textos ancorados + teste 6 |
| S5 | Migração e limpeza | herói da landing no modelo novo, modelo antigo deletado, guarda ampliada |
| S6 | Acabamento | modelo estrito de desenho (moldura, faixas, portas), regime + log, perturbações, canal-aresta abrível, smoke |

Entregas seguintes, fora desta: **E3 — cenários, encaixe tipado e manifesto** (§14–15);
**E4 — Meter e Logger provider**, reaproveitando os `Kind`s.

---

## 10. O modelo estrito de desenho

O desenho é gerado da árvore, e a contenção precisa ser **estrutural** — não uma
checagem que alguém pode esquecer de escrever.

**Moldura com recorte real.** O interior do objeto em foco é uma moldura, e todo o
palco é desenhado dentro de um `clipPath` colado nela. O que sair da moldura não é
"filtrado por uma regra": simplesmente não é pintado. Nenhum bug futuro consegue furar
isso porque não há regra a esquecer.

**Faixas reservadas.** Cada tipo de ligação tem território próprio dentro da moldura:
fluxo na faixa central, descarte na faixa de baixo, objetos `static` na faixa do
rodapé. Fio de fluxo nunca cruza fio de descarte porque eles não moram no mesmo lugar.
Arrastar uma caixa é permitido (o leitor recompõe o palco) mas fica clampeado à
moldura e à faixa.

**Portas são o que define um objeto.** Todo objeto de fluxo desenha a porta de entrada
na borda esquerda e a de saída na direita, no mesmo traço das portas da moldura. Um
`router` tem uma terceira porta, na borda de baixo, por onde o descarte sai e desce
reto para a faixa de descarte. E o caso que ensina sozinho: **`static` não tem porta
nenhuma** — é por isso que ele não é atravessado, e agora isso se lê antes de se ler.

**Aresta cujos dois extremos caem fora do foco não é desenhada.** Ela acontece longe
dali; representá-la seria mentir sobre onde as coisas acontecem.

---

## 11. Regime e log de eventos

Emprestado do simulador de congestionamento de TCP, que faz isso bem.

**Regime nomeado.** Um objeto está sempre num estado com nome — a fila está
"acumulando", "descarregando", "transbordando" ou "bloqueada". O regime pertence ao
`Kind`, aparece como marcador no cabeçalho e no inspector, e é derivado, nunca
autorado.

**Log de eventos.** Uma faixa cronológica com carimbo de tick registra **mudanças de
regime e eventos notáveis** — não todo tick. É o que transforma "vi acontecer" em
"entendi por quê", e sai do mesmo tráfego de porta que alimenta os medidores, então
continua honesto pela regra da §5.3.

---

## 12. Perturbações

Terceira primitiva de entrada, ao lado de parâmetro e composição: **provocar a falha
em vez de esperar por ela.** Uma perturbação é declarada pelo objeto (ou pelo `Kind`) e
aparece como um botão que liga e desliga.

Duas no TracerProvider, e a segunda é o argumento inteiro do modelo composicional:

- **Rajada de tráfego** — a aplicação passa a produzir 4× mais spans.
- **Janela do receptor fechada** — o controle de fluxo do HTTP/2 fecha, a exportação
  para, a fila enche e começa a derrubar span. **A causa está três níveis abaixo e o
  efeito é perda de dado no processo do leitor.** Nenhum diagrama mostra isso, e prosa
  nenhuma convence tão rápido.

---

## 13. Modo autor: o vocabulário do motor nunca é conteúdo

`composite`, `pipeline`, `kind`, "tráfego de porta", "arquétipo" são **ferramentas de
autoria**. Se vazam para a página, o handbook está explicando a si mesmo em vez de
explicar OpenTelemetry.

O leitor vê o objeto dizer o que faz em português chão — "decide quem segue e quem
cai", "guarda até valer a pena mandar", "consultado, nunca atravessado". Um interruptor
de **modo autor** revela a camada do motor por cima, para quem está construindo.

Regra: nenhuma string do vocabulário do motor pode aparecer fora de um bloco marcado
como modo autor. Verificável no CI da mesma forma que a fronteira motor↔domínio.

---

## 14. Cenários e composição por encaixe

**Cenário** é a mesma árvore com outras peças e outros parâmetros, apresentada como
situação nomeada: "dev local" (SimpleSpanProcessor, `always_on`, exporter de console —
e o leitor vê que não existe fila nenhuma), "produção alto volume", "coletor caído",
"sem amostragem". Trocar de cenário remonta os blocos na frente do leitor, e é aí que
ele entende que aquelas caixas são a configuração dele.

**Composição é por encaixe tipado, nunca fiação livre.** As portas têm tipo: um `blob`
não entra numa porta que espera `frame`. O leitor só consegue montar combinações que
existem de verdade no SDK — trocar `Simple` por `Batch`, empilhar um segundo
processor, pôr o exporter de console no lugar do OTLP. Ele monta **configuração**, não
desenha diagrama. Fiação livre transformaria isto num editor de grafo — outro produto,
e contradiz a decisão anterior de não pôr alta complexidade na entrada.

O motor não muda: a árvore já é dado, e cenário é escolher qual dado carregar.

---

## 15. Manifesto e o contrato de fidelidade

**O manifesto é configuração real.** Nunca um formato inventado por nós: as variáveis
de ambiente do SDK (`OTEL_TRACES_SAMPLER`, `OTEL_BSP_SCHEDULE_DELAY`,
`OTEL_BSP_MAX_QUEUE_SIZE`, `OTEL_BSP_MAX_EXPORT_BATCH_SIZE`) e a configuração
declarativa do OpenTelemetry, com link para a spec. Configuração declarativa em OTel
ainda está se assentando — um manifesto fictício ensinaria algo que não existe.

**Faseamento.** Alvo é o manifesto como **fonte da verdade** (editar o documento
remonta os blocos; mexer num bloco reescreve o documento). Entrega primeiro a mão
única — a árvore é a fonte e o manifesto é exportação copiável — porque custa um
décimo, não precisa de parser nem de tratamento de config inválida, e já entrega o
essencial: *vejo minha configuração virar comportamento*. O caminho de volta vem
quando houver gente colando config de verdade.

### 15.1 O contrato de fidelidade

O risco central desta frente é **desorientar**. Os defaults reais do
BatchSpanProcessor são `maxQueueSize` 2048, `scheduledDelay` 5000 ms,
`maxExportBatchSize` 512, `exportTimeout` 30000 ms. Com esses números **nada acontece
na tela** — 512 spans para encher um lote, cinco segundos de espera. O valor didático
tem razão de existir; esconder que ele é didático, não.

Todo parâmetro carrega um contrato, que é dado e não prosa:

```yaml
scheduledDelay:
  didatico: 10 ticks
  real:     5000 ms
  ajuste:   OTEL_BSP_SCHEDULE_DELAY
  spec:     https://opentelemetry.io/docs/specs/otel/trace/sdk/#batching-processor
  escala:   1 tick = 100 ms          # declarada, nunca implícita
  nao_modelamos: [exportTimeout, retry/backoff, concorrência de export]
```

Três consequências, e as três atacam a desorientação:

1. **Todo controle mostra o valor real ao lado.** Nunca aparece número sem procedência.
2. **Botão "usar os defaults reais".** A lição é a própria frustração: a água para de
   subir visivelmente, e o leitor entende no corpo por que exportação em lote é
   invisível num serviço de baixo tráfego.
3. **O que não é modelado fica declarado.** Silenciar é pior que simplificar.

**A escala de tempo é declarada** (1 tick = 100 ms). A alternativa — tick abstrato,
sem promessa — parece mais segura e é pior: o leitor *vai* inventar uma correspondência
na cabeça dele, e aí a desorientação acontece igual, só que sem a gente poder corrigir.

**Vira teste, não disciplina.** Todo parâmetro de um cenário precisa resolver para um
ajuste real documentado, com link. O CI falha se algum não resolver — mesma linha do
princípio 2 da spec original: a documentação oficial dá a verdade.

---

## 16. Fora de escopo

- Meter Provider e Logger Provider (vêm depois, reaproveitando os `Kind`s).
- Plugin system, API pública, pacote npm. A fronteira agnóstica continua sendo
  apenas uma restrição de CI.
- Arte sob medida por objeto (ver a trava de custo em §3).
- Composição arrastável pelo leitor (arrastar um processor para reordenar). Boa ideia,
  mas depende de todo o resto estar de pé.
