# Roteiro do handbook de OpenTelemetry

Um roteiro por lab: a pergunta que o lab responde, o erro que ele desfaz, a mídia
escolhida e o porquê, o que o showcase conta, o que a simulação deixa quebrar,
o que a terceira dimensão significa, os ícones, com quem o lab conversa, e o
critério de pronto. É o contrato de conteúdo do handbook. O de forma está em
`.claude/skills/openlabs-lab/SKILL.md`.

Atualize este arquivo **no mesmo PR** que cria ou muda um lab. Um lab que foge
do roteiro deve mudar o roteiro primeiro, com o motivo.

## As regras que valem para todo lab deste handbook

1. **Uma pergunta, um mal-entendido.** O título do lab é a pergunta. O lab
   existe para desfazer um erro que alguém comete em produção, e o erro aparece
   escrito no lab (Predição ou "Break it").
2. **O dado vem do modelo, nunca do desenho.** Bytes, contagens, caminhos e
   tamanhos saem de um modelo de domínio testado (`packages/otel-domain`). O
   filme é derivado do modelo: se o modelo muda, o filme muda junto.
3. **Showcase e simulação são duas mídias do mesmo assunto.** O showcase
   (filme com câmera, narração e pacotes) mostra o caminho certo. A simulação
   deixa o leitor errar. Todo lab novo nasce com os dois. Um lab antigo ganha o
   showcase quando a fila abaixo chegar nele.
4. **A terceira dimensão tem significado ou não existe.** Altura é sempre uma
   grandeza do domínio: profundidade de aninhamento (protobuf), camada de
   implantação (nó, agent, gateway), nível de zoom (descida). Altura decorativa
   é proibida.
5. **Um papel, um ícone, em todo lab.** Os ícones são `ICONES_OTEL`
   (`packages/otel-domain/src/icones/icones.ts`). O Collector tem a mesma cara
   na vitrine, na propagação e no Agent-ou-gateway. Um papel novo ganha ícone
   novo no catálogo, nunca um desenho solto no filme.
6. **Os labs se citam.** Cada lab diz, no texto e no filme quando couber, de
   onde vem o conceito que ele usa e para onde ele leva. A seção "Correlações"
   abaixo é a fonte. A prosa do lab (`Where this connects`) a segue.
7. **Verbo antes de byte.** O showcase conta, em frases curtas com verbo, o
   que cada peça faz com a coisa que viaja. O formato é o papelzinho pulando de
   app em app e uma tela ao lado somando o texto, como no hero antigo,
   modernizado no filme. A profundidade é descer *dentro* do papel. O detalhe
   de máquina (hexa, offsets) fica na simulação. O motor de fluxos não é
   obrigatório: o protobuf não usa.
8. **Janela à esquerda, andamento à direita.** No showcase e no 3D, a cena fica
   à esquerda e os capítulos, a narração e o painel do nível ficam à direita
   (`MotionPlayer`, por container query). Não reimplemente o layout no lab.

## Ícones do handbook

| ícone | papel | onde aparece |
|---|---|---|
| `otel` | o projeto / o Collector no mapa geral | hero |
| `browser` | origem da requisição no cliente | propagação |
| `service` | aplicação instrumentada (app + SDK) | vitrine, propagação, hero |
| `sdk` | o SDK como peça | protobuf; *a aplicar* em providers |
| `collector` | Collector (qualquer implantação) | vitrine, propagação, implantação |
| `agent` | Collector como DaemonSet no nó | implantação |
| `gateway`, `proxy` | borda e intermediário | propagação |
| `receiver`, `limiter`, `batch`, `exporter`, `processor` | componentes do pipeline | vitrine |
| `backend` | armazenamento do backend | vitrine, implantação, hero |
| `queue` | fila / broker | *a aplicar* em propagação por fila |
| `host`, `pod` | infraestrutura | implantação, *a aplicar* em host signals |
| `trace`, `metric`, `log` | os três sinais | *a aplicar* em pilares e anatomia |
| `bytes` | payload no fio | vitrine do Collector (a requisição exportada) |
| `context`, `baggage` | propagação | contexto (a ficha do header: `baggage` quando ele viaja, `context` só com `traceparent`, nada quando o proxy descarta) |
| `sampler` | decisão de amostragem | *a aplicar* em amostragem |

