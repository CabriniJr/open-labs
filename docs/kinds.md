# Catálogo de arquétipos

**Status:** proposta para discussão. Nada aqui está implementado.
**Data:** 2026-08-28
**Depende de:** `VISION.md` — em especial §7.2 (recurso), §7.3 (cobertura) e §7.4 (o
invariante cano-transporta-bloco-transforma)

Se o pacote de modelo é dado, o catálogo de arquétipos é o teto do projeto: **nenhuma
aplicação pode ser expressada além do que os `kind` sabem fazer.** Este documento tenta
esgotar o catálogo antes de construir, porque descobrir arquétipo faltando depois de três
pacotes escritos custa reescrever os três.

---

## 1. A gramática, antes dos arquétipos

Emprestada de Factorio, e o motivo é que ela se aprende sem tutorial: **cinta transporta,
máquina transforma, e o fio de circuito carrega sinal, não item.**

Traduzida para este projeto, dá quatro famílias e uma distinção que a spec do motor ainda
não faz.

| Família | O que é | Portas | Fica no caminho do dado? |
|---|---|---|---|
| **Cano** | Transporta. **Nunca** altera a carga | As duas pontas | Sim — é o caminho |
| **Processador de fluxo** | Age sobre o dado que o atravessa | Entrada à esquerda, saída à direita, descarte embaixo | Sim |
| **Controlador** | Observa, concede, dispara, decide. Não recebe a carga | Portas de **controle**, em cima e embaixo | **Não** |
| **Placa** | Dado anexado. Consultado, nunca atravessado | Nenhuma | Não |

A quinta coisa é a **carga**: a mensagem que viaja. O `kind` dela é vocabulário do
domínio, não do motor.

### 1.1 A distinção que falta hoje: processador contra controlador

A spec atual tem uma família de bloco só. Mas um árbitro de recurso, um relógio e um
disjuntor **não estão no caminho do dado** — eles influenciam quem está. Tratá-los como
processador obrigaria a inventar um fluxo que não existe, que é exatamente o erro que a
placa (`static`) foi criada para evitar.

Factorio já resolve isso e vale copiar a solução: **duas espécies de linha**.

| Linha | Carrega | Desenho |
|---|---|---|
| **Canal de dado** | A carga | Traço grosso, com nome em cima e bocas nas pontas |
| **Canal de controle** | Sinal: pedido, concessão, gatilho, medida | Traço fino tracejado, cor distinta |

Com isso, a pergunta "por onde o dado passa?" se responde olhando só as linhas grossas. É
o mesmo ganho de legibilidade do invariante da §7.4 da visão, aplicado à topologia.

### 1.2 O invariante visual, e como ele vira teste

> A forma da carga muda **exclusivamente** na saída de um `transform`.

Isso é a §7.4 tornada verificável. Dá um property test direto, no espírito do teste 2 da
spec do motor:

```
para toda aresta de dado, em todo tick:
  kind(mensagem na origem) == kind(mensagem no destino)
  exceto quando a origem é um transform
```

Se esse teste passa, o modelo **não consegue** mentir sobre onde a transformação acontece.
É a diferença entre uma convenção de desenho e uma garantia.

---

## 2. Os oito de hoje

O que já existe em `packages/depth-core/src/model.ts`, relido sob a gramática acima.

| `kind` | Família | Situação |
|---|---|---|
| `channel` | Cano | **Precisa mudar**: hoje "pode transformar a carga", o que viola §7.4. E não tem capacidade nem política, o que impede backpressure |
| `source` | Processador | Mantém. Ganha regime "limitada" quando o backpressure chega |
| `sink` | Processador | **Precisa encolher**: hoje "consome e opcionalmente transforma". Transformar sai para `transform` |
| `router` | Processador | Mantém |
| `buffer` | Processador | **Precisa dividir**: hoje acumula *e* agrupa. Agrupar sai para `batch` |
| `pipeline` | Composição | Mantém |
| `composite` | Composição | Mantém |
| `static` | Placa | Mantém |

