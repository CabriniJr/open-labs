# Os provedores do OpenTelemetry — desenho

**Data:** 2026-08-31.
**Handbook:** `otel.model` — fase 3, *The Architecture*.
**Precedência:** a spec do handbook
(`superpowers/specs/2026-08-28-otel-visual-handbook-design.md`) manda em conteúdo e
currículo; `DECISIONS.md`, `kinds.md` e `depth.md` mandam no motor. Este documento não
revoga nenhum dos três.
**Fontes primárias:** todas as afirmações técnicas abaixo estão ancoradas na spec do
OpenTelemetry, com link na §11. Nenhuma vem de livro, blog ou memória.

---

## 1. A tese

O `otel.model` não tem um lab publicado. Treze nós declarados no mapa, zero abertos. O
primeiro lab decide o que o handbook parece ser — e há uma escolha melhor que "o mais
fácil de fazer".

> **O envelope do OTLP é a árvore de objetos do SDK.**
>
> `ResourceSpans → ScopeSpans → Span` é, campo por campo, **provider → tracer → span**.

Isso não é analogia: é a mesma hierarquia vista de dois lados. O `Resource` está uma
camada **acima** dos spans no payload porque ele pertence ao *provider*, não ao span. O
`scope` está no meio porque pertence ao *tracer*. O span carrega só o que a instrumentação
de fato criou.

Se essa correspondência for verdadeira — e ela é —, então o lab dos provedores é o único
que consegue provar a promessa do projeto inteiro num único movimento: **o L0 mostra a
placa pendurada no provider; o L3 mostra o mesmo dado no campo `resource` do envelope; e é
o mesmo run produzindo os dois.** É o diferencial da §6 do `DECISIONS.md` sem precisar
descer ao frame HTTP/2.

A pergunta do lab, que é o título da página:

> **You called `tracer.startSpan`. Who decides whether it ever leaves the process?**

A resposta é o provider — e a lista do que ele decide (recurso, amostrador,
processadores, limites, o momento do flush) é o conteúdo do lab.

---

## 2. Por que este lab, e não a fila

O `depth.md` §4.3 propõe a escada da trilha começando pela fila, e a decisão aberta nº 4
registra "começar pela fila, não pelo provider". Este desenho **não contraria** a
proposta: ele a torna gratuita.

**Uma árvore, quatro raízes.** Este round constrói `otelWorld()` uma vez. A fila, o lote e
o provider não são três modelos: são três **raízes declaradas** sobre a mesma árvore, que é
exatamente o mecanismo que o `depth.md` §4.3 diz que implementa currículo bottom-up sem
tocar no motor.

| Lab | Raiz declarada | Custo em código de domínio depois deste round |
| --- | --- | --- |
| `labs/queue` | `queue` | zero — uma `View` e um nó no mapa |
| `labs/batch` | `batch-processor` | zero — idem |
| `labs/providers` | `process` | é este |
| `labs/two-providers` | `host` | zero — troca de um parâmetro |

Então a ordem de **publicação** deixa de ser decisão de modelagem e passa a ser decisão de
mapa. A recomendação é publicar `providers` primeiro, e o motivo é honesto: a fila sozinha
é uma estrutura de dados, não é OpenTelemetry. Quem lê o lab da fila antes de saber de
quem ela é aprende `buffer`, não SDK. Mas a decisão é do Luigi, e o custo de invertê-la
depois deste round é uma view.

---

## 3. O mapeamento — o catálogo já tem as formas certas

Esta é a parte que decide se o lab é honesto. Cada peça do SDK recebe um `kind` do
catálogo, e o critério é o do `kinds.md` §1: **cano transporta, máquina transforma,
controlador não recebe carga, placa é consultada e não atravessada.**

