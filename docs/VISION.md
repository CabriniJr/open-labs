# Visão e escopo

**Status:** rascunho para discussão. Nada aqui é compromisso de entrega.
**Data:** 2026-08-28

Este documento existe para tornar a direção discutível — e para registrar as objeções
junto com a visão, porque uma visão sem objeção anotada é uma visão que ninguém revisou.

---

## 1. O que é

Um **lab de plataforma na web**: você despacha um manifesto que já existe no seu
repositório — um `docker compose` e os arquivos de configuração que ele monta — e a
ferramenta monta um modelo interativo. Blocos abríveis, simulação rodando, decisão de
configuração aparecendo como comportamento.

O material didático não é escrito ao lado do modelo: ele **é uma travessia do modelo**.

Analogia curta: **um Wokwi para plataforma**. Em vez de placa e firmware, manifesto e
configuração.

## 2. Para quem

| Público | O que ganha |
|---|---|
| Estudante de ops e infraestrutura | Ver o mecanismo antes de ter cluster, sem precisar de ambiente |
| Time de plataforma | Discutir uma decisão de configuração olhando a consequência; onboarding com trilha executável |
| Autor de documentação | Material derivado do modelo, que não desatualiza em relação a ele |

Esse público define duas coisas: a entrada é `compose` porque é a linguagem que ele já
escreve, e o catálogo prioritário é o que ele opera.

## 3. O que não é

- Não é simulador de capacidade nem previsor de desempenho
- Não é editor de grafo livre: o canvas é **gerado do modelo**
- Não é validador de arquitetura. Validar comportamento real é trabalho do ambiente real

A régua é **"a decisão aparece?"**, não "o número está certo?". Fidelidade
**qualitativa**: a fila enche, o backpressure chega, a mensagem cai.

## 4. Pacote de modelo

**Definição (2026-08-28): um pacote de modelo é uma configuração dos objetos da engine
que replica uma aplicação.** Nomenclatura decidida em 28/08/2026: **`model`** para o
agregado que replica a aplicação e **`modelet`** para cada componente dela. Formato
concreto em `model-format.md`; a discussão que levou a esses nomes está na §9.6.

Isso responde uma pergunta que estava em aberto e é a decisão mais importante desta
seção: **o pacote é dado, não código.** Ele compõe e configura os arquétipos que já
existem; não traz comportamento novo.

Um pacote declara quatro coisas:

| Parte | Conteúdo |
|---|---|
| **Reconhecimento** | Que imagens ele resolve (`confluentinc/cp-kafka`, `otel/opentelemetry-collector*`) |
| **Estrutura** | A composição de objetos: quem contém quem, portas, canais, orçamento de recurso |
| **Leitura de configuração** | Como extrair parâmetros do formato **nativo** da ferramenta — o mesmo YAML do Collector, as mesmas variáveis de ambiente. Nunca um formato inventado |
| **Explicação** | Texto por objeto, com âncora na especificação oficial |

### 4.1 Três consequências de o pacote ser dado

**A ordem de construção fica determinada.** Se um pacote só configura arquétipos
existentes, então o catálogo de `kind` precisa ser suficiente **antes** de o catálogo de
aplicações crescer. Um alvo que não caiba nos arquétipos atuais não é "um pacote
difícil": é a descoberta de que falta um arquétipo — e arquétipo novo entra no núcleo,
revisado, pagando em mais de um domínio.

**A revisão passa a escalar.** Pacote de terceiro é dado validável por schema, não código
a auditar. Sem isso, cada contribuição da comunidade seria uma revisão de comportamento
arbitrário, que é onde a fidelidade vazaria.

**O risco de autoria assistida cai muito.** Gerar composição validada por schema é
qualitativamente diferente de gerar comportamento. Continua exigindo o portão de
fidelidade da §9.3 — porque a composição pode estar plausível e errada — mas o erro passa
a ser localizável e difável, em vez de escondido dentro de uma função.

### 4.2 Configuração nativa destrava a validação

