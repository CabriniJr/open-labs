# Formato do modelo: `model` e `modelet`

**Status:** **parcialmente implementado** em `packages/model-format` (`@ovh/model-format`).
O `modelet` das §3 e §3.1 é lido, validado e compilado para um mundo que o motor roda. O
`model` da §4 e tudo que depende dele — procedência, âncora, `valid_for` — continua
proposta. A tabela da §0 abaixo diz, campo a campo, o que é código.
**Data:** 2026-08-28 (proposta), 2026-08-29 (implementação parcial)
**Depende de:** `VISION.md`, `kinds.md`, `depth.md`

---

## 0. O que já é código, e o que ainda é proposta

Um documento de formato que não diz o que está implementado manda o autor tentar coisas
que não existem.

| Parte | Situação |
|---|---|
| `modelet`: `ports`, `params`, `children`, `wires`, `teaches`, `not_modeled` (§3) | **Código.** `parseModelet` valida, inclusive as regras que só valem olhando o documento inteiro |
| As cinco garantias da §3.1 | **Código**, com uma ressalva: `{ param: x }` é aceito, e o compilador recusa argumento que o `kind` não implementa |
| Compilar para o motor | **Código.** `compileModelet` devolve um `WorldSpec` |
| `kind` das ondas futuras (`clock`, `batch`, `transform`, …) | **Recusado com mensagem que diz em que onda ele chega.** Fingir que compila produziria um lab que roda errado |
| `kind` de hoje que compila como filho | Só `source`, `buffer` e `sink`. `composite`, `pipeline`, `channel`, `router` e `static` são recusados, cada um com o seu motivo |
| Linha de controle até um filho | **Recusado**: nenhum `kind` de hoje tem porta de controle. Entre portas da fronteira, vale |
| `modelet` dentro de `modelet` | Proposta |
| `model` inteiro (§4): `components`, `boundary`, procedência, `anchor`, `valid_for` | Proposta |

O que a implementação acrescentou e não estava escrito aqui: **porta órfã e parâmetro morto
são erro**, a direção da porta é conferida no uso, e duas linhas de dado saindo da mesma
porta são recusadas (replicar carga é o `tee`, da onda 1).

Nomenclatura decidida pelo Luigi em 28/08/2026: **`.model`** para o agregado que replica
uma aplicação, **`.modelet`** para o componente. Resolve a crítica registrada em
`VISION.md` §9.6 — `model` é palavra, e `modelet` se lê como diminutivo sem esforço.

Ressalva pequena, e é de empacotamento, não de nome: `.model` sozinho é extensão genérica
demais para não colidir com outra ferramenta na máquina de alguém. Proposta:
**`<slug>.model.yaml`** e **`<slug>.modelet.yaml`** — mantém a palavra, ganha realce de
sintaxe e validação por schema de graça em qualquer editor.

---

## 1. Três camadas, não duas

| Camada | O que é | Onde vive | Quem escreve |
|---|---|---|---|
| **`kind`** | Primitivo do motor. Comportamento em código | `packages/depth-core` | Quem mantém o motor. Dezenove deles (`kinds.md` §7) |
| **`modelet`** | Composição de `kind` parametrizada | Dentro do `model` que o usa | Autor de conteúdo |
| **`model`** | Composição de `modelet` que replica **uma aplicação** | Pacote publicável e **independente** | Autor de conteúdo |

**Corte de escopo de 28/08/2026: cada `model` é ilha — mas ilha com porto.** Sem intercâmbio
implementado, sem biblioteca compartilhada obrigatória, sem teste de compatibilidade entre
`model`s. Mas **a fronteira externa é declarada desde já**, para que ligar dois `model` um dia
seja acrescentar um canal, não reabrir os dois. Justificativa em `why-simulate.md` §9.

### 1.1 A granularidade de um `model` é a tecnologia como ela é operada

Um `model` é uma tecnologia — OpenTelemetry, Kafka — mas na granularidade em que se instala e
se opera, **não** o guarda-chuva inteiro.