| Peça do SDK | `kind` | `Family` | Por que esta e não outra |
| --- | --- | --- | --- |
| a instrumentação (`startSpan`, `record`, `emit`) | `source` | processor | produz sem receber; é a borda de dentro |
| `Resource` | `static` | **plate** | não está no caminho do span. É consultado no momento da exportação e nunca atravessado — que é a definição literal de placa |
| propagadores (W3C Trace Context) | `static` | plate | **pendurados no processo, não no provider** — ver D4 |
| `View` / *stream configuration* | `static` | plate | configuração consultada, não atravessada |
| `Sampler` | `router` | processor | uma entrada, **três** saídas nomeadas. Ver D2 |
| `LoggerConfig.trace_based` | `switch` | processor | "deixa o caminho passar, ou não, e quem manda é outro" — comandado pelo bit `sampled` do trace |
| `SpanProcessor`s registrados | `pipeline` | container | a spec diz que são invocados **na ordem em que foram registrados**; ordem é contrato, e é o que separa `pipeline` de `composite` |
| `BatchSpanProcessor` | `composite` | container | tem interior de verdade: fila + gatilho + exportador |
| a fila do lote (`maxQueueSize`) | `buffer` | processor | cheia, **recusa** — e a recusa é o que faz a perda de dado existir no modelo em vez de desaparecer |
| `scheduledDelayMillis` | `sequencer` | controller | acorda por conta própria e fala por linha de controle |
| `ForceFlush` / `Shutdown` do provider | `sequencer` | controller | a spec: `ForceFlush` **MUST** invocar `ForceFlush` em todos os `SpanProcessor` registrados. É uma linha de controle que desce a árvore |
| `SpanExporter` | `sink` | processor | consome e não emite para dentro; guarda estado, e é dele que se lê o resultado do run |
| estado em memória das métricas | `store` | processor | "guarda muitos valores e responde por chave" — e é desenhado como banco de linhas, que é o que um conjunto de *metric points* é |
| `MetricReader` (periódico) | `sequencer` | controller | ele **pede**; o `store` só emite quando perguntado |
| o Collector | `sink`, **opaco** | processor | fora do processo. Declarado não modelado, não desenhado como caixa vazia |
| o canal de exportação | `channel` | conduit | **opaco neste lab.** O interior dele é o anexo *gRPC over HTTP/2* |

**Nenhum `kind` novo nasce.** A régua "arquétipo entra pagando em dois alvos" continua
valendo, e o catálogo de onze `kind`s cobriu o SDK inteiro sem sobra e sem forçar. Isso é
resultado do round, não pressuposto: era possível descobrir que faltava peça.

---

## 4. A árvore

Ids em **inglês, kebab-case, com o nome que a spec do OpenTelemetry usa**. É desvio
consciente do `cpu-domain`, que tem ids em português: `TracerProvider` é substantivo
próprio de um documento normativo, e traduzir quebraria a correspondência que a §1 existe
para provar. Rótulos visíveis continuam em `labels.ts`, em inglês, como em todo o repo.

```
host (composite)                          ← raiz de `labs/two-providers`
├─ process (composite)                    ← raiz de `labs/providers`  ◀ ESTE LAB
│  ├─ app (source)                          startSpan · record · emit
│  ├─ propagators (static)                  placa do PROCESSO — ver D4
│  │
│  ├─ tracer-provider (composite)
│  │  ├─ resource-traces (static)           placa do provider
│  │  ├─ span-limits (static)               placa do provider
│  │  ├─ sampler (router)                   out: sampled · recorded · dropped→DROP
│  │  ├─ span-processors (pipeline)
│  │  │  └─ batch-processor (composite)   ← raiz de `labs/batch`
│  │  │     ├─ queue (buffer)             ← raiz de `labs/queue`
│  │  │     ├─ batch-timer (sequencer)      scheduledDelayMillis
│  │  │     └─ span-exporter (sink)
│  │  └─ trace-flush (sequencer)            ForceFlush / Shutdown
│  │
│  ├─ logger-provider (composite)
│  │  ├─ resource-logs (static)
│  │  ├─ trace-gate (switch)                LoggerConfig.trace_based
│  │  ├─ log-processors (pipeline)
│  │  │  └─ batch-log-processor (composite)
│  │  │     ├─ log-queue (buffer)
│  │  │     ├─ log-timer (sequencer)
│  │  │     └─ log-exporter (sink)
│  │  └─ log-flush (sequencer)
│  │
│  └─ meter-provider (composite)
│     ├─ resource-metrics (static)
│     ├─ views (static)
│     ├─ points (store)                     o estado em memória
│     ├─ metric-reader (sequencer)          exportIntervalMillis · Collect
│     └─ metric-exporter (sink)
│
└─ collector (sink, OPACO)                  fora do processo
```

`collector` é filho de `host` e **não** de `process`, porque ele não roda no processo.
Enfiá-lo dentro do processo seria a primeira mentira estrutural, e ela apareceria de graça
no desenho.