Se o pacote lê o formato real, o mesmo arquivo roda no modelo **e** no componente de
verdade dentro do `labs/<slug>/`. Comparar os dois qualitativamente transforma o
contrato de fidelidade de promessa em teste. É a diferença entre modelo confiável e
modelo bonito, e nenhum simulador didático existente faz isso.

## 5. As três camadas de importação

Um `compose` descreve topologia, não o interior dos componentes.

| Camada | Origem | Produz |
|---|---|---|
| Esqueleto | `services`, `depends_on`, `networks`, `ports` | Blocos da raiz e canais entre eles |
| Recheio | Resolvedor de imagem para pacote de modelo | A subárvore interna de cada bloco |
| Ajuste | `environment` e **arquivos de config montados por `volumes`** | Os parâmetros que fazem a decisão aparecer |

A terceira camada é a que entrega a promessa: é no arquivo montado que vivem as
decisões que interessam. Ler só o `compose` daria um diagrama de serviços, e disso já
existe meia dúzia de ferramentas.

Serviço sem pacote correspondente vira **bloco explicitamente opaco**, marcado como não
modelado. Nunca caixa vazia que sugere conhecimento que não existe.

## 6. Escopo da v0

**Um alvo só: OpenTelemetry.** É o assunto de estudo em curso, e é onde os fenômenos
mais didáticos aparecem — amostragem, lote, fila, backpressure na exportação.

A v0 fecha quando:

- [ ] A árvore do TracerProvider está fiel e completa, com âncora na spec por objeto
- [ ] Backpressure emerge do modelo, sem roteiro (ver §9.1)
- [ ] Memória e capacidade são finitas, e um tradeoff aparece na tela sem ser narrado
- [ ] Um `compose` com Collector é importado nas três camadas da §5
- [ ] O mesmo arquivo de configuração roda no modelo e no lab real, e os dois concordam
- [ ] A página do handbook é gerada da travessia da árvore

Não faz parte da v0: catálogo, contrato de plugin, extração do motor para repo próprio.

## 7. Catálogo direcional

**Direção, não compromisso.** O critério de avanço é o anterior ter fechado.

Listar catálogo é barato; terminar um alvo é caro. Este catálogo serve para testar se a
abstração aguenta, não para prometer entregas.

### 7.1 Componentes de pipeline

Fluxo de dados por portas. É o que os arquétipos atuais descrevem bem.

| Alvo | Fenômeno que ensina | Nota |
|---|---|---|
| OpenTelemetry | Amostragem, lote, fila, exportação | **v0** |
| Kafka | Partição, grupo de consumo, rebalance, lag | Segundo alvo — o mais exigente, e é isso que o qualifica |
| Prometheus | Coleta por pull, séries, retenção, remote write | Contraste útil com o push do OTel |
| Mosquitto / MQTT | QoS, sessão persistente, tópico curinga | Broker pequeno, ótimo para provar reuso |
| PostgreSQL | WAL, réplica, atraso de replicação | Ver §8: talvez não seja modelo |

### 7.2 Recursos em vez de plataforma

**Decisão de 2026-08-28: Docker, Linux e Kubernetes saem do escopo.** No lugar deles, a
plataforma entra como **orçamento finito de recurso** que os blocos disputam.

Essa troca é a melhor redução de escopo tomada até aqui, e o motivo é estrutural: ela
elimina duas das três famílias semânticas do catálogo. Sai "estado e isolamento"
(Docker, Linux) e sai "controle com realimentação" (o laço de reconciliação do
Kubernetes, que não é ordem topológica de tick e exigiria regime de execução próprio).
Sobra **uma** família — fluxo de dados sobre recurso compartilhado. A hipótese central do
projeto deixa de ser frágil e passa a ser testável.

E o ganho é duplo: **os fenômenos de plataforma que mais interessam continuam
modeláveis**, sem modelar plataforma nenhuma. Memória estourando e o processo morrendo com
a fila dentro é o que se aprende sobre limite de contêiner; capacidade saturando e a
latência subindo é o que se aprende sobre throttling. Os dois emergem do recurso finito.

#### Por que recurso é necessário, e não enfeite