| Certo | Errado |
|---|---|
| `otel-collector`, `otel-sdk-trace` | `opentelemetry` — viraria um `model` gigante sem fim |
| `kafka-broker`, `kafka-producer` | `kafka` |

A régua é a mesma de sempre: o que produz um conjunto coeso de fenômenos. Um `model` que não
cabe num handbook é dois `model`.

### 1.2 A fronteira externa, e por que declará-la agora custa quase nada

Todo `model` declara o que entra e o que sai:

```yaml
model: otel-collector
boundary:
  inbound:
    otlp_in:  { accepts: otlp-request, transport: grpc }
  outbound:
    otlp_out: { emits: otlp-request, transport: grpc }
```

**Custo hoje: zero**, porque o `model` precisa disso de qualquer forma — o handbook tem de
saber por onde a telemetria entra, e o importador de manifesto precisa saber quais serviços
conversam. Está sendo declarado, não construído.

**Custo de não declarar:** no dia em que quiser ligar `otel-collector` em `kafka-broker`,
descobre que nenhum dos dois tem fronteira definida e precisa reabrir os dois.

Na v0 a fronteira é alimentada por contorno: um `source` sintético do lado de dentro gera o
que entraria, e um `sink` consome o que sai. **Ligar dois `model` um dia é exatamente o teste
de refinamento de `depth.md` §3** — trocar a folha aproximada (o `source` sintético) pela
subárvore real (o outro `model`), exigindo equivalência na fronteira. O mecanismo já existe e
não precisa ser inventado.

### 1.3 O que trava ligar `model`s não é o formato — é o tempo

Registrar isso evita a ilusão de que "só falta conectar".

Declarar porta é barato. O que é caro é **regime de execução**: o Collector e um broker têm
semântica de tempo diferente, e o motor hoje tem um escalonador único e global (ordem
topológica por tick). Ptolemy II resolve isso com um *director* por nível hierárquico, e essa
lacuna já está registrada em `VISION.md`.

Então a ordem honesta é: **porta agora, tempo quando houver necessidade real.** Prometer
ligação antes de resolver regime seria voar perto do sol — e é justamente o que este corte
evita.

Isso muda o que a camada do meio promete, e vale ser explícito porque a versão anterior deste
documento afirmava o contrário.

| | Antes | Agora |
|---|---|---|
| `modelet` reusável entre `model`s | Requisito de desenho | **Não é requisito.** Se acontecer, é observação |
| Onde mora | Biblioteca compartilhada | Dentro do `model`, até haver evidência de repetição |
| O que justifica a camada | Reuso | **Estrutura**: portas, `params`, `teaches`, `not_modeled` são úteis mesmo sem reuso |

A troca é boa. Some o pior risco de versionamento — `modelet` mudando e quebrando três
`model` — e cada `model` passa a entregar sozinho, sem precisar acertar a abstração
compartilhada antes de o primeiro ficar pronto.

### 1.4 O mecanismo de reuso já existe, e se chama anexo

**Corrigido em 28/08/2026.** A camada `modelet` foi proposta sem que este documento soubesse
que a spec do handbook (§5) já define **The Wire**: um acervo de anexos reutilizáveis de
primeira classe, incorporáveis inline por qualquer lab. Acervo inicial: gRPC sobre HTTP/2,
codificação protobuf, W3C Trace Context, OTLP, e OTLP/HTTP contra gRPC.

A justificativa lá é literalmente a mesma que foi usada aqui para `modelet`: *um lab incorpora o
anexo em vez de reexplicar; é o que impede o handbook de virar trinta explicações rasas
repetidas.*

| | `modelet` de biblioteca (proposto aqui) | Anexo do The Wire (já especificado) |
|---|---|---|
| Unidade de reuso | Composição de `kind` | Peça de conteúdo com simulação |
| Escopo | Entre `model` | Entre labs |
| Estado | Hipótese | **Desenhado, com acervo inicial listado** |

Conclusão honesta: **o anexo já ocupa o papel.** Criar um segundo vocabulário para a mesma
função contraria a regra da spec do motor de que o vocabulário do motor não vira conteúdo — e
foi exatamente a crítica feita a `.modlet` em `VISION.md` §9.6, agora aplicável ao que este
documento propôs.