## A espinha: fases e labs

Legenda de mídia: **fluxo** = motor de profundidade (`depth-ui`, mundo + vistas);
**estado** = modelo de estado com React; **filme** = `@ovh/motion` (showcase);
**3D** = `@ovh/stage3d` (vista Iso do mesmo filme); **livre** = interação React
própria (formulário, analisador, editor).

### Fase 1 — o problema

#### three-pillars — *Three pillars, one blind spot* · disponível (fluxo)
- **Pergunta.** Logs, métricas e traces do mesmo incidente bastam para achar a causa?
- **Mal-entendido.** "Ter os três sinais é ter observabilidade."
- **Mídia.** Fluxo: o leitor segue a mesma requisição pelos três sinais e vê onde a correlação se perde.
- **Showcase (a fazer).** 1) a requisição falha; 2) o log tem a mensagem e não tem o trace; 3) a métrica tem o pico e não tem a requisição; 4) o trace tem o caminho; 5) com `trace_id` no log e exemplar na métrica, os três se ligam. **3D:** três planos empilhados, um por sinal, e a requisição como uma coluna que os atravessa. A altura é o sinal.
- **Simulação.** Ligar e desligar a correlação (trace_id no log, exemplar) e ver qual pergunta deixa de ter resposta.
- **Ícones.** `trace`, `metric`, `log`, `service`.
- **Correlações.** → anatomy-of-a-trace (o que é um span), → a-log-that-knows-its-trace, → the-shape-of-a-metric.
- **Pronto quando.** Ganhar o showcase, e o `qa:labs` passar nos dois modos.

#### disconnected-signals — *The cost of disconnected signals* · a construir (filme + livre)
- **Pergunta.** Quanto tempo de incidente custa um sinal sem contexto?
- **Mal-entendido.** "Correlacionar é luxo; dá para cruzar por horário."
- **Mídia.** Filme de um incidente em tempo real, com relógio de MTTR. A versão livre é uma busca por horário que devolve dezenas de candidatos, contra uma busca por `trace_id` que devolve um.
- **Modelo.** Gerador de tráfego com N requisições concorrentes (domínio novo: `otel-domain/incidente`).
- **3D.** Linha do tempo como eixo de profundidade; cada requisição concorrente é uma faixa. Sem contexto, as faixas se sobrepõem.
- **Correlações.** ← three-pillars, → hard-context-and-baggage.

### Fase 2 — o modelo

#### anatomy-of-a-trace — *Anatomy of a Trace* · disponível (fluxo + filme + 3D)
- **Pergunta.** O que é um trace, se nenhum serviço o possui inteiro?
- **Mal-entendido.** "O trace é um objeto que um serviço cria e envia."
- **Showcase.** Feito (`anatomia/vitrine.ts`): a requisição cruza os quatro serviços com o `traceparent` (ícone `context`), cada span só sabe o pai, os spans saem quando terminam (o ledger chega primeiro) e o backend monta o waterfall com a mesma `montar` da simulação. **3D:** profundidade na árvore = altura, 14 por degrau, e o waterfall vira escada. **Interativo:** "um proxy derruba o header antes do payments" (duas árvores, outro tom) e "payments sem SDK" (o ledger se pendura no checkout, sem buraco) refazem o filme.
- **Simulação.** Perder um span intermediário e ver a árvore órfã.
- **Ícones.** `service`, `trace`, `backend`.
- **Correlações.** → hard-context-and-baggage (como o id viaja), → reading-an-otlp-payload (o id em bytes).

#### hard-context-and-baggage — *Hard context and baggage* · disponível (estado + filme + 3D)
- **Pergunta.** Como o `trace_id` atravessa processos, e o que o baggage carrega?
- **Mal-entendido.** "Baggage é atributo de span" / "o proxy propaga sozinho".
- **Showcase.** Já existe (nascimento, injeção, extração, fan-out, proxy, export). Ícones aplicados por serviço.
- **Lacuna.** Correlação explícita com o protobuf (traceparent em hex → 16 bytes). Os ícones `context` e `baggage` já estão nas fichas do header.
- **Correlações.** ← anatomy-of-a-trace, → reading-an-otlp-payload, → propagating-through-a-queue.