### As linhas

| De | Para | Espécie | O que ela é |
| --- | --- | --- | --- |
| `app` → cada provider | | dado | a instrumentação entregando |
| `sampler` → `span-processors` | porta `sampled` | dado | o span que vai ser exportado |
| `sampler` → `span-processors` | porta `recorded` | dado | `RECORD_ONLY`: chega no processador e **não** no exportador |
| `sampler` → `DROP` | porta `dropped` | dado | ausência de destino, que é o que `DROP` significa |
| `sampler` → `trace-gate` | | **controle** | a única linha que cruza fronteira de provider. Ver D5 |
| `trace-flush` → `queue`, `span-exporter` | | **controle** | o cascateamento do `ForceFlush` |
| `batch-timer` → `queue` | porta `flush` | controle | o gatilho de tempo |
| `metric-reader` → `points` | porta `collect` | controle | **ele pede**; contraste com o de cima, que empurra |
| `span-exporter` → `collector` | canal `otlp-out` | dado | o canal opaco |

---

## 5. Os cinco fenômenos

Régua do projeto: *"a decisão aparece?"*, não *"o número está certo?"*. E: *"fenômeno que
precisou de roteiro deve ser zero"* — nenhum dos cinco abaixo é roteirizado; todos são
consequência da topologia mais um parâmetro.

### F1 — O provider é onde o recurso é estampado

Três tracers do mesmo provider; um span de cada; os três saem com o mesmo `resource`.
Muda-se a placa uma vez e os três mudam. É a prova do §1 no L0.

**A perturbação:** dois providers no mesmo processo com recursos diferentes. Nada falha.
Nenhum log de erro. E no L3 aparecem **dois** `resourceSpans` com `service.name`
diferente — que é o motivo real pelo qual um backend deixa de correlacionar.

### F2 — Amostrar não é uma coisa, são três

`ShouldSample` devolve `DROP`, `RECORD_ONLY` ou `RECORD_AND_SAMPLE`, e a spec tem uma
tabela dizendo o que cada combinação faz. Três portas no `router`, e a do meio é a que
quase ninguém sabe que existe: **o processador recebe, o exportador não.**

**A perturbação:** baixar a razão de amostragem e ver a porta do meio acender. O span
existe, foi gravado, é legível no processo — e não sai.

### F3 — A morte do processo é um evento do provider

Encerrar sem flush: o conteúdo da fila vai para `DROP`. Encerrar com `ForceFlush`: a linha
de controle desce, o lote sai antes do fim, e o contador do `collector` sobe.

O contrafactual está lado a lado, e é o mesmo run com um parâmetro trocado. É a razão pela
qual span desaparece no fim de um job curto, e a spec diz literalmente que `ForceFlush`
existe para o caso de o processo ser suspenso antes de o exportador exportar.

### F4 — Os três provedores não são simétricos, e a assimetria é a lição

Aqui o motor entrega algo que prosa não entrega: a diferença é **de forma**, e ela aparece
sem uma linha de texto.

| | traces / logs | metrics |
| --- | --- | --- |
| quem guarda | `buffer` — fila | `store` — banco de linhas |
| quem dispara | `sequencer` **empurra** | `sequencer` **pede** |
| padrão da spec | `scheduledDelayMillis` = **5 000 ms** | `exportIntervalMillis` = **60 000 ms** |
| o que acontece no limite | a fila **recusa**: span é descartado | o banco **colapsa**: os pontos viram uma linha `otel.metric.overflow` |

A última linha é o achado: **traces perdem dado por descarte, métricas perdem dado por
colapso.** Mesmo problema — memória finita —, duas mentiras diferentes, e cada uma tem uma
forma própria no desenho. E a linha do tempo mostra os traces saindo doze vezes mais
frequentemente que as métricas, porque é o que os padrões da spec dizem.

E os logs não têm amostrador nenhum: o `LoggerProvider` só configura `LogRecordProcessor`s.

### F5 — Sem SDK, silêncio

A API sem SDK instalado devolve um provider no-op. No modelo: o provider é substituído por
uma **folha `sink` rotulada `no-op TracerProvider`**, que consome e não emite.

E como `sink` guarda estado, o contador dele é legível: *"37 spans ended here"*. Nenhum
erro, nenhuma exceção, nenhum aviso — e é isso que faz esta ser a falha nº 1 de quem
instrumenta pela primeira vez. O lab mostra o silêncio **com número**, que é a única forma
de ensinar silêncio.

