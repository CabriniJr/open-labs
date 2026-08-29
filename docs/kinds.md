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

### `tee`

Fan-out: a mesma carga para N saídas.

| Contrato | |
|---|---|
| Portas | uma entrada, N saídas nomeadas |
| Comportamento | replica a carga em todas as saídas. Política de falha parcial: exige todas, ou basta uma |
| Regimes | replicando, degradada (uma saída recusando), bloqueada |
| Medidores | por saída: entregue, recusado |
| Perturbações | uma saída indisponível |
| Desenho | bifurcação simétrica; a carga aparece idêntica nos dois ramos |
| Paga em | OTel (dois exportadores no mesmo processor — configuração banal), MQTT (assinantes de um tópico), Kafka (réplicas) |

Nota: `router` **não** resolve isso. Router escolhe uma porta; tee usa todas. Confundir os
dois ensinaria que enviar para dois destinos é uma escolha, quando é uma duplicação — e o
custo de recurso é completamente diferente.

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
TracerProvider. Por isso o Kafka é o segundo alvo certo (§7.3 da visão).

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
| Onda 1 (v0) | `transform` `tee` `merge` `batch` `clock` `arbiter` | 14 |
| Onda 2 (Kafka) | `log` `deliver` `supervisor` | 17 |
| Onda 3 (Prometheus) | `store` `probe` | 19 |

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