Recomendação: **manter `modelet` apenas como estrutura interna de composição** — portas,
`params`, `teaches` — e usar **anexo** como a unidade de reuso visível ao autor e ao leitor. Uma
palavra, um papel.

Fila com lote disparado por tempo aparece no BatchSpanProcessor, no produtor do Kafka e no
remote write do Prometheus. **Isso agora é uma observação interessante, não uma promessa.** Se
o padrão se repetir de fato, extrair um anexo depois de vê-lo duas vezes é refactor barato — e é
a ordem correta de qualquer jeito.

## 2. O que um `model` modela: conceito, não implementação

Regra estabelecida em 28/08/2026:

> Um `model` é sobre **o conceito e o comportamento** de um componente, não sobre a
> especificidade de uma implementação. Existe *instrumentador*; não existe *instrumentador
> de C++*.

É trava de escopo, e das mais úteis do projeto, porque ataca três riscos já registrados de
uma vez:

| Risco | Como esta regra ataca |
|---|---|
| Apodrecimento quando o upstream muda (`VISION.md` §9.5) | Conceito muda muito mais devagar que campo de configuração |
| `params` inflando até virar formulário (§7) | Parâmetro específico de linguagem simplesmente não é elegível |
| Reuso de `modelet` não comprovado (`VISION.md` §9.2) | Modelar comportamento aumenta a chance de o mesmo `modelet` servir dois alvos |

Também é o que faz o público-alvo bater: quem opera plataforma precisa entender *o que o
span processor faz*. Se ele precisar do detalhe da implementação em Java, a fonte certa é o
código, e nenhuma ferramenta visual vai competir com ele.

### 2.1 A régua operacional: existe especificação separada da implementação?

"Conceito" é palavra escorregadia, e sem critério ela vira desculpa. Proposta de critério
verificável:

| Situação | O `model` ancora em | Exemplos |
|---|---|---|
| Existe especificação independente | **A especificação** | OTel (spec do SDK e do OTLP), Compose Spec, protocolo do Kafka, MQTT |
| Só existe implementação | **Uma implementação de referência, declarada** | Ferramenta sem spec própria |

Isso resolve uma contradição aparente com o contrato de fidelidade. Procedência exige
`source.native` — mas se o modelo é conceitual, qual é o nativo? Resposta: **o nome que a
especificação define.** `OTEL_BSP_MAX_QUEUE_SIZE` é conceitual *e* tem procedência, porque a
spec do OTel define a variável e o default. É o melhor dos dois.

Quando não há spec, o `model` declara a implementação de referência. Fingir conceito onde só
existe implementação seria mentir, e é pior que declarar.

### 2.2 Quando o conceito é um, e quando são dois

O ponto onde a regra pode ensinar errado. Às vezes o comportamento **é** a especificidade:
o modelo de concorrência de um instrumentador em Python e em Go produz comportamento de fila
diferente, e o operador vai encontrar essa diferença na vida real.

Régua proposta:

> Variantes que diferem em **parâmetro** são um `model`. Variantes que diferem em
> **topologia** são dois — e nesse caso o conceito nunca foi um.

Concorrência de um contra N cabe em parâmetro: um `model` só, com variante. Se uma variante
exigir um componente que a outra não tem, são dois `model`, e juntá-los apagaria um fenômeno
real.

### 2.3 "Grande release" não pode ser o major do semver

A intenção está certa — ancorar em release grande, não em cada patch — mas o major não serve
como critério. O Collector está em `0.109`. O Kafka muda comportamento observável em minor.
Semver descreve compatibilidade de API, não de comportamento.

Definição operacional proposta, com dois campos:

| Campo | O que declara |
|---|---|
| `valid_for` | A faixa de versões em que **os fenômenos modelados** valem |
| `verified_at` | Data e versão exata contra a qual o modelo foi conferido |

A faixa muda quando um fenômeno modelado muda — não quando a versão muda. Um `model` pode
atravessar dez releases sem revisão, e precisar de revisão num patch que mexeu num default.