#### reading-an-otlp-payload — *Reading an OTLP payload* · disponível (filme + 3D + livre)
- **Pergunta.** O que exatamente sai no fio quando o SDK exporta um span?
- **Mal-entendido.** "O payload carrega os nomes dos campos" / "JSON e protobuf custam o mesmo" / "o comprimento de uma mensagem tem tamanho fixo".
- **Modelo.** `otel-domain/protobuf/codificar.ts`, um codificador real com os números de campo de `opentelemetry-proto`, que devolve o mapa de cada campo (offset, chave, wire type, profundidade).
- **Showcase (a viagem do papel, sem motor de fluxos).** O span é um papelzinho que pula checkout → SDK → Collector → backend, cada app com seu ícone. A tela ao lado soma, em verbos, o que cada um fez: *cria* o span, *carimba* service.name, *escreve* N campos → X B, *soletra* o nome (`2a · 09 · "GET /cart"`), *envia*, *lê e junta* com o span do payments, *guarda*. A profundidade está no papel: no SDK a câmera desce para dentro dele (cada campo com o seu peso) e de um campo (etiqueta, tamanho, texto). **Interativo:** Protobuf/JSON e "mais um atributo" refazem o filme, e o leitor vê o papel engordar. Clicar numa linha da tela volta àquele passo. **3D:** os apps de pé, com o selo do ícone em cima.
- **Simulação (livre).** Um analisador no estilo Wireshark: hexa à esquerda e árvore de campos à direita, com o campo aceso nos dois. O leitor muda o nome, o status (127/128 mostra o varint crescer), o pai e os atributos.
- **Ícones.** `service` (checkout, payments), `sdk`, `collector`, `backend`.
- **Correlações.** ← hard-context (traceparent hex ↔ 16 bytes), ← anatomy (o id que monta a árvore), → collector-pipeline (o receiver `otlp` decodifica isto), → agent-or-gateway (gRPC e conexões), → cardinality-and-the-bill (o custo em bytes de cada atributo).
- **Próximo passo.** Mostrar o quadro gRPC (5 bytes de prefixo) e os headers HTTP/2 em volta. Anexo `grpc-http2`.

#### the-shape-of-a-metric — *The shape of a metric* · disponível (filme + livre + 3D)
- **Pergunta.** O que é uma métrica no OTLP: um número, ou um ponto com temporalidade e início?
- **Mal-entendido.** "Counter é um número que sobe" / "a série cumulativa só sobe" / "delta não perde nada".
- **Modelo.** `otel-domain/metrica/modelo.ts`: um redutor puro (`registrar`, `coletar`, `reiniciar`) com Sum + Histogram de baldes explícitos (limite de cima inclusivo), e `lerNoBackend` com e sem respeito ao `inicio`. Sem atributos, de propósito: atributo é o assunto da cardinalidade.
- **Showcase.** Feito (`metrica/filme.ts`, derivado de `rodar(roteiro)`): as medições entram no agregador e ficam no processo; o PeriodicReader puxa e um ponto sai; intervalo a intervalo a série cresce (cumulative) ou recomeça (delta); com o reinício, `inicio` muda, 2 medições morrem na memória e o backend ingênuo lê −9. **3D:** o histograma como balde × intervalo, e a altura é a contagem. **Interativo:** cumulative/delta e "o processo reinicia" refazem o filme.
- **Simulação (livre).** `MetricaLab`: o leitor registra requisições rápidas/lentas, coleta quando quer, derruba o processo e liga "backend honours start time"; a tabela é `PontoExportado` e a leitura é `lerNoBackend`.
- **Ícones.** `metric`, `service`, `exporter`, `backend`.
- **Correlações.** ← three-pillars, → cardinality-and-the-bill, → reading-an-otlp-payload (o envelope de métricas tem a mesma forma de resource/scope).