Hoje o modelo não tem custo. Aumentar `maxQueueSize` só melhora: menos descarte, nenhuma
consequência. O leitor conclui, corretamente para o modelo e erradamente para a
realidade, que basta aumentar. **Sem recurso finito não existe tradeoff — existe só
"mais é melhor".**

Com memória finita, a fila grande custa memória; com capacidade finita, o lote grande
custa latência. É aí que a §5.4 da spec do motor — medidor pareado, o que se ganha ao
lado do que se perde — deixa de ser regra especial do amostrador e passa a valer para
tudo.

#### Proposta: dois recursos, não quatro

A conversa levantou CPU, memória, I/O e throughput. **Throughput não é recurso, é
medida** — e a spec do motor já o define como medidor de vazão por estágio. Declará-lo
como entrada criaria duas verdades para a mesma grandeza, que é exatamente a divergência
silenciosa que o projeto combate. CPU e I/O, para efeito didático, produzem o mesmo
fenômeno observável: trabalho que não cabe no tick.

| Recurso | O que é | O que ensina |
|---|---|---|
| **Memória** | Quanto o bloco pode reter | Fila, tamanho de lote, retenção. Estourar mata o bloco e perde o que estava dentro |
| **Capacidade de serviço** | Quanto trabalho o bloco processa por tick | Saturação, enfileiramento, latência crescente. Cobre CPU e I/O sem separá-los |

**Latência não entra como parâmetro.** Ela é consequência de fila mais capacidade finita
e tem de emergir, não ser configurada. É a grandeza que o público de plataforma mais usa
para decidir, então deixá-la ser autorada seria o pior lugar para trapacear.

#### Como isso entra no motor sem quebrar as regras

Recurso é, por natureza, **estado compartilhado** — e isso ameaça duas regras da spec: só
folha tem comportamento, e medidor só lê tráfego de porta. Se um pool global decide
alocação, quem age não é folha nenhuma.

Proposta que preserva as duas: **recurso como porta.** Um `kind` novo — árbitro de
recurso, que é folha — recebe pedidos e devolve concessões. O bloco que precisa de
memória ou de capacidade emite um pedido na porta de recurso e só progride quando a
concessão chega. Consequências:

- Quem age continua sendo folha
- A contabilidade de recurso continua sendo tráfego de porta, então o medidor segue honesto
- **Contenção de recurso vira backpressure de graça** — e backpressure é justamente o
  mecanismo que falta hoje (§9.1). As duas lacunas se fecham com a mesma peça

Vale desenhar as duas juntas. Resolvê-las em momentos separados provavelmente produziria
dois mecanismos concorrentes para a mesma coisa.

#### O valor de recurso vem do manifesto, não de invenção nossa

O `compose` já declara limite de recurso — `deploy.resources.limits` com `cpus` e
`memory`, e as formas mais antigas `mem_limit` e `cpus`. O orçamento de cada bloco sai
daí, o que mantém a premissa da §4: **configuração nativa, nunca formato inventado**.
Mexer no limite do manifesto e ver o comportamento mudar é a demonstração exata que o
público pediu.

#### A trava obrigatória

Assim que existem memória e capacidade no modelo, a pergunta "aguenta quantos por
segundo?" aparece sozinha — e responder isso é virar o simulador de capacidade que o §3
declara não ser.

Portanto: **unidades relativas e declaradas**, não `MB` e `vCPU`. Saturação de zero a
cem, orçamento em unidades de trabalho, escala declarada como já se faz com o tick. Se
algum dia um número com unidade real aparecer na tela, ele vem com procedência e com o
aviso de que é ordem de grandeza didática. A ferramenta deve recusar-se, de forma
explícita, a servir de dimensionamento.


### 7.3 O catálogo de `kind` cobre esses alvos? Ainda não

Se o pacote é dado (§4), então **o catálogo de arquétipos é o gargalo do projeto**: nenhum
alvo pode ser expressado além do que os `kind` já sabem fazer. Vale testar isso em papel
antes de construir, porque é barato e o resultado muda a ordem de trabalho.