Isso é a resposta honesta à §9.5 da visão. Não é "o material não apodrece": é **"o material
declara quando foi verificado e contra o quê"**, e o leitor decide se confia. Um `model`
verificado há dois anos não está errado — está sem verificação, e isso fica visível.

### 2.4 Campos que a regra acrescenta

```yaml
model: span-processor
concept: Processador de spans          # o conceito, não o produto
anchor:
  kind: spec                            # spec | implementation
  spec: opentelemetry-specification
  section: trace/sdk#span-processor
valid_for: ">=1.0 <2.0"                 # faixa de fenômeno, não de API
verified_at:
  date: 2026-08-28
  version: "1.37.0"
out_of_scope:                           # explícito, e é conteúdo didático
  - detalhes de threading por linguagem
  - alocação de memória do SDK
  - nomes de classe de qualquer implementação
```

`out_of_scope` não é rodapé defensivo. É o campo que impede a próxima pessoa de "completar"
o modelo com o que foi deliberadamente deixado fora, e vira texto visível na interface — a
caixa que admite não saber, em forma de dado.

### 2.5 A tensão com o manifesto, que é real

O `compose` traz implementação concreta e versionada: `otel/opentelemetry-collector:0.109.3`.
O modelo é conceitual. Então o resolvedor mapeia **implementação concreta para conceito**, e
há perda no caminho.

Isso precisa ser dito na tela, não escondido:

> Você rodou `0.109.3`. Este modelo cobre o conceito, verificado em `0.108`, válido de
> `0.100` a `0.115`.

Sem essa frase, quem opera plataforma vai assumir precisão de versão que o modelo não tem —
e vai descobrir do pior jeito, num parâmetro que mudou de default. Com ela, o modelo continua
útil e honesto ao mesmo tempo.

---
---

## 3. Anatomia de um `modelet`

Exemplo real, e escolhido de propósito: o BatchSpanProcessor é o objeto mais didático do
OTel e o que mais se repete em outras ferramentas.

```yaml
# batch-processor.modelet.yaml
modelet: batch-processor
version: 1
title: Processador com fila e lote
state: refined          # opaque | approximate | refined  (depth.md §2)

ports:
  in:
    role: data
    direction: in
    accepts: item
  out:
    role: data
    direction: out
    emits: item-batch
  dropped:
    role: data
    direction: drop     # descarte é porta, para o medidor ser honesto
    emits: item

params:
  queue_capacity:
    type: int
    default: 2048
    unit: items
  batch_max_items:
    type: int
    default: 512
    unit: items
  flush_interval:
    type: duration
    default: 5s
  on_full:
    type: enum
    values: [drop_new, drop_old, block]
    default: drop_new

children:
  queue:
    kind: buffer
    capacity: { param: queue_capacity }
    on_full:  { param: on_full }
  timer:
    kind: clock
    every: { param: flush_interval }
  batcher:
    kind: batch
    max_items: { param: batch_max_items }

wires:
  - { from: in,           to: queue.in }
  - { from: queue.out,    to: batcher.in }
  - { from: queue.drop,   to: dropped }
  - { from: timer.tick,   to: batcher.trigger, line: control }
  - { from: batcher.out,  to: out }

teaches:
  - phenomenon: a fila enche e passa a descartar
    perturbation: burst na entrada
    watch: [queue.occupancy, dropped.rate]
  - phenomenon: lote parte por tempo, não por tamanho
    perturbation: tráfego rarefeito
    watch: [batcher.batch_size, batcher.wait]

not_modeled:
  - alocação de memória por item
  - custo de CPU da serialização, que vive no transform seguinte
```

### 3.1 O que o formato garante por construção

| Regra | Como o formato garante |
|---|---|
| Só folha tem comportamento | `children` só aceita `kind` ou outro `modelet`. Não existe campo de comportamento |
| Cano não transforma | `wires` não tem campo de transformação. Mudar forma exige um filho `transform` |
| Descarte é visível | `drop` é porta declarada, e medidor lê porta |
| Controle não se confunde com dado | `line: control` no wire, e a porta declara `role` |
| Sem lógica no dado | Parâmetro é referência estruturada (`{ param: x }`), **nunca interpolação de string** |

