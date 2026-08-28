# Formato do modelo: `model` e `modelet`

**Status:** proposta para discussão. Nada implementado.
**Data:** 2026-08-28
**Depende de:** `VISION.md`, `kinds.md`, `depth.md`

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
| **`modelet`** | Composição de `kind` parametrizada e **reusável** | Biblioteca, validada por schema | Autor de conteúdo |
| **`model`** | Composição de `modelet` que replica **uma aplicação** | Pacote publicável | Autor de conteúdo |

A camada do meio é a que quase não existiu, e ela é o que decide se o projeto escala.

**Se `modelet` não for reusável entre `model`s, a tese morre um nível acima do motor.** Os
arquétipos generalizam — isso é a aposta de `kinds.md`. Mas se cada aplicação tiver de
reescrever "fila mais lote mais gatilho" do zero, o ganho de generalização para no motor e
nunca chega ao conteúdo, que é onde o custo realmente está.

Fila com lote disparado por tempo aparece no BatchSpanProcessor, no produtor do Kafka e no
remote write do Prometheus. **É um `modelet`, parametrizado três vezes** — não três
composições parecidas.

---

## 2. Anatomia de um `modelet`

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

### 2.1 O que o formato garante por construção

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

## 3. Anatomia de um `model`

O `model` faz três coisas e nenhuma delas é comportamento: **instancia** modelets,
**parametriza** com procedência, e **liga**.

```yaml
# otel-collector.model.yaml
model: otel-collector
version: 1
title: OpenTelemetry Collector
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
    modelet: batch-processor             # o mesmo da §2, reusado
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

### 3.1 Procedência é campo obrigatório, não convenção

Todo parâmetro com `value` exige `source.native`. O CI recusa o pacote sem isso.

Esse é o contrato de fidelidade transformado em **dado validável**, e é o que torna a
autoria assistida segura (`roadmap.md`, última seção): compor dado errado é localizável e
difável. Comportamento errado escondido numa função, não.

---

## 4. O handbook é uma travessia declarada

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

## 5. Onde o manifesto real entra

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

## 6. Riscos deste desenho

1. **Reuso de `modelet` é hipótese, não fato.** O documento afirma que fila-com-lote serve
   OTel, Kafka e Prometheus. Isso só se comprova no segundo `model`. O teste está no
   `roadmap.md` F6: se o Kafka exigir reescrever o `batch-processor` em vez de
   reparametrizá-lo, a camada do meio não está pagando
2. **Versionamento é problema real e não resolvido.** `modelet` versionado muda e quebra
   `model` que o usa. Precisa de resolução de versão e de teste de contrato na fronteira —
   que é, felizmente, o mesmo teste de refinamento de `depth.md` §3
3. **Pressão constante para adicionar sintaxe.** Cada caso difícil vai sugerir um
   condicional. A trava da §2.1 só sobrevive se a resposta padrão for "isso é um `kind`"
4. **`params` pode inflar até virar formulário de configuração.** Régua: parâmetro que não
   muda nenhum fenômeno visível não deveria existir, mesmo existindo na ferramenta real
5. **Três camadas é uma a mais para aprender.** Se na prática todo `modelet` for usado por
   um único `model`, a camada é burocracia e deveria ser fundida. Vale medir em vez de
   assumir

## 7. Decisões abertas

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