Nota sobre `pipeline` e `composite`: eles não processam nada — organizam. Talvez mereçam
ser uma família própria (**contêiner**) em vez de bloco, já que não têm comportamento por
definição. É decisão de desenho, não de motor.

---

## 3. Onda 1 — necessários para a v0

Critério de entrada: paga em dois alvos ou mais **e** algum cenário banal do OTel já
precisa dele.

### `transform`

Muda a forma da carga. **O único arquétipo autorizado a fazer isso.**

| Contrato | |
|---|---|
| Portas | uma entrada, uma saída |
| Comportamento | recebe carga de um kind, emite carga de outro. Peso pode mudar |
| Regimes | transformando, ociosa |
| Medidores | entrada e saída por forma; razão de tamanho (é o que ensina compressão) |
| Perturbações | falha de serialização |
| Desenho | retângulo com a carga entrando de uma forma e saindo de outra. **A única forma em que a carga muda de aparência atravessando** |
| Paga em | OTel (span para OTLP, e OTLP para quadros), Kafka (serializador e compressão), Prometheus (protobuf e snappy do remote write), MQTT (payload) |

### ~~`tee`~~ — removido em 2026-08-29

**Fan-out virou nativo da porta**, e `tee` seria um segundo mecanismo para o mesmo
fenômeno. A entrada fica aqui riscada em vez de apagada: quem reler o catálogo precisa
achar a discussão, não um buraco.

O que ele propunha — "a mesma carga para N saídas" — é hoje o que `n` fios saindo de uma
porta fazem: `n` cópias, cada uma um item em trânsito próprio, `out:` contando **uma**
emissão e cada destino contando o seu `in:`. A régua da §3 (um arquétipo entra pagando em
dois alvos) o reprova agora: ele não paga em nenhum, porque a junção já existe sem ele. E
num esquemático, desenhar um bloco em cada junção de fio destruiria o desenho.

O que valia na nota original continua valendo, e por isso fica: **`router` não resolve
fan-out.** Router escolhe uma porta; o leque usa todas. Confundir os dois ensinaria que
enviar para dois destinos é uma escolha, quando é uma duplicação — e o custo de recurso é
completamente diferente.