A última é a trava mais importante do documento inteiro.

> **Se um `modelet` precisa de condicional, laço ou expressão, ele não precisa de sintaxe —
> precisa de um `kind` novo.**

Sem essa trava, o formato viraria uma linguagem de programação em YAML, que é o pior dos
dois mundos: nem legível por humano, nem depurável por ferramenta. E mataria a §9.3 da
visão, porque geração assistida produziria lógica plausível impossível de revisar.

---

## 4. Anatomia de um `model`

O `model` faz três coisas e nenhuma delas é comportamento: **instancia** modelets,
**parametriza** com procedência, e **liga**.

```yaml
# otel-collector.model.yaml
model: otel-collector
version: 1
title: OpenTelemetry Collector
concept: Coletor de telemetria com receptor, processamento e exportação
anchor:
  kind: spec
  spec: opentelemetry-collector
  section: configuration
valid_for: ">=0.100 <0.116"
verified_at:
  date: 2026-08-28
  version: "0.109.0"
out_of_scope:
  - implementação em Go e suas goroutines
  - o sistema de extensões e o mecanismo de build do contrib
upstream:
  project: opentelemetry-collector
  version: "0.109.0"
  docs: https://opentelemetry.io/docs/collector/configuration/

components:
  receiver:
    modelet: otlp-receiver
    params:
      max_request_size:
        value: 4MiB
        source:                          # procedência obrigatória
          native: receivers.otlp.grpc.max_recv_msg_size_mib
          docs: "#otlp-receiver"

  processor:
    modelet: batch-processor             # o mesmo da §3, reusado
    params:
      batch_max_items:
        value: 512
        source:
          native: processors.batch.send_batch_size
          docs: "#batch-processor"
      flush_interval:
        value: 200ms
        source:
          native: processors.batch.timeout
          docs: "#batch-processor"

  serializer:
    modelet: otlp-serializer

  exporter:
    modelet: otlp-exporter
    state: approximate                   # declarado, não escondido
    approximation: >
      Enquadramento HTTP/2 e controle de janela são aproximados por um canal
      com capacidade. Refinar exige o modelet http2-frame.

wires:
  - { from: receiver.out,   to: processor.in }
  - { from: processor.out,  to: serializer.in }
  - { from: serializer.out, to: exporter.in }

budget:                                  # VISION.md §7.2
  memory: 512
  unit: abstract-units
  source:
    native: deploy.resources.limits.memory
```

### 4.1 Procedência é campo obrigatório, não convenção

Todo parâmetro com `value` exige `source.native`. O CI recusa o pacote sem isso.

Esse é o contrato de fidelidade transformado em **dado validável**, e é o que torna a
autoria assistida segura (`roadmap.md`, última seção): compor dado errado é localizável e
difável. Comportamento errado escondido numa função, não.

---

## 5. O handbook é uma travessia declarada

O handbook não é documento paralelo. É **ordem de visita** sobre o `model` — e ela
implementa o currículo bottom-up de `depth.md` §4.3 movendo a raiz.

```yaml
# otel-collector.handbook.yaml
handbook: otel-collector
title: Como o Collector decide o que fazer com um span

stops:
  - id: fila
    root: processor.queue                # começa fundo: uma peça
    phenomenon: a fila enche e descarta
    perturbation: burst
  - id: lote
    root: processor                      # sobe: a peça dentro do modelet
    phenomenon: lote parte por tempo
    perturbation: tráfego rarefeito
  - id: caminho
    root: /                              # sobe: a aplicação inteira
    phenomenon: o span atravessa e muda de forma no serializer
  - id: saida-fecha
    root: /
    phenomenon: a saída fecha e o backpressure sobe até a fonte
    perturbation: janela fechada
```

Cada `stop` é um lab. A raiz sobe, a árvore não muda — exatamente o mecanismo da §4.3. E
como `phenomenon` referencia o que o `modelet` declarou em `teaches`, o CI pode verificar
que **nenhuma parada promete fenômeno que nenhum componente sabe produzir**. Isso é o
antídoto contra roteiro: prometer fenômeno inexistente passa a ser erro de build.