Os oito arquétipos atuais — `composite`, `source`, `router`, `pipeline`, `buffer`, `sink`,
`channel`, `static` — cobrem o TracerProvider por inteiro. **E é justamente aí que está o
viés:** eles foram derivados dele. Um catálogo desenhado a partir do único caso existente
sempre parece completo. O teste honesto é confrontá-lo com os alvos que ainda não foram
construídos.

| Fenômeno | Onde aparece | Coberto por | Lacuna |
|---|---|---|---|
| Emitir no ritmo de um parâmetro | Tracer, produtor, cliente | `source` | — |
| Decidir a saída por política | Sampler, particionador, match de tópico | `router` | — |
| Encadear estágios em ordem | Lista de processors | `pipeline` | — |
| Acumular e drenar por gatilho | Fila do BatchSpanProcessor | `buffer` | — |
| Consumir e transformar | Exportador, consumidor | `sink` | — |
| Transportar e transformar a carga | Canal OTLP, conexão | `channel` | — |
| Dado anexado, consultado e não atravessado | Resource, SpanLimits | `static` | — |
| **Enviar a mesma mensagem para N destinos** | Dois exportadores no mesmo processor, assinantes MQTT, réplicas Kafka | `router` só escolhe **uma** porta | **`tee`** — fan-out |
| **Entrega com confirmação e reenvio** | QoS 1 e 2 do MQTT, `acks` do Kafka, retry de exportação | nada | **entrega confiável** |
| **Registro append-only com cursor por leitor** | Partição Kafka, WAL do Postgres | `buffer` esvazia ao drenar; log **retém** e cada leitor tem posição própria | **`log`** |
| **Retenção com consulta e expiração** | TSDB do Prometheus, sessão persistente e mensagem retida do MQTT | `buffer` não é consultável nem expira por idade | **`store`** |
| **Requisição e resposta correlacionadas** | Scrape do Prometheus, consulta, verificação de saúde | tudo hoje é push: a folha emite | **interação pull** |
| **Conceder, atribuir, coordenar** | Orçamento de recurso (§7.2), grupo de consumo e rebalance, pool de conexão | nada | **árbitro** |

Seis lacunas candidatas. Cada uma passa o teste de custo — paga em dois alvos ou mais — e
duas delas **provavelmente aparecem já na v0**:

- **`tee`** é necessário assim que um cenário tiver dois exportadores, que é configuração
  banal de Collector
- **entrega confiável** é o outro lado do backpressure: se a emissão pode falhar (§9.1),
  alguém tem de decidir entre reenviar, acumular ou derrubar

E duas se encaixam em decisões já em aberto:

- **árbitro** é a mesma forma que o orçamento de recurso pede (§7.2). Conceder memória e
  atribuir partição a um consumidor são o mesmo arquétipo com política diferente
- **interação pull** é o contraste didático mais forte entre OTel e Prometheus — push
  contra pull. Não tê-la significa não conseguir ensinar a diferença que mais confunde
  quem opera as duas ferramentas

Consequência para a ordem de trabalho: **fechar o OTel não prova que o catálogo está
pronto**, porque o OTel é o caso de onde ele saiu. A prova vem de expressar um alvo com
fenômeno estranho ao primeiro — e o `log` com cursor do Kafka é o mais estranho de todos,
o que faz dele o segundo alvo certo.



### 7.4 O invariante que torna o modelo legível

Regra enunciada em 2026-08-28, e é a mais importante do desenho visual:

> **Cano transporta. Se a informação mudou, ela passou por um bloco de processamento.**

O valor dela é que responde sozinha a pergunta que o leitor faz o tempo todo — *onde
isso mudou?* — sem precisar de legenda. Se transformação puder acontecer em qualquer
lugar, inclusive no fio, o leitor perde o único ponto de referência confiável que tem.

É a mesma gramática que faz Factorio ser legível: a cinta nunca altera o item, a máquina
sempre altera. Ninguém precisa de tutorial para entender isso, e é por isso que funciona.

#### Isto contradiz a spec do motor, e a spec é que deveria mudar

A spec do motor composicional afirma o contrário em dois lugares:

- Na tabela de arquétipos: `channel` — *"transporta; **pode transformar a carga**"*
- No runtime: o tick *"move as mensagens pelos canais, **aplicando a transformação de kind
  nas fronteiras**"*
- E a §2.3 usa exatamente isso no exemplo central: o documento OTLP *"entra no canal e
  vira `frame[]` gRPC"*

Com a regra nova, esse exemplo fica ilegível: o leitor vê a carga mudar de forma no meio
de um cano e não tem a quem atribuir a mudança.

#### A saída não custa nada, e é mais fiel

O canal já é **abrível** por decisão da spec. Então o transformador vive **dentro** dele:
entrar no canal gRPC revela a camada que serializa e enquadra, e é ela — um bloco — que
muda a carga.

Isso é mais fiel ao que acontece de verdade: enquadrar em HTTP/2 é trabalho de uma camada
de protocolo, não propriedade do fio. E não se perde nada na vista de cima, porque a regra
de projeção de fronteira garante que, com o canal fechado, o leitor continue vendo
documento entrando e quadros saindo — só que agora isso é **consequência** do interior, em
vez de uma exceção embutida no motor.

Efeito colateral bem-vindo: elimina um caso especial do runtime. Transformação passa a
acontecer num lugar só — em bloco, como todo comportamento — em vez de dois.

#### O que Factorio dá e o que não dá

| Dá | Não dá |
|---|---|
| A gramática visual: cinta transporta, máquina transforma | Hierarquia. Factorio é plano; a profundidade dele é espacial, não aninhada |
| Gargalo visível sem número: a cinta enche, a máquina fica ociosa | Fidelidade a um sistema real — é um jogo, as regras são inventadas |
| **Backpressure como mecanismo central**, aprendido no corpo por milhões de jogadores | Explicação: você entende o que acontece, não por quê |

O segundo ponto é o mais valioso e o mais difícil de conseguir de outro jeito: em Factorio
o jogador desenvolve intuição de vazão e contrapressão **sem ler nada**. É exatamente o
resultado que este projeto quer, e a prova de que dá para consegui-lo por desenho.

Factorio é proprietário — referência conceitual, nunca código nem asset. O análogo aberto
mais próximo é o **shapez.io**, jogo de base building inspirado nele, com código público
(licença a confirmar no repositório oficial antes de qualquer uso).



## 8. Modelar ou embarcar: a pergunta que precede o catálogo

Para parte dos alvos, o componente **real** roda no navegador. Nesses casos, modelar
significa construir uma versão pior e menos fiel de algo que já existe pronto.

| Alvo | Existe real no navegador? | Consequência |
|---|---|---|
| PostgreSQL | **PGlite** — Postgres compilado para WASM, Apache-2.0, ~3 MB | Embarcar o real para consulta e plano de execução. Réplica e WAL continuam modelo: o PGlite roda em modo de conexão única |
| MQTT | Brokers MQTT em JavaScript rodam de fato | Embarcar o real; modelar só o que o broker não deixa observar |
| Kafka | Não. É JVM | Modelar |
| OTel Collector | A investigar — é Go, e Go compila para WASM | Se for viável, é fidelidade máxima. Não assumir antes de testar |

Linux e Kubernetes saíram desta tabela junto com a camada de plataforma (§7.2). Fica
registrado que existiria caminho — o **v86** emula x86 em WASM e roda Linux de verdade —
para quando e se a decisão de escopo for revista.

**Critério:** se o real roda no navegador e o mecanismo interno é observável, embarque;
se não roda, ou se o interesse didático está justamente no que ele esconde, modele.

Consequência de arquitetura: um pacote de modelo pode ser **um invólucro sobre um
componente real embarcado**, e não só uma árvore simulada. Isso é uma decisão de design
que ainda não existe na spec do motor, e é melhor decidi-la antes de o catálogo crescer.

## 9. Objeções e hipóteses frágeis

### 9.1 Backpressure não emerge do motor atual

`Behavior` devolve `{ state, out: Emission[] }` — a folha emite e pronto. `Wire` não tem
capacidade nem política de recusa. Isso modela **overflow**, não backpressure.