É também o estado **opaco** do `depth.md` §2 usado a sério pela primeira vez no repo.

---

## 6. Os mal-entendidos que o lab desfaz

O `DECISIONS.md` §8.2 pede este campo e ele não existia em nenhum lab. Este é o primeiro, e
o texto é escrito **para quem já tem a ideia errada**, não para quem não tem ideia.

| O que se acredita | O que a spec diz |
| --- | --- |
| `service.name` é atributo do span | é do `Resource`, que é do provider — e no OTLP ele está uma camada acima dos spans |
| o tracer é configurado | o tracer não tem configuração; ele guarda um `InstrumentationScope` e nada mais |
| amostragem acontece na exportação | acontece na **criação** do span, antes de qualquer processador |
| span descartado e span não amostrado são a mesma coisa | `RECORD_ONLY` existe: gravado, legível, não exportado |
| o provider propaga contexto | propagadores são globais e não pertencem a provider nenhum |
| se o SDK não subiu, algo dá erro | no-op, silêncio, contador subindo |
| métrica funciona como trace | uma é pedida, a outra é empurrada — e com 12× de diferença no intervalo padrão |
| o exportador tenta de novo se falhar | a spec diz que o SDK padrão **não** deve implementar retry; isso é do exportador de protocolo |

Cada um vira uma pergunta de predição (§8) e uma linha do *Check yourself*.

---

## 7. Decisões

### D1 — Os níveis declarados são L0, L1 e L3. L2 nasce opaco, e declarado

Régua: *nível novo precisa revelar fenômeno novo*. O interior do canal — enquadramento
HTTP/2, `length-prefix`, `stream id` — não revela nada sobre **quem decide o que sai do
processo**, que é a pergunta deste lab. Ele revela o transporte, e transporte é o lab
`collector-pipeline` mais o anexo *gRPC over HTTP/2*.

Então o canal `otlp-out` existe, é clicável, e o que ele diz ao ser aberto é *"não
modelado aqui — veja o anexo"*. É a decisão aberta nº 5 do `depth.md` cumprida ao pé da
letra, e o refinamento futuro passa a valer o teste da §3 daquele documento.

**L3 só para traces neste round.** `otel-domain` já tem `OtelSpan`, `ResourceSpans` e
`toOtlpJson`; o envelope de métrica e de log são dois payloads novos, cada um com sua
dívida de fidelidade, e o fenômeno F4 já é visível no L1 sem eles. Declarados opacos.

### D2 — O `Sampler` é `router`, e isso expõe uma lacuna do catálogo

Uma entrada, três saídas nomeadas. O `router` é o `kind` certo pelo resumo dele — *"takes
in, decides, emits on an outlet"* — mas o detalhe do catálogo puxa para mux (*"picks which
of its inputs answers"*), e um amostrador é o espelho disso: escolhe **qual saída**.

Duas leituras possíveis, e a decisão é a segunda:

1. criar um `kind` novo (`distributor`) — **recusada**: a régua exige dois alvos pagantes, e
   há um
2. usar `router`, registrar a assimetria do texto, e deixar o segundo caso decidir se o
   texto do catálogo se alarga ou se nasce `kind`

Fica escrito porque é retorno de motor: o catálogo descreve `router` de um lado só, e o
segundo lado apareceu.

### D3 — `static` deixa de existir só em teste

Hoje `kind: "static"` aparece em três lugares do repo e **todos** são teste do motor.
Nenhum modelo nunca precisou de placa. Este precisa de cinco, e elas carregam a tese da
§1.

Consequência dura, e é o que torna a placa honesta: **placa não tem porta e não é fiada.**
Logo o `Resource` não chega no exportador por fio nenhum — a folha do exportador é
construída por uma fábrica que fecha sobre o recurso do provider. A placa é o **desenho**
dessa configuração, e a §9 tem o teste que impede o desenho de divergir dela.

### D4 — Os propagadores penduram no processo, não no provider

Contexto não é configuração de provider: a API de propagadores é global. Desenhar a placa
no processo, e não dentro de nenhuma das três molduras, mata o mal-entendido sem uma
palavra de texto — **quem a placa toca é quem a possui** (§8).

### D5 — Uma linha de controle atravessa a fronteira entre dois providers