---

## 6. Onde o manifesto real entra

O `compose` não gera `modelet`. Ele **escolhe e parametriza** os que já existem
(`VISION.md` §5).

| Camada | Do manifesto | Produz |
|---|---|---|
| Esqueleto | `services`, `depends_on`, `networks` | Componentes da raiz e canais |
| Recheio | resolvedor imagem → `model` | A subárvore, vinda do pacote |
| Ajuste | `environment` e arquivo montado por `volumes` | `params` com `source` preenchido |
| Orçamento | `deploy.resources.limits` | `budget` |
| Supervisão | `restart:` | O `supervisor` de `kinds.md` §4 |

Serviço sem `model` correspondente entra como componente **`state: opaque`** — declarado,
nunca caixa vazia.

Nota sobre o `restart:`: é um achado pequeno e agradável. O compose já traz a política de
reinício, então o `supervisor` não precisa de configuração inventada — o fenômeno "estourou
memória, morreu, perdeu o que estava na fila" sai do manifesto que o leitor escreveu.

---

## 7. Riscos deste desenho

1. ~~**Reuso de `modelet` é hipótese, não fato.**~~ **Resolvido pelo corte de escopo de
   28/08/2026** (`why-simulate.md` §9): reuso deixou de ser requisito, então deixou de ser
   risco. O que sobrou é menor: sem reuso, a camada do meio se justifica só pela estrutura —
   ver risco 5
2. ~~**Versionamento não resolvido.**~~ **Some com o corte.** `model` como ilha não quebra
   outro `model`. Volta se algum dia houver biblioteca compartilhada, e aí o teste de contrato
   é o mesmo teste de refinamento de `depth.md` §3
3. **Pressão constante para adicionar sintaxe.** Cada caso difícil vai sugerir um
   condicional. A trava da §3.1 só sobrevive se a resposta padrão for "isso é um `kind`"
4. **`params` pode inflar até virar formulário de configuração.** Régua: parâmetro que não
   muda nenhum fenômeno visível não deveria existir, mesmo existindo na ferramenta real
5. **Três camadas é uma a mais para aprender.** Se na prática todo `modelet` for usado por
   um único `model`, a camada é burocracia e deveria ser fundida. Vale medir em vez de
   assumir
6. **"Conceito" pode virar desculpa para não pesquisar.** A regra da §2 é boa e tem um modo
   de falhar: modelar raso e chamar de conceitual. O antídoto é a §2.1 — se existe
   especificação, o `model` ancora nela, e ancorar exige ler. `model` sem `anchor.section`
   apontando para trecho específico é sinal de conceito presumido, não pesquisado
7. **`verified_at` torna o apodrecimento visível, não o impede.** Sem processo de
   reverificação, o campo documenta a decadência com precisão e nada mais

## 8. Decisões abertas

1. `<slug>.model.yaml` ou `.model` puro?
2. `modelet` mora em arquivo próprio ou embutido no `model` que o usa? Proposta: arquivo
   próprio para os reusáveis, embutido para os específicos, com a promoção sendo um refactor
   barato
3. Um `model` pode conter outro `model`? Um Collector dentro de uma topologia de gateway é
   isso. Proposta: sim, e `model` é apenas um `modelet` com pacote e handbook próprios — o
   que reduziria três camadas a duas com um papel extra
4. Como o `handbook` referencia raiz sem acoplar ao caminho? `processor.queue` quebra se o
   componente for renomeado. Alternativa: apontar por `id` estável
5. Onde a biblioteca de `modelet` vive: no pacote, no repositório, ou publicada?
6. **Como variante se declara** (§2.2). Um `model` com variantes por parâmetro precisa de
   sintaxe para isso, ou variante é só um `model` que reusa os mesmos `modelet`?
7. **Quem reverifica, e com que gatilho** (§7.7). Reverificação manual por release não
   escala; monitorar default de upstream automaticamente é caro. Talvez o gatilho certo seja
   o próprio uso: o modelo pede reverificação quando alguém importa manifesto com versão
   fora do `valid_for`