Faltam: capacidade e política no canal, emissão que pode falhar, e regime "bloqueada"
propagando para trás. A perturbação mais forte da spec — janela do receptor fechando,
exportação parando, fila enchendo, dado caindo — **é** backpressure em três níveis, e
hoje teria de ser roteirizada. Roteiro é a única coisa que este projeto não pode aceitar.

### 9.2 Um conjunto de arquétipos para todos os domínios: hipótese ainda em aberto, mas bem menos frágil

Na primeira versão deste documento esta era a objeção mais séria: o catálogo tinha três
famílias semânticas — fluxo de dados, estado e isolamento, controle com realimentação — e
a tese do projeto assumia que um conjunto de arquétipos serviria às três.

**A decisão da §7.2 removeu duas dessas famílias.** Com Docker, Linux e Kubernetes fora, e
plataforma reduzida a orçamento de recurso, sobra fluxo de dados sobre recurso
compartilhado. A hipótese passa de "improvável e caríssima de testar" para "plausível e
testável com o segundo alvo".

O que **continua** em aberto: nenhum alvo além do OTel foi construído, então o reuso segue
não demonstrado. Reuso não se prova com dois níveis vazios; prova-se quando o segundo
pacote custa uma fração do primeiro. Kafka é o teste, e é bom teste justamente por ser
exigente — partição, grupo de consumo, rebalance e lag não são um Collector com outro
rótulo.

O que **não** vale fazer: escolher como segundo alvo algo muito parecido com o primeiro.
Isso confirmaria a hipótese por construção, o que não é confirmação nenhuma.

### 9.3 "A IA vai entrar em peso" é o maior risco, não o acelerador

O único ativo do projeto é a fidelidade. Um modelo errado com desenho bonito é pior que
não ter ferramenta, porque o leitor sai confiante e errado.

Geração assistida produz texto plausível, e plausível é exatamente o que passa em
revisão superficial. Usar IA em peso **sem** o portão de verificação industrializa a
mentira em escala.

O guia de autoria já tem a regra certa: toda afirmação técnica rastreia para um link, e
o que não rastreia é cortado, não amaciado. O que falta é isso ser **CI e não
disciplina**:

- Todo parâmetro resolve para um ajuste real documentado, com link que o CI verifica
- Todo comportamento novo entra com teste que o compara ao componente real do lab
- Pacote de terceiro passa pelo mesmo portão, senão o projeto vira coleção de modelos de
  qualidade desconhecida

Papel correto da IA: **gerar o candidato**. Quem aceita é o teste contra o real.

### 9.4 Dispersão continua sendo o risco número um, e não é técnico

Estado de hoje: fase inicial, sem licença declarada, entrega 2 na primeira de seis
sessões, motor sem backpressure nem recurso.

O corte da §7.2 ajudou de verdade — saíram três alvos e, com eles, duas famílias
semânticas e a necessidade de um segundo regime de execução. Mas cinco alvos de pipeline
ainda são muito para o estado atual, e a v0 depende de mudanças no núcleo que ainda não
começaram.

Mitigação adotada: catálogo é direção e não compromisso, avanço exige o anterior fechado,
e nenhum `kind` novo entra sem pagar em dois alvos distintos. O sinal de alarme a
observar é começar o segundo alvo antes de o primeiro fechar os seis itens da §6.

### 9.5 Material didático de plataforma apodrece

Defaults mudam de versão. Um lab que ensina `maxQueueSize` 2048 fica errado em silêncio
quando o upstream muda. Como cada parâmetro já vai declarar procedência e link, vale um
teste que confronte o valor declarado com o upstream e falhe quando divergir.

### 9.6 Nomenclatura — resolvida em 28/08/2026

**Decidido:** `model` para o agregado, `modelet` para o componente.

A objeção original valia contra a grafia anterior, `.modler` e `.modlet`: não eram palavra
em inglês nem em português, e seriam lidas como erro de digitação de *modeler* — o que para
um sufixo público custa caro e para sempre, com gente digitando errado e busca dividida.
`model` e `modelet` resolvem: o primeiro é palavra, o segundo se lê como diminutivo.