#### a-log-that-knows-its-trace — *A log that knows its trace* · disponível (filme + livre)
- **Pergunta.** Como um log ganha `trace_id` e `span_id` sem o desenvolvedor escrever isso?
- **Mal-entendido.** "Basta logar o trace_id na mensagem" / "todo log da requisição tem o trace" / "o log pendura no span raiz".
- **Modelo.** `otel-domain/log/modelo.ts`: um redutor com pilha de contexto **por thread** (`abrirSpan`, `fecharSpan`, `logar`, `criarThread` com ou sem levar o contexto) e `juntar`, que liga log a span só pelo campo. Sem ponte, o id vai para o texto.
- **Showcase.** Feito (`log/filme.ts`, derivado de `rodarLog`): o span fica ativo na thread e o log sai com os campos; o span filho ganha; o worker nasce vazio (ou com o contexto, se alguém levou); depois do fim do span não há contexto; e o backend liga por campo, com o motivo escrito em quem não liga. **Interativo:** ponte e propagação para o worker refazem o filme. **3D:** a vista Iso existe pelo player, mas a altura não carrega sentido aqui; o lab não depende dela.
- **Simulação (livre).** `LogLab`: o leitor é o handler — escolhe a thread, abre e fecha spans, loga, cria o worker — e a tabela é `juntar`.
- **Ícones.** `log`, `context`, `trace`, `sdk` (a ponte), `backend`.
- **Correlações.** ← hard-context-and-baggage (o contexto entre processos; aqui, entre threads), ← reading-an-otlp-payload (LogRecord.trace_id é o mesmo campo de 16 bytes), ← three-pillars.

### Fase 3 — a arquitetura

#### providers — *The three providers* · disponível (fluxo)
- **Pergunta.** Quem decide o que sai do processo: o Tracer, o Meter, o Logger, ou os providers?
- **Showcase (a fazer).** TracerProvider → SpanProcessor → Exporter, com sampler e batch. **3D:** o processo como uma caixa com três andares, um por provider.
- **Ícones.** `sdk`, `sampler`, `batch`, `exporter`.
- **Correlações.** → collector-pipeline (o que o SDK faz e o Collector refaz), → head-vs-tail-sampling.

#### collector-pipeline — *The Collector pipeline* · disponível (fluxo + filme + 3D)
- **Pergunta.** Por que o filtro adicionado não mudou o exporter que você olhava?
- **Showcase.** Já existe (serviços → pipeline → batch → envelope → export). Ícones aplicados.
- **Lacuna.** Fork de pipelines (um receiver, duas cópias) no filme. Ligação com o protobuf no capítulo do envelope.
- **Correlações.** ← reading-an-otlp-payload, → agent-or-gateway, → backpressure-and-drops.

#### agent-or-gateway — *Agent or gateway* · disponível (filme + 3D + estado)
- **Pergunta.** Onde o Collector mora, e o que cada escolha custa?
- **Showcase.** Já existe, recalculado a cada implantação. Ícones `pod`, `agent`, `collector` e `backend` aplicados.
- **3D.** A camada de implantação vira altura: Pod, agent no nó, gateway, backend.
- **Correlações.** ← collector-pipeline, ← reading-an-otlp-payload (gRPC fixa a conexão), → head-vs-tail-sampling (o trace inteiro num só lugar).

### Fase 4 — instrumentação

#### manual-spans — *Manual spans* · a construir (livre + filme)
- **Pergunta.** Quando criar um span à mão, e o que ele precisa ter?
- **Mídia.** Um editor de código fictício com três botões (`startSpan`, `setAttribute`, `end`) e o trace montando ao lado. O filme mostra o span esquecido aberto (sem `end`).
- **Ícones.** `service`, `trace`. **Correlações.** → semantic-conventions (anexo), → cardinality-and-the-bill.

#### zero-code-instrumentation — *Zero-code instrumentation* · a construir (filme + 3D)
- **Pergunta.** O que o agente automático instrumenta, e o que ele não consegue ver?
- **3D.** A pilha da aplicação em andares (framework HTTP, cliente de banco, código de negócio). O auto cobre as bordas, e o miolo fica escuro.
- **Correlações.** ← manual-spans, ← providers.