`LoggerConfig.trace_based`, quando ligado, faz o `Logger` descartar registro associado a
trace não amostrado. No modelo isso é uma linha **de controle** do `sampler` do
`tracer-provider` para o `trace-gate` do `logger-provider`.

É a única linha do lab que cruza a fronteira de um provider, é tracejada, e é por isso que
ela ensina: baixar a amostragem de traces **apaga logs**, e quase ninguém liga as duas
coisas até ver a linha.

Se `validateWorld` recusar sinal entre subárvores irmãs, isso é achado do round e vira
tarefa no motor — não gambiarra no domínio.

### D6 — O Collector é opaco de propósito, e a régua-mãe explica por quê

*A ferramenta ensina; não opera.* O que acontece dentro do Collector é o lab
`collector-pipeline`. Aqui ele é a borda: um `sink` que conta e guarda o último envelope, e
uma ficha que diz *"out of process — not modelled in this lab"*.

Nunca uma caixa vazia. O `depth.md` decisão aberta nº 6 pergunta como o bloco opaco aparece
sem parecer defeito da ferramenta; este lab é o primeiro que tem de responder, e a resposta
proposta é: **aparência própria mais frase própria**, e a frase diz para onde ir.

### D7 — O lab é TypeScript, não `.model.yaml`

Medido, não suposto: `packages/model-format` implementa hoje três `kind`s — `source`,
`buffer`, `sink` — e recusa explicitamente `composite`, `pipeline`, `router`, `channel` e
`static`. Um provider é `composite` com `pipeline` dentro e placa pendurada. O formato não
alcança, e forçá-lo alcançar é projeto próprio.

Registrado ao contrário também: **este lab é a lista de compras do `.model.yaml`.** Se um
dia o formato tiver de expressar um modelo real, é este.

### D8 — O lab entra na fase 3, antes do Collector

Ele responde *"quem faz o quê e onde roda"* pelo lado do SDK, e é pré-requisito dos dois
nós que já existem ali. A fase 3 passa a ter três labs, e o mapa cresce como as fases 2 e
4 já crescem: primeira fileira em `fase_y + 66`, segunda em `+ 122`.

| | antes | depois |
| --- | --- | --- |
| `providers` | — | esquerda, `y = 434` |
| `collector-pipeline` | esquerda, 434 | esquerda, **490** |
| `agent-or-gateway` | direita, 434 | direita, **490** |
| anexo `grpc-http2` | 434 | **490** |
| fase 4 e tudo abaixo | | **+56** |
| `MAP_HEIGHT` | 870 | **926** |

Os números são indicativos: quem manda é `tests/espaguete.spec.ts` e o teste de
sobreposição. Se eles reprovarem, o layout muda — não o teste.

### D9 — A predição vem antes da revelação, e ela não é do OTel

`DECISIONS.md` §8.1: perguntar o que a pessoa acha que vai acontecer **antes** de rodar é o
achado mais replicado da pesquisa em simulação didática, e não custa motor. Este lab é o
primeiro a ter, e por isso a peça nasce **neutra de domínio**, em `apps/site`, onde os
outros dois handbooks a alcançam.

Não vai em `depth-ui`: não é primitiva de modelo, é pedagogia de página. A fronteira do CI
não se pronuncia sobre isso, e por isso a decisão tem de estar escrita.

---

## 8. Organização visual

O desenho aqui não ilustra o modelo: ele **carrega** parte do argumento. Três regras fazem
o trabalho pesado, e as demais são consequência.

### 8.1 As três regras que ensinam sozinhas

**R1 — Quem a placa toca é quem a possui.** A placa encosta na borda de quem a declara.
`resource-traces` na borda do `tracer-provider`; `propagators` na borda do `process`, fora
das três molduras. Não há legenda explicando posse: a posse é a posição. É o que faz F1 e o
mal-entendido do `service.name` caírem sem prosa.

**R2 — Controle mora acima do dado, e nunca o cruza.** A fileira de dado é uma faixa
horizontal; sequenciadores ficam numa faixa acima, em tracejado. A pergunta "por onde o
span passa?" se responde olhando uma faixa só — e o `ForceFlush` descendo para dois
destinos ao mesmo tempo é a imagem do "MUST invocar em todos os processadores
registrados".