**O que sobrou da objeção, e é de empacotamento:** `.model` puro é extensão genérica demais
para não colidir na máquina de alguém. Proposta em `model-format.md`:
`<slug>.model.yaml`, que mantém a palavra e ganha validação por schema no editor.

**A sobrecarga também sobrou, e foi resolvida por separação, não por nome.** Um pacote
seria ao mesmo tempo distribuição, árvore de objetos, leitor de configuração e conteúdo
didático — quatro ciclos de vida diferentes. `model-format.md` separa em três arquivos:
`.model.yaml` (composição), `.modelet.yaml` (componente reusável) e `.handbook.yaml`
(ordem de visita).

## 10. Referências e o que tomar de cada uma

| Referência | O que tomar | Cuidado |
|---|---|---|
| **Wokwi** | Projeto é dado; compartilhável por URL; biblioteca de peças como ativo | Os elementos são MIT mas **só apresentação**; o motor de simulação é fechado. Aqui a escolha é o inverso |
| **Factorio** | A gramática visual do §7.4 — cinta transporta, máquina transforma — e a prova de que backpressure se aprende sem ler texto | **Proprietário.** Referência conceitual, nunca código nem asset. Análogo aberto: `shapez.io`, código público, licença a confirmar |
| **PhET** | O método: nenhum controle sem medidor que responda a ele na mesma tela | Código sob GPL-3 e simulações relicenciadas para CC BY-NC. Referência de método é livre; **importar código ou asset não é** |
| **Cisco Packet Tracer** | A experiência de montar topologia e ver o pacote andar | **Proprietário.** Referência de sensação, nunca de código. O análogo aberto é o `containerlab`, que monta topologia declarada em YAML com containers de verdade |
| **Logisim Evolution** | Prova de que abrir o bloco e ver o mecanismo ensina | GPL-3, domínio de circuitos |
| **Ptolemy II** | *Director* por nível: regime de execução declarado por composto | Java, desktop, acadêmico |
| **LikeC4** | Vista como projeção do modelo; e a stack que ele já validou | MIT. É diagrama, não simulação |

`containerlab` merece atenção especial: é topologia declarativa em YAML virando lab
executável em containers. É a mesma premissa de entrada deste projeto, já provada, em
outro domínio.

## 11. Decisões

### 11.1 Tomadas em 2026-08-28

- **Plataforma sai do escopo**; entra orçamento de recurso (§7.2)
- **Pacote de modelo é dado, não código** — configuração dos objetos da engine que
  replica uma aplicação (§4)
- **Escopo da v0 é um alvo só**: OpenTelemetry (§6)

### 11.2 Abertas, em ordem de urgência

As três primeiras travam o resto.

1. **Licença.** Repositório público sem `LICENSE` é, por padrão, todos os direitos
   reservados. Proposta: Apache-2.0 no código (concessão de patente) e CC BY-SA no
   conteúdo. Bloqueia divulgação e contribuição externa
2. **Recurso, backpressure e regime de execução por composto, desenhados juntos.**
   Contenção de recurso *é* backpressure (§7.2); resolver em momentos separados
   produziria dois mecanismos concorrentes para a mesma coisa. Mexe no núcleo, e depois
   custa reescrita
3. **Nomenclatura do pacote** (§9.6). Sufixo de arquivo é a coisa mais difícil de mudar
   depois que existe ecossistema
4. **Unidade de recurso.** Proposta: saturação relativa e unidade de trabalho, com escala
   declarada — nunca `MB` e `vCPU`, para a ferramenta não ser usada como dimensionamento
   (§7.2)
5. **Modelar ou embarcar** (§8), por alvo
6. **Branch default:** `entrega-1` envelhece mal. Decidir sobre `main`
7. **Quando o motor sai para repo próprio.** Proposta: depois do segundo alvo

## 12. O que este documento não é

Não é plano de entrega, não é spec e não substitui as specs em
`docs/superpowers/specs/`. Quando uma decisão daqui for tomada, ela vira spec ou ADR, e
esta seção passa a apontar para lá.