#### propagating-through-a-queue — *Propagating through a queue* · a construir (filme + estado + 3D)
- **Pergunta.** Por que o trace morre no `send` e reaparece órfão no `consume`?
- **Modelo.** Mensagem com headers, produtor e consumidor, link de span contra pai.
- **Showcase.** O produtor injeta `traceparent` no header da mensagem, a fila guarda, e o consumidor extrai e cria um span com *link* (lote) ou com *pai* (uma mensagem). **3D:** a fila como um silo, com a altura sendo o tempo de espera.
- **Ícones.** `queue`, `service`, `context`. **Correlações.** ← hard-context-and-baggage.

#### host-and-kubernetes-signals — *Host and Kubernetes signals* · a construir (filme + 3D)
- **Pergunta.** De onde vêm `k8s.pod.name` e as métricas do nó, e quem as anexa?
- **Showcase.** `kubeletstats`, `hostmetrics` e `k8sattributes` pelo IP de origem. Liga com o handbook de Kubernetes **por link**, sem importar o domínio dele (handbooks são independentes).
- **Ícones.** `host`, `pod`, `agent`. **Correlações.** ← agent-or-gateway (o IP de origem).

### Fase 5 — operar em escala

#### head-vs-tail-sampling — *Head vs tail sampling* · disponível (fluxo)
- **Showcase (a fazer).** O head decide no primeiro span, sem saber do erro. O tail espera o trace inteiro e precisa dele num só Collector. **3D:** a janela de decisão do tail como volume (tempo × spans retidos).
- **Ícones.** `sampler`, `collector`. **Correlações.** ← agent-or-gateway (roteamento por trace ID), ← providers.

#### backpressure-and-drops — *Backpressure and drops* · a construir (filme + estado + 3D)
- **Pergunta.** Quando o backend cai, onde os spans esperam e onde eles morrem?
- **Modelo.** `memory_limiter`, `sending_queue` e retry com backoff. Contadores de descarte.
- **3D.** A fila do exporter como uma coluna que enche. A altura é a ocupação, e o vermelho é o limite.
- **Ícones.** `queue`, `limiter`, `exporter`, `backend`. **Correlações.** ← collector-pipeline.

#### cardinality-and-the-bill — *Cardinality and the bill* · disponível (estado)
- **Showcase (a fazer).** Cada valor novo de atributo vira uma série. **3D:** o cubo de séries (atributo × valor × tempo) crescendo. Correlação em bytes com o protobuf: a chave do atributo viaja inteira em todo ponto.
- **Correlações.** ← reading-an-otlp-payload, ← the-shape-of-a-metric.

#### the-rollout — *The rollout* · a construir (filme)
- **Pergunta.** Em que ordem levar OTel para uma empresa sem parar nada?
- **Mídia.** Filme em etapas (Collector primeiro, depois auto, depois manual e sampling), com custo e risco em cada etapa. É o capítulo que costura o handbook: cada etapa cita o lab que a explica.

## Anexos (referência, não etapa)

`w3c-trace-context`, `otlp`, `protobuf-encoding`, `grpc-http2`, `semantic-conventions`.
O codificador do protobuf já serve o anexo `protobuf-encoding`. O próximo é
`grpc-http2`, que reusa o mesmo mapa de bytes com o prefixo do quadro gRPC.

## Fila (ordem de construção)

1. ~~Ícones que faltam em contexto e o ícone `bytes` no envelope da vitrine.~~ Feito: a ficha do palco (plano e iso) desenha o ícone no cabeçalho.
2. ~~Showcase de `anatomy-of-a-trace` (árvore em escada no 3D).~~ Feito.
3. ~~`the-shape-of-a-metric`~~ Feito.
4. ~~`a-log-that-knows-its-trace`~~ Feito.
5. `propagating-through-a-queue`.
6. Showcases de `three-pillars`, `providers`, `head-vs-tail-sampling` e `cardinality-and-the-bill`.
7. `backpressure-and-drops`, `manual-spans`, `zero-code-instrumentation`, `host-and-kubernetes-signals` e `the-rollout`.