**R3 — Provider se compara por superposição, não por texto.** As views do
`tracer-provider`, do `logger-provider` e do `meter-provider` compartilham `width`,
`height`, o `y` da faixa de dado, o `y` da faixa de controle e o `x` das bordas. **O que
muda é só o que está dentro.** Alternar entre elas é um diff visual: a fila e o banco
ocupam o mesmo lugar, e a flecha do gatilho aponta para lados opostos. F4 é entregue pela
geometria.

### 8.2 As views

Seis escritas à mão; abaixo delas o `Explorer` cai em `autoView`, como no micro. Toda
moldura cujos filhos esta view não posiciona vai `collapsed: true`, e o interior dela é a
view cujo `focus` é ela.

| View | `focus` | O que posiciona |
| --- | --- | --- |
| `otel-host` | `host` | `process` (collapsed) à esquerda, `collector` à direita, o canal entre os dois |
| `otel-process` | `process` | `app` à esquerda, `propagators` na borda de cima, as três molduras empilhadas à direita (collapsed) |
| `otel-tracer-provider` | `tracer-provider` | placas na borda, `sampler` com as três saídas, `span-processors` (collapsed), `trace-flush` na faixa de controle |
| `otel-logger-provider` | `logger-provider` | mesma moldura: placa, `trace-gate`, `log-processors` (collapsed), `log-flush` |
| `otel-meter-provider` | `meter-provider` | mesma moldura: placas, `points` no lugar da fila, `metric-reader` na faixa de controle, `metric-exporter` |
| `otel-batch-processor` | `batch-processor` | `queue`, `batch-timer` acima, `span-exporter` |

`registro: "blocos"` em todas — preta é dado, vermelha é controle. Não há registro de
esquemático aqui: não se desce a transistor num SDK.

### 8.3 Restrições de layout que o LOD impõe

O LOD não pergunta em que nível o leitor está; pergunta **quanto do quadro esta caixa
ocupa**, pelo lado que aperta (`fracaoDoQuadro` usa `Math.min`). Interior começa a aparecer
em `0.24` e fica cheio em `0.5`.

Consequência direta: se as três molduras de provider em `otel-process` ficarem abaixo de
24% do quadro no eixo apertado, o leitor **não vê a assimetria de F4 sem clicar**. Então o
arranjo de `otel-process` é de duas colunas — `app` estreita à esquerda, molduras largas à
direita — e cada moldura fica acima do limiar por folga, não por empate. Os números finais
saem do teste de LOD, não deste documento.

### 8.4 Cor

Uma tinta. **Os três providers não são três cores** — colori-los sugeriria três naturezas,
quando a lição é que dois têm a mesma forma e um não. Cor sai de token, e cor de token só
existe no catálogo de `depth-ui/src/stage.css`; `pnpm catalogo` reprova hexadecimal no CSS
do lab.

### 8.5 O que pisca

Só o delta, e são três:

1. o bit `sampled` do `traceparent` virando, no L3
2. o campo `resource` aparecendo no envelope — a estampa da placa acontecendo
3. a fila recusando, e o `points` colapsando na linha de overflow

O resto é estado, e estado não pisca.

---

## 9. Os testes que impedem o lab de mentir

Além dos que todo mundo tem (mundo válido, view concorda com a árvore, determinismo por
semente), este lab tem dois que são dele.

### T1 — O invariante do envelope

> Para todo run e todo envelope que cruza o canal: `resourceSpans[i].resource` é igual à
> placa do provider que o emitiu, e `scopeSpans[j].scope.name` é igual ao escopo que o
> `app` usou.

É este teste que transforma o L3 de mock em projeção, e é o que sustenta a tese da §1 de
forma mecânica. As duas metades, como sempre: (⊆) o envelope não inventa campo; (⊇) nenhuma
placa deixa de aparecer nele.

### T2 — O contador do silêncio

> Com o provider substituído pelo no-op, o número de spans que o `app` criou é igual ao
> contador do `sink` no-op, e o `collector` recebeu zero.

Sem ele, "nada acontece" e "nada aparece" seriam indistinguíveis — que é exatamente a
confusão que F5 existe para desfazer.

---

## 10. O que fica de fora, e por quê

- **Interior do canal (L2)** — é o anexo *gRPC over HTTP/2* mais o lab `collector-pipeline`.
  Declarado opaco, refinável depois com o teste do `depth.md` §3 valendo