O que se perdeu junto e é dívida declarada: a **política de falha parcial** ("exige todas,
ou basta uma") e o medidor por saída. Hoje o leque entrega a todos, sempre. Quando
backpressure chegar (F1), é ali que essa política tem que aparecer — no regime da aresta,
não num bloco.

### `merge`

Fan-in: N entradas para uma saída, com política de ordem declarada.

| Contrato | |
|---|---|
| Portas | N entradas nomeadas, uma saída |
| Comportamento | política: ordem de chegada, alternada, por prioridade |
| Regimes | fundindo, ociosa, faminta (uma entrada parada) |
| Medidores | volume por entrada; desequilíbrio entre entradas |
| Perturbações | uma entrada muda de ritmo |
| Desenho | confluência; a política aparece como rótulo |
| Paga em | OTel (vários receivers no mesmo pipeline), Kafka (produtores no mesmo tópico), qualquer agregação |

Nota: hoje o motor não define o que acontece quando duas arestas chegam na mesma porta. A
ordem seria implícita — e ordem implícita é exatamente o tipo de coisa que muda de
comportamento em refactor sem ninguém perceber.

### `batch`

Agrupa N cargas em **uma** carga de peso N.

| Contrato | |
|---|---|
| Portas | uma entrada, uma saída, gatilho de controle |
| Comportamento | acumula até o gatilho — tamanho, tempo, ou os dois — e emite uma carga agregada |
| Regimes | enchendo, despachando, esperando gatilho |
| Medidores | tamanho do lote emitido; espera média até o despacho |
| Perturbações | tráfego rarefeito, que é o que ensina por que lote é invisível em serviço de baixo volume |
| Desenho | grade que preenche por célula, e esvazia num pulso |
| Paga em | OTel (BatchSpanProcessor), Kafka (`linger.ms` e `batch.size` do produtor), Prometheus (remote write) |

`buffer` fica sendo só retenção: entra um, sai um, com capacidade e política de estouro. O
BatchSpanProcessor real é `buffer` **mais** `batch`, e mostrar isso separado é ganho
didático — o leitor vê que fila e lote são decisões diferentes.

### `clock`

Controlador. Dispara em intervalo.

| Contrato | |
|---|---|
| Portas | uma saída de **controle** |
| Comportamento | emite gatilho a cada N ticks, com jitter opcional semeado |
| Regimes | rodando, pausado |
| Medidores | disparos; atraso entre disparo e efeito |
| Perturbações | deriva, disparo perdido |
| Desenho | pastilha fora do trilho, com pulso visível, ligada por linha tracejada |
| Paga em | OTel (`scheduledDelay`), Prometheus (intervalo de scrape), qualquer verificação periódica, backoff |

Hoje o disparo por tempo está escondido dentro do `buffer` e do `source`. Explicitá-lo
responde a pergunta "quem disparou isso?", que é impossível de responder hoje.

### `arbiter`

Controlador. Concede o que é finito.

| Contrato | |
|---|---|
| Portas | entrada de **pedido**, saída de **concessão**, ambas de controle |
| Comportamento | política: primeiro a chegar, justo, prioridade. Concede até o orçamento; nega ou enfileira o resto |
| Regimes | folgado, disputado, esgotado |
| Medidores | concedido, negado, espera na fila, saturação |
| Perturbações | orçamento reduzido em tempo de execução |
| Desenho | pastilha com fichas; ficha sai na concessão e volta na devolução |
| Paga em | orçamento de recurso da §7.2 (memória, capacidade), grupo de consumo do Kafka, pool de conexão |

**É a peça que fecha três lacunas com um arquétipo.** Recurso finito, atribuição dinâmica e
— porque negar concessão é frear quem pede — **backpressure**. Conceder memória e atribuir
partição a um consumidor são a mesma forma com política diferente.

---

## 4. Onda 2 — o segundo alvo (Kafka)

### `log`

Registro append-only com cursor independente por leitor.

| Contrato | |
|---|---|
| Portas | uma entrada de escrita, N saídas de leitura (uma por leitor) |
| Comportamento | anexa ao fim; cada leitor tem posição própria; retenção por tempo ou tamanho |
| Regimes | anexando, retendo, expirando, cheio |
| Medidores | **atraso por leitor** (a distância entre o cursor e o fim — é o `lag`), taxa de escrita, retenção usada |
| Perturbações | leitor lento, leitor que volta ao início, retenção estourando antes da leitura |
| Desenho | fita com marcadores de posição, um por leitor |
| Paga em | Kafka (partição), PostgreSQL (WAL) |

`buffer` **não** serve: buffer esvazia ao ser consumido, log retém e é lido. A diferença
não é detalhe — é o que faz o Kafka ser Kafka, e é o fenômeno mais estranho ao
TracerProvider. Por isso o Kafka continua sendo um alvo certo (§7.3 da visão) — embora,
desde 29/08/2026, não mais o segundo: a CPU passou na frente (`roadmap.md` F6).

### `deliver`

Entrega com confirmação e reenvio.

| Contrato | |
|---|---|
| Portas | uma entrada, uma saída, retorno de confirmação |
| Comportamento | política de garantia — no máximo uma vez, ao menos uma vez, exatamente uma vez. Reenvia com backoff até o limite |
| Regimes | entregue, aguardando confirmação, reenviando, desistiu |
| Medidores | tentativas por carga, duplicatas geradas, descartes definitivos |
| Perturbações | confirmação perdida, destino lento |
| Desenho | retângulo com contador de tentativas; a carga volta visivelmente quando reenvia |
| Paga em | MQTT (QoS 1 e 2), Kafka (`acks` e `retries`), OTel (retry na exportação) |

**Alternativa a considerar:** isso pode ser política do `channel` em vez de arquétipo. A
favor de ser arquétipo: duplicata gerada por reenvio é um fenômeno didático de primeira
grandeza — é a razão de idempotência existir — e merece um lugar visível. A favor de ser
política: menos peças. Decidir junto com backpressure, porque os dois mexem em emissão que
pode falhar.

### `supervisor`

Controlador. Mata e recria.

| Contrato | |
|---|---|
| Portas | controle: observa saúde, emite morte e recriação |
| Comportamento | política de reinício; ao matar, o que estava retido no bloco **é perdido** |
| Regimes | vigiando, reiniciando, em loop de falha |
| Medidores | reinícios, dado perdido por reinício |
| Perturbações | falha induzida |
| Desenho | pastilha vigiando o bloco; o bloco apaga e volta vazio |
| Paga em | orçamento de memória estourando (§7.2), `restart:` do próprio compose |

É o arquétipo que faz o estouro de memória ensinar: a fila enche, o bloco morre, **e o que
estava na fila desaparece**. Sem ele, estourar recurso não tem consequência visível — e
consequência invisível não ensina nada.

---

## 5. Onda 3 — Prometheus e o contraste push contra pull

### `store`

Retém com consulta e expiração.

| Contrato | |
|---|---|
| Portas | entrada de escrita, porta de **consulta** (requisição e resposta) |
| Comportamento | guarda por chave; expira por idade ou tamanho; responde consulta |
| Regimes | acumulando, expirando, cheio |
| Medidores | ocupação, idade do mais antigo, acerto e erro de consulta |
| Perturbações | consulta de janela longa, expiração agressiva |
| Desenho | gaveta com etiquetas; consulta acende a gaveta sem retirar o conteúdo |
| Paga em | Prometheus (TSDB), MQTT (sessão persistente e mensagem retida), cache |

Diferença de `buffer` e de `log`: buffer é consumido, log é percorrido, store é
**consultado**. Três verbos, três arquétipos.

### `probe`

Controlador. Requisita e correlaciona a resposta — o modelo pull.

| Contrato | |
|---|---|
| Portas | saída de requisição, entrada de resposta, gatilho de controle |
| Comportamento | dispara ao receber gatilho do `clock`; correlaciona resposta com requisição; tempo limite |
| Regimes | ocioso, aguardando, expirado, alvo inalcançável |
| Medidores | duração da requisição, taxa de sucesso, expirações |
| Perturbações | alvo lento, alvo caído — que é como se ensina o estado *unreachable* |
| Desenho | seta de ida tracejada e volta cheia, com o tempo visível |
| Paga em | Prometheus (scrape), consulta a `store`, verificação de saúde |

**Hoje todo o motor é push:** a folha emite quando quer. Sem `probe`, é impossível ensinar
a diferença entre OTel e Prometheus — que é justamente o que mais confunde quem opera as
duas ferramentas. E a diferença tem consequência prática: no push, o produtor decide o
ritmo e o coletor sofre; no pull, o coletor decide e o alvo precisa estar acessível.

---

## 6. Candidatos não aprovados

Registrados para não serem redescobertos, e **fora** do catálogo até passarem a trava de
custo.

| Candidato | O que faria | Por que não entra agora |
|---|---|---|
| `rate` | Limitador por token bucket: atrasa ou rejeita acima da taxa | Provável sobreposição com `arbiter` — conceder permissão de envio é conceder recurso. Tentar como política do arbiter antes de criar arquétipo |
| `breaker` | Disjuntor: abre o caminho após N falhas | Paga em resiliência genérica, mas nenhum alvo da v0 e da onda 2 precisa. Voltar quando houver alvo que o exija |
| `lock` | Exclusão mútua, seção crítica | Fenômeno de concorrência, e o motor não modela concorrência real. Alto risco de ensinar errado |
| `coordinator` | Eleição de líder, consenso | Tentar como política do `arbiter`. Consenso de verdade é assunto grande e provavelmente fora do escopo de um lab |
| `scale` | Réplicas de um bloco, entrando e saindo | Atraente e ambíguo: é arquétipo ou é multiplicidade de um bloco existente? Decidir junto com o modelo de recurso |

---

## 7. Resumo

| Onda | Arquétipos | Total acumulado |
|---|---|---|
| Hoje | `channel` `source` `sink` `router` `buffer` `pipeline` `composite` `static` | 8 |
| Onda 1 (v0) | `transform` `merge` `batch` `clock` `arbiter` | 13 |
| Onda 2 (Kafka) | `log` `deliver` `supervisor` | 16 |
| Onda 3 (Prometheus) | `store` `probe` | 18 |

Mais três mudanças em arquétipo existente, todas consequência do que está acima:

1. `channel` perde a transformação e ganha capacidade com política de recusa
2. `sink` perde a transformação
3. `buffer` perde o agrupamento

Dezenove arquétipos para cobrir cinco aplicações reais parece pouco, e é o argumento
central do projeto: **uma aplicação é uma configuração desses objetos.** Se o número
crescer proporcionalmente ao catálogo de aplicações, a tese está errada e é melhor
descobrir no segundo alvo do que no quinto.

## 8. O que ainda não está resolvido

- **Contêiner é família própria?** `pipeline` e `composite` não processam nada
- **`deliver` é arquétipo ou política do canal?** (§4)
- **`rate` e `scale` são arquétipos ou variações?** (§6)
- **Regime de execução por composto.** Nada aqui exige laço de realimentação, porque a
  plataforma saiu do escopo. Se voltar, volta com essa necessidade
- **Portas tipadas.** A §14 da spec do motor promete encaixe tipado. Com `transform`
  explícito, o tipo da porta passa a ser verificável de verdade — e o property test da
  §1.2 depende disso

---

## 9. Onda 4 — o que este catálogo ainda não cobre

**Status:** proposta, 2026-08-28. Escrita depois de conferir os arquétipos previstos contra os alvos declarados
e contra a §6 da `DECISIONS.md` ("ver o mesmo dado atravessar os quatro níveis, até o frame e
o byte"). Cada entrada paga em dois alvos, pela mesma trava da §3.

O padrão do que falta: **os previstos cobrem bem 1→1 e N→1, e quase não cobrem identidade que se
divide e se remonta.** o leque replica (as cópias são independentes), `batch` agrupa (o lote é
uma carga nova), `merge` funde (a identidade de origem se perde). Nenhum dos três descreve
uma carga que **vira pedaços e volta a ser ela mesma** — que é literalmente o L2. Sem isso, o
diferencial do projeto não tem arquétipo.

### 9.1 O par que falta: `fragment` e `reassemble`

Não é leque de porta (cópias independentes), não é `batch` (agrupa em carga nova), não é `transform`
(1→1). É **1→N pedaços que continuam sendo a mesma carga**, e depois N→1 de volta.

| `fragment` | |
|---|---|
| Portas | uma entrada, uma saída, descarte |
| Comportamento | corta a carga em pedaços de tamanho máximo declarado; cada pedaço carrega a identidade do original e o seu índice |
| Regimes | passando inteiro (cabe), fragmentando, recusando (não cabe e não pode fragmentar) |
| Medidores | pedaços por carga; **sobrecarga de cabeçalho** — é o que ensina por que fragmentar custa |
| Perturbações | limite de tamanho encolhendo em tempo de execução |
| Desenho | a carga entra inteira e sai em pedaços **da mesma cor**, numerados |
| Paga em | HTTP/2 (`SETTINGS_MAX_FRAME_SIZE`), TCP/IP (MSS e PMTUD), MQTT (payload grande), protobuf (campo que atravessa fronteira de frame) |

| `reassemble` | |
|---|---|
| Portas | uma entrada, uma saída, descarte, **e um gatilho de tempo limite** |
| Comportamento | junta pedaços por identidade até completar; incompleto expira e **é descartado inteiro** |
| Regimes | montando, completo, expirado |
| Medidores | pedaços em espera; cargas perdidas por pedaço faltando |
| Perturbações | um pedaço perdido — que é como se ensina por que perder 1 de 10 custa os 10 |
| Desenho | os pedaços se encaixam e a carga volta à forma original |
| Paga em | os mesmos quatro |

O par é indivisível: `fragment` sem `reassemble` ensina que cortar é grátis.

### 9.2 `mux` e `demux` — muitos fluxos lógicos num caminho físico

`merge` funde e perde a origem. Multiplexar **preserva** a identidade do fluxo para que o
outro lado possa separar de novo. É a diferença entre juntar e entrelaçar, e é o coração do
HTTP/2.

| Contrato | |
|---|---|
| Portas | `mux`: N entradas nomeadas, uma saída. `demux`: uma entrada, N saídas |
| Comportamento | intercala por política (justo, prioridade, peso); cada carga leva o id do fluxo |
| Regimes | entrelaçando, um fluxo dominando, um fluxo faminto |
| Medidores | ocupação do caminho por fluxo; **bloqueio de cabeça de fila** |
| Perturbações | um fluxo grande e lento junto de vários pequenos |
| Desenho | faixas de cor diferente compartilhando um cano; do outro lado, separam |
| Paga em | HTTP/2 (streams numa conexão), MQTT (tópicos numa sessão), Kafka (produtores numa conexão) |

Sem `mux`, "abrir o canal e entender o gRPC" — o exemplo que motivou o projeto — não tem
como ser desenhado com honestidade.

### 9.3 `enrich` — muda o conteúdo sem mudar a forma

O invariante da §1.2 diz que a **forma** da carga só muda saindo de um `transform`. Mas a
maioria dos processadores reais não muda a forma: eles **acrescentam campo**. Tratar isso como
`transform` faria o invariante mentir — o desenho mostraria a carga mudando de aparência onde
ela não muda.

| Contrato | |
|---|---|
| Portas | uma entrada, uma saída, e uma entrada de **consulta** para a placa que fornece os dados |
| Comportamento | acrescenta ou reescreve campos; a forma da carga é a mesma nas duas pontas; **o peso cresce** |
| Regimes | enriquecendo, fonte indisponível (passa sem enriquecer, ou segura) |
| Medidores | crescimento de peso por carga — o custo de anexar contexto |
| Perturbações | fonte de dados lenta ou fora do ar |
| Desenho | a carga sai da mesma forma, **maior**, com o campo novo aceso |
| Paga em | OTel (atributos de recurso, processadores de atributo), Prometheus (relabeling), Kafka (cabeçalhos), qualquer correlação |

### 9.4 `aggregate` — N cargas viram **uma medida**, não um lote

`batch` agrupa N em uma carga de peso N: os itens continuam lá dentro. Agregar **descarta os
itens** e guarda uma medida. A diferença é a coisa mais confusa de métrica, e o catálogo atual
não tem como desenhá-la.

| Contrato | |
|---|---|
| Portas | uma entrada, uma saída, gatilho de controle |
| Comportamento | dobra as cargas numa medida (soma, contagem, histograma); política de temporalidade: **cumulativa** (nunca zera) ou **delta** (zera a cada emissão) |
| Regimes | acumulando, emitindo, ocioso |
| Medidores | cardinalidade — quantas séries distintas estão vivas; razão de compressão (entrada contra saída) |
| Perturbações | **explosão de cardinalidade**, que é o modo de falha nº 1 de métrica na vida real |
| Desenho | as cargas entram e **desaparecem** dentro de um mostrador que sobe. Nada sai até o gatilho |
| Paga em | Meter Provider (a Entrega 4 inteira), Prometheus (TSDB e `rate`), Kafka Streams, qualquer painel |

Delta contra cumulativa desenhadas lado a lado é, sozinho, um lab que vale o projeto.

### 9.5 `correlate` — casa duas cargas por chave

`merge` junta sem casar. Correlacionar **espera o par** e expira se ele não vier. É o que
falta para amostragem por cauda, e a §5 já precisou disso à mão dentro do `probe`.

| Contrato | |
|---|---|
| Portas | duas entradas nomeadas, uma saída de casados, uma de órfãos, gatilho de tempo limite |
| Comportamento | guarda por chave até o par chegar; sem par até o limite, sai por órfãos |
| Regimes | casando, esperando, expirando |
| Medidores | taxa de casamento; espera até casar; órfãos por lado |
| Perturbações | um lado atrasado, um lado que não vem |
| Desenho | duas correntes que se encontram; o que casa segue junto, o que não casa cai |
| Paga em | OTel (amostragem por cauda: segurar todos os pedaços de um mesmo rastro antes de decidir), `probe` (requisição e resposta), MQTT (QoS 2), Kafka (junção de fluxos) |

Repare que isto **reescreve** o `probe` da §5: ele deixa de correlacionar à mão e vira
`clock` + emissor + `correlate`. Um arquétipo que simplifica outro é o melhor sinal de que
faltava mesmo.

### 9.6 `partition` — a mesma chave sempre na mesma saída

`router` escolhe porta por política, e nada o obriga a ser estável. Particionar promete
**estabilidade por chave**, e é dela que vem a garantia de ordem. Sem isso não dá para
ensinar por que Kafka ordena dentro da partição e não entre partições.

| Contrato | |
|---|---|
| Portas | uma entrada, N saídas |
| Comportamento | função da chave para a saída; **a mesma chave cai sempre na mesma** |
| Regimes | equilibrado, torto (uma chave quente), **remapeando** |
| Medidores | distribuição por saída; desequilíbrio; chaves remapeadas num rebalanceamento |
| Perturbações | mudar o número de saídas — que é o que ensina hash consistente, porque o desequilíbrio da remapeação aparece |
| Desenho | leque com rótulo de chave; a mesma cor cai sempre no mesmo ramo |
| Paga em | Kafka (partição, e a ordem que ela garante), OTel (exportador com balanceamento por rastro), qualquer armazenamento fatiado |

### 9.7 Resumo revisado

| Onda | Arquétipos | Acumulado |
|---|---|---|
| Hoje | os 8 | 8 |
| Onda 1 (v0) | `transform` `merge` `batch` `clock` `arbiter` | 13 |
| Onda 2 (Kafka) | `log` `deliver` `supervisor` | 16 |
| Onda 3 (Prometheus) | `store` `probe` | 18 |
| **Onda 4 (L2/L3 e métrica)** | `fragment` `reassemble` `mux` `demux` `enrich` `aggregate` `correlate` `partition` | **26** |

### 9.8 O que muda nas ondas anteriores

1. **`probe` encolhe**: passa a ser composição de `clock` + emissor + `correlate` (§9.5).
2. **`enrich` sai de dentro de `transform`**, e o invariante da §1.2 fica verdadeiro em vez de
   quase verdadeiro: forma muda só no `transform`, **conteúdo** muda também no `enrich`.
3. **A onda 1 ganha prioridade nova.** `aggregate` paga na Entrega 4 inteira (Meter Provider),
   que já está no roteiro — provavelmente deveria subir para a onda 1.

### 9.9 Continua fora, e por quê

| Candidato | Por que não |
|---|---|
| `dedupe` | É `store` mais predicado. Tentar como política antes de virar arquétipo |
| `compress` | É `transform` cuja medida interessante é a razão de tamanho, que o `transform` já mede |
| `filter` | É `router` com uma saída ligada ao descarte. Criar um arquétipo para isso ensinaria que filtrar e rotear são coisas diferentes, quando não são |
| `window` | Provável política de `aggregate` e de `batch` (gatilho por tempo, deslizante ou não). Decidir junto com a temporalidade |