- **Retry e backoff no exportador** — a spec diz que o SDK padrão **não** deve implementar
  retry, porque a lógica depende do protocolo. Modelar retry aqui seria mentir sobre o SDK,
  e a ausência dele é conteúdo: virou linha da §6
- **`View` e agregação de métrica por dentro** — lab próprio. Aqui `views` é placa
- **Exemplars** — pertencem à correlação métrica↔trace, que é outro lab
- **Tail sampling** — fase 5, e é fora de processo
- **Payload de métrica e de log no L3** — D1
- **`labs/providers/` com compose real** — **não** está fora de escopo; é o bloco E do
  plano. O princípio 3 da spec do handbook exige contraparte real, e as fixtures OTLP
  capturadas dela é que alimentam os testes de `otel-domain`
- **Segundo processador na `pipeline`** — a `pipeline` nasce com um filho. Ordem como
  contrato só ensina com dois, e o segundo é o `simple-processor`, que entra quando houver
  fenômeno para ele

---

## 11. As fontes

Toda afirmação técnica deste documento sai daqui. Spec do OpenTelemetry, versão vigente
na data (1.60.0), consultada em 2026-08-31.

| Afirmação | Fonte |
| --- | --- |
| tracer só nasce de provider; o input vira `InstrumentationScope` | [Tracing SDK · Tracer Creation](https://opentelemetry.io/docs/specs/otel/trace/sdk/#tracer-creation) |
| `Shutdown` invoca `Shutdown` em todos os processadores internos; `ForceFlush` invoca em todos os registrados | [Tracing SDK · Shutdown](https://opentelemetry.io/docs/specs/otel/trace/sdk/#shutdown) · [ForceFlush](https://opentelemetry.io/docs/specs/otel/trace/sdk/#forceflush) |
| `DROP` / `RECORD_ONLY` / `RECORD_AND_SAMPLE`; padrão `ParentBased(root=AlwaysOn)` | [Tracing SDK · ShouldSample](https://opentelemetry.io/docs/specs/otel/trace/sdk/#shouldsample) · [Built-in samplers](https://opentelemetry.io/docs/specs/otel/trace/sdk/#built-in-samplers) |
| `RECORD_ONLY` chega no processador e não no exportador | [Tracing SDK · Recording Sampled reaction table](https://opentelemetry.io/docs/specs/otel/trace/sdk/#recording-sampled-reaction-table) |
| amostragem é consultada na **criação** do span, antes dos processadores | [Tracing SDK · SDK Span creation](https://opentelemetry.io/docs/specs/otel/trace/sdk/#sdk-span-creation) |
| processadores são invocados na ordem de registro | [Tracing SDK · Span processor](https://opentelemetry.io/docs/specs/otel/trace/sdk/#span-processor) |
| `maxQueueSize` 2048 e span **descartado** ao atingir; `scheduledDelayMillis` 5000; `maxExportBatchSize` 512 | [Tracing SDK · Batching processor](https://opentelemetry.io/docs/specs/otel/trace/sdk/#batching-processor) |
| o SDK padrão não deve implementar retry | [Tracing SDK · Export(batch)](https://opentelemetry.io/docs/specs/otel/trace/sdk/#exportbatch) |
| `ForceFlush` existe para o caso de o processo ser suspenso antes de exportar | [Tracing SDK · ForceFlush do processador](https://opentelemetry.io/docs/specs/otel/trace/sdk/#forceflush-1) |
| sem SDK instalado, a API devolve no-op | [Tracing API · Behavior in the absence of an installed SDK](https://opentelemetry.io/docs/specs/otel/trace/api/#behavior-of-the-api-in-the-absence-of-an-installed-sdk) |
| `Resource` é do provider e vale para tudo que ele produz (traces, métricas, logs) | [Resource SDK](https://opentelemetry.io/docs/specs/otel/resource/sdk/) · [Metrics SDK · MeterProvider](https://opentelemetry.io/docs/specs/otel/metrics/sdk/#meterprovider) · [Logs SDK · LoggerProvider](https://opentelemetry.io/docs/specs/otel/logs/sdk/#loggerprovider) |
| configuração **MUST** ser do provider (readers, exporters, views / processadores) | [Metrics SDK · Configuration](https://opentelemetry.io/docs/specs/otel/metrics/sdk/#configuration) · [Logs SDK · Configuration](https://opentelemetry.io/docs/specs/otel/logs/sdk/#configuration) |
| `MetricReader.Collect` é pull; exportador pull só manda quando pedem, e `ForceFlush` não faz sentido nele | [Metrics SDK · MetricReader](https://opentelemetry.io/docs/specs/otel/metrics/sdk/#metricreader) · [Pull Metric Exporter](https://opentelemetry.io/docs/specs/otel/metrics/sdk/#pull-metric-exporter) |
| `exportIntervalMillis` padrão 60000 | [Metrics SDK · Periodic exporting MetricReader](https://opentelemetry.io/docs/specs/otel/metrics/sdk/#periodic-exporting-metricreader) |
| limite de cardinalidade padrão 2000, e o excedente **colapsa** em `otel.metric.overflow` | [Metrics SDK · Cardinality limits](https://opentelemetry.io/docs/specs/otel/metrics/sdk/#cardinality-limits) · [Overflow attribute](https://opentelemetry.io/docs/specs/otel/metrics/sdk/#overflow-attribute) |
| o `LoggerProvider` configura processadores e **não** tem amostrador | [Logs SDK · LoggerProvider](https://opentelemetry.io/docs/specs/otel/logs/sdk/#loggerprovider) |
| `LoggerConfig.trace_based`: registro de trace não amostrado é descartado pelo `Logger`; padrão `false` | [Logs SDK · LoggerConfig](https://opentelemetry.io/docs/specs/otel/logs/sdk/#loggerconfig) |
| envelope `ResourceSpans → ScopeSpans → Span` | [OTLP · protocolo](https://opentelemetry.io/docs/specs/otlp/) · [`trace.proto`](https://github.com/open-telemetry/opentelemetry-proto/blob/main/opentelemetry/proto/trace/v1/trace.proto) |
| `traceparent` e o bit `sampled` | [W3C Trace Context](https://www.w3.org/TR/trace-context/) |

O livro *Learning OpenTelemetry* não aparece nesta tabela, e não deve: ele dá a ordem das
fases, nunca a verdade técnica.

---

## 12. O que este round devolve ao motor

Tradição do repo: um round que só consome o motor não o exercita. Cinco achados, e nenhum
deles cria `kind`.

1. **`router` descrito de um lado só.** Um amostrador é demux; o texto do catálogo é mux.
   Registrado, não corrigido: falta o segundo alvo
2. **`static` sai do teste e entra em modelo.** Cinco placas, e elas carregam a tese. A
   regra "placa não tem porta" passa a ter consequência de desenho, não só de validação
3. **Primeira linha de controle entre subárvores irmãs.** Se `validateWorld` recusar, é
   tarefa no motor
4. **`sequencer` usado como relógio periódico, e não como máquina de fases.** Talvez
   `sequencer` sejam duas coisas. Registrado; não se divide `kind` com um caso
5. **Primeiro objeto declarado opaco.** O canal e o Collector obrigam a responder a decisão
   aberta nº 6 do `depth.md`: como o opaco aparece sem parecer defeito

E um retorno que não é de motor: **a peça de predição** (D9) é a primeira coisa do repo
escrita para os três handbooks ao mesmo tempo.

---

## 13. Como saber se deu certo

1. `new World(otelWorld())` não lança, e as seis views passam `viewDisagreement === null`
2. T1 passa: o envelope do L3 concorda com as placas do L0 em todo run
3. T2 passa: o contador do no-op fecha com o que o `app` criou, e o `collector` fica em zero
4. Baixar a amostragem acende a porta `recorded`, e o `collector` **não** recebe o que saiu
   por ela
5. Ligar `trace_based` e baixar a amostragem faz o `log-exporter` parar — pela linha de
   controle, sem código de log saber o que é amostragem
6. Encerrar sem flush perde a fila; com flush, não perde. Mesma semente, um parâmetro
7. Na linha do tempo, métricas saem uma vez a cada doze saídas de trace, com os padrões da
   spec — e o número sai do modelo, não de rótulo
8. Alternar `otel-tracer-provider` ↔ `otel-meter-provider` não move nenhuma borda: só o
   interior troca
9. `pnpm boundaries` verde: `depth-core`, `depth-ui` e `model-format` continuam sem saber o
   que é provider, amostrador ou recurso
10. `labs/queue` e `labs/batch` nascem depois disto sem **nenhuma** linha nova de domínio —
    se precisarem, a árvore está no lugar errado, e isso é achado
