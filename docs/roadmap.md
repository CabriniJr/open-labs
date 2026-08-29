# Plano de construção

**Status:** proposta. Substitui nada — as sessões S1 a S6 da spec do motor continuam
válidas no que não conflita.
**Data:** 2026-08-28
**Depende de:** `VISION.md`, `kinds.md` e `depth.md`

Ordenado por **o que destrava o quê**, não por facilidade nem por empolgação. Cada fase
tem critério de saída verificável; fase sem critério é intenção.

**Onde as fases desembocam (2026-08-29).** O que o leitor vê não é uma fase, é um
**handbook**: um `.model` sobre o motor, com **roadmap · artigos · labs**. A F4 entrega
`otel.model`; a F6, `cpu.model`; a F6b, o ATmega dentro do segundo. O catálogo que a
capa promete vive em `apps/site/src/data/handbooks.ts` — quem acrescenta um handbook
acrescenta uma entrada lá, e o teste do catálogo cobra as três trilhas.

---

## F0 — Destravar

Sem código. É a fase mais curta e a que mais importa.

| Item | Por que trava |
|---|---|
| `LICENSE` (Apache-2.0) e `LICENSE-content` (CC BY-SA) | Repositório público sem licença é, por padrão, todos os direitos reservados. Hoje ninguém pode reusar nada, o que contradiz a intenção do projeto |
| Decidir `entrega-1` contra `main` | A branch default envelhece mal e confunde quem chega |
| Nomenclatura do pacote | Sufixo de arquivo é a coisa mais difícil de mudar depois que existe ecossistema (`VISION.md` §9.6) |
| Unidade de recurso | Se sair `MB` e `vCPU`, a ferramenta será usada para dimensionar, que é o que ela não é (§7.2) |

**Saída:** os quatro decididos e registrados em ADR.

---

## F1 — Núcleo: as cinco mudanças que não podem ser feitas depois

Recurso, backpressure, transformação, **controle e fases do tick** mexem no contrato de
comportamento. Fazer depois de existirem arquétipos e pacotes significa reescrever todos.

**São uma fase só de propósito.** Contenção de recurso *é* backpressure; separar produziria
dois mecanismos concorrentes para o mesmo fenômeno.

| Mudança | Onde |
|---|---|
| Emissão que pode falhar | `Behavior` deixa de devolver `out` presumido; passa a saber o que foi aceito |
| Capacidade e política no canal | `Wire` ganha capacidade e política de recusa (bloqueia, descarta novo, descarta velho) |
| Regime propagando para trás | O estado "bloqueada" sobe a cadeia |
| Recurso como porta | `arbiter` como folha; pedido e concessão viram tráfego de porta, e o medidor segue honesto |
| `transform` como arquétipo | Sai do `channel` e do `sink`. A carga muda em um lugar só |
| **Semântica da linha de controle** | Sinal entregue muda o que o ator faz **naquele tick**, contado no livro-caixa como tráfego e nunca como carga. Hoje `Wire.line: "control"` é desenho: `resolveTarget` a ignora |
| **Fases do tick** | Um tick passa a ter acomodação (ponto fixo do subgrafo combinacional) e confronto (entrega do que atravessa aresta registrada) |

**Por que as duas últimas entraram aqui, em 29/08/2026.** Elas vieram da CPU (F6), e a
tentação era deixá-las lá. Mas as duas mudam a assinatura de `Behavior` e o significado de um
tick — que é exatamente o critério desta fase. Uma linha de controle que muda comportamento
obriga o ator a receber sinal além de carga; fases do tick mudam o que "um passo" quer dizer
para **todo** arquétipo já escrito. Chegar na F6 com trinta arquétipos e descobrir isso é o
retrabalho que esta fase existe para evitar.

**Saída:**
- A perturbação da janela do receptor fechando derruba dado **por emergência**, sem roteiro
- Estourar memória mata o bloco e perde o que estava retido
- O property test do invariante visual passa: nenhuma aresta tem carga de forma diferente
  nas duas pontas, exceto saindo de `transform`
- `seek` continua exato com eventos de parâmetro e de recurso no histórico

Saída acrescentada pelas duas mudanças novas:
- Um sinal de controle chega, muda a decisão do ator no mesmo tick, e **aparece no
  livro-caixa** — sem nunca ser contado como carga
- Um caminho puramente combinacional resolve dentro de um tick; um que atravessa aresta
  registrada custa um tick. Os dois são visíveis, e a diferença entre eles é visível
- **Laço combinacional é recusado na construção do mundo, com o ciclo nomeado.** Em hardware
  ele é erro de projeto; aqui seria ponto fixo que não converge, ou seja, trava

**Risco: já se materializou, e a resposta já é conhecida.** Esta fase sempre foi "a que pode
revelar que a arquitetura de tick único não aguenta". A CPU revelou antes de a fase começar:
tick único não distingue o que fecha dentro de um ciclo do que atravessa um registrador. A
saída **não** é abandonar o mínimo de um tick por aresta — é dar fases ao tick, que é como
simulador de lógica síncrona já funciona (os *delta cycles* de VHDL e Verilog) e é a distinção
que CPN faz entre transição imediata e transição temporizada. Detalhe em `theory.md` §7.5.

---

## F2 — Prova do motor: o que já está planejado, e basta

**Corrigido em 28/08/2026.** A versão anterior desta fase propunha um "lab de prova"
mínimo — a fila enchendo. Era redundante: a spec do handbook
(`docs/superpowers/specs/2026-08-28-otel-visual-handbook-design.md` §10) **já tem a prova em
dois estágios**, e melhor desenhada.

| Estágio | O que é | Papel |
|---|---|---|
| **Hero da Entrega 1** | Mini-simulação real embutida na landing, sobre `depth-core` e `otel-domain` de verdade | Primeiro teste do motor, sem depender do motor completo |
| **Piloto da Entrega 2** | *Anatomy of a Trace* com os quatro níveis, mais o anexo W3C Trace Context | Prova da profundidade. Nasce com os quatro porque prova parcial não prova nada |

Nada a acrescentar aqui. A correção que este documento precisava era **retirar** uma fase, não
inventar outra.

### F2.1 O que o piloto exige de verdade

E uma estimativa deste plano precisa ser corrigida junto. A afirmação de que "o primeiro lab
não exige nenhum arquétipo novo" valia para o lab da fila, **não** para o piloto:

| Nível | O que exige |
|---|---|
| L0 · Flow | O que já existe |
| L1 · Mechanism | Capacidade e política — F1 |
| **L2 · Wire** | **Canal abrível.** O enquadramento HTTP/2 mora dentro do `channel` |
| **L3 · Payload** | **Carga abrível.** O documento OTLP como objeto com interior |

L2 e L3 são o custo real do piloto, e são também o diferencial (`why-simulate.md` §14).

---

## F3 — Palco

Adotar React Flow antes de investir em desenho próprio (`stack.md` §1).

| Item | Nota |
|---|---|
| Nós aninhados com `parentId` e `extent: "parent"` | É a moldura com clamp, de graça |
| Handles como portas | Entrada, saída, descarte, e as portas de **controle** |
| Duas espécies de linha | Dado em traço grosso, controle em tracejado fino (`kinds.md` §1.1) |
| Foco por caminho, breadcrumb, selecionar contra abrir | Já especificado na §4 da spec do motor |
| Deep link com semente, foco, tick e seleção | Sem a semente na URL, o handbook não pode apontar para um fenômeno |

**Saída:** abrir o provider, descer até a fila, selecionar uma carga, avançar, e ver a forma
dela mudar ao atravessar o `transform` — tudo por smoke automatizado.

---

## F4 — `otel` como primeiro pacote de modelo

Aqui o projeto deixa de ser motor e passa a ser produto.

| Item | Nota |
|---|---|
| Árvore fiel do TracerProvider | Cada objeto com âncora na spec oficial |
| Importador de manifesto, três camadas | Esqueleto do compose, recheio por resolvedor de imagem, ajuste por `environment` e arquivo montado (`VISION.md` §5) |
| Leitura da configuração nativa | O mesmo YAML do Collector, não formato inventado |
| Contrato de fidelidade no CI | Todo parâmetro resolve para ajuste real documentado, com link que o CI verifica |
| Validação contra o real | O mesmo arquivo roda no modelo e no `labs/<slug>/`, e os dois concordam qualitativamente |

**Saída:** despachar um `compose` com Collector e receber o modelo montado, sem edição
manual. Serviço sem pacote aparece como bloco opaco declarado, nunca como caixa vazia.

**Risco:** é a fase onde a fidelidade é ganha ou perdida. Se o modelo e o lab real
discordarem e a discordância for resolvida ajustando o *modelo* para parecer certo, o
projeto virou teatro.

---

## F5 — Handbook gerado da travessia

Cada objeto já carrega explicação com âncora. O handbook é uma **ordem de visita** sobre a
árvore, não um documento paralelo.

**Saída:** a página do lab é gerada do modelo, e mudar a árvore muda a página. Nenhum texto
técnico sem link para a fonte.

---

## F6 — CPU: onde o motor amadurece

Um caminho de dados de CPU, com **assembly como entrada** e drill-down até a porta
lógica. Detalhamento completo em `theory.md` §7.

**Tem público, e isso muda o peso da fase.** O Luigi declarou em 29/08/2026 que este
alvo é material para as **aulas do pai dele**: um modelo com entrada especial, que se
programa em assembly, para ensinar arquitetura de computadores. Deixa de ser só a prova
de que o motor é genérico e passa a ser uma entrega com destinatário — e um leitor real,
que não é o Luigi, é a coisa mais escassa que um projeto assim tem.

**Decidido em 29/08/2026 pelo Luigi: a CPU passa na frente do Kafka.** Dois motivos, e o
segundo é o que decide. O primeiro é que ela tem público e o Kafka não. O segundo é que
**extrair o motor tendo visto só domínios de mensageria — OTel e Kafka — é extrair um
motor de mensageria com outro nome.** A CPU é o alvo mais distante que ainda cabe nas
primitivas, e é justamente por isso que ela é o teste; o Kafka, colado no OTel, quase
não pressiona a abstração.

**Revisto no mesmo dia, e é uma inversão de verdade: a CPU passa também na frente do
OTel** (F4 e F5). A versão anterior desta linha dizia o contrário — que furar essa ordem
faria o projeto perder o alvo que lhe dá nome. O argumento do Luigi que a derrubou:

> "o otel é bom mas vai precisar de bastante trabalho e refinamento, para isso quero
> amadurecer mais o motor com o `.model` da cpu"

E ele está certo sobre a natureza dos dois trabalhos. O que falta no OTel é sobretudo
**editorial** — currículo, texto, procedência, fidelidade a uma especificação enorme —, e
esse trabalho não pressiona o motor; ele consome tempo enquanto o motor fica igual.
A CPU é o oposto: pouquíssimo texto, e uma verdade de campo dura e verificável (uma ISA
executa um programa ou não executa). É o alvo que **amadurece o motor por unidade de
esforço**, e amadurecer o motor é pré-requisito de o OTel ficar bom, não concorrente
dele.

**O risco disso, dito em voz alta:** o projeto se chama OTel Visual Handbook e acaba de
adiar o OTel. Se a CPU virar o produto, o projeto trocou de identidade sem decidir
trocar. A trava contra isso é um **critério de reentrada declarado**, e não força de
vontade:

> A F6 termina — e o OTel recomeça — quando as cinco mudanças da F1 estiverem fechadas
> **e** o `cpu-domain` rodar um programa de verdade sem que `depth-core` tenha ganhado
> uma linha que saiba o que é um registrador. Amadurecer o motor é o objetivo; construir
> um simulador de arquitetura de computadores completo **não é**, e a hora de parar é a
> hora em que a próxima tarefa da CPU não ensina mais nada ao motor.

Ela nomeou **seis** lacunas do motor — três previstas e três que só a construção achou —,
todas legítimas e nenhuma resolvível com um `kind` novo. **Todas fechadas em 29/08/2026:**

| Lacuna | O que faltava | Onde fechou |
|---|---|---|
| Linha de controle sem semântica | sinal muda o que o ator faz no ciclo, contado como tráfego e nunca como carga | `sigin:`, `ctx.signals`, `toPort` obrigatório |
| Ler sem consumir | banco como ator que responde a pedido — nenhum ator espia o estado de outro | o banco responde; a escrita do tick já vale para a leitura dele |
| Combinacional × registrado | o tick ganha fases: acomodação em ordem topológica, depois o que atravessa a borda | `Wire.timing`, `settle` × `clocked` |
| **A acomodação era invisível de fora** | o livro-caixa contava *quantas* mensagens saíram, nunca o que diziam | `WorldState.settled` |
| **Não havia fonte constante da acomodação** | um trilho de alimentação não recebe nada e precisa dirigir dentro do tick | `ObjectSpec.drives`, com as duas mentiras recusadas na construção |
| **Bornes não compunham** | a expansão abria uma camada e a carga caía no terminal errado, calada | expansão recursiva, `Borne = string \| { node, port }` |

E uma menor, ainda aberta: **escala de tempo é do mundo, não do motor** — 100 ms no OTel,
~0,3 ns na CPU. A constante vira propriedade do `WorldSpec`, com unidade.

### O critério de reentrada foi atingido — 2026-08-29

As três condições, com a evidência de cada uma:

- **As mudanças da F1 fechadas** — as cinco previstas e mais três achadas no caminho.
- **`cpu-domain` roda programa de verdade** — RV32I, montador com erro em linha e coluna,
  diferencial instrução a instrução, 484 testes unitários e 78 e2e verdes.
- **`depth-core` não sabe o que é um registrador** — `pnpm boundaries` verde em 60 arquivos,
  e nenhuma das seis mudanças acima usa vocabulário de CPU.

A fatia vertical desceu até o fim: `circuito › bit0 › XOR › NAND › PMOS`, oito níveis, com o
somador de 4 bits rodando em transistores de verdade.

**E o sinal de parada apareceu.** O que sobrou da CPU — abrir a unidade lógica (deslocador,
comparador, lógica bit a bit) — é o mesmo trabalho do somador repetido em outro caminho, e
não ensina nada novo ao motor. Ela fica folha, e isso está declarado no arquivo. Pela regra
escrita acima, **é aqui que se para**.

Fica uma decisão de ordem para o Luigi, e ela não é nossa: a linha de ordem manda
`F6 → F6b (ATmega) → F4 (OTel)`, e o critério de reentrada diz que o OTel recomeça no fim da
F6. O ATmega traz **interrupção** — controle assíncrono que preempta o fluxo, o primeiro
fenômeno que talvez não caiba nas primitivas —, então ele ainda ensinaria o motor; mas ele
também é mais um passo antes do alvo que dá nome ao projeto.

**Saída:** um pacote `cpu-domain` que importa exclusivamente `depth-core` e `depth-ui`,
executa um programa em assembly de verdade, abre até a porta lógica, e **não obrigou
`depth-core` a saber o que é um registrador**. Commits em `depth-core` fechando as três
lacunas contam a favor; vocabulário de CPU dentro dele reprova.

### F6b — ATmega: a fidelidade posta à prova

Pedido pelo Luigi em 29/08/2026, **depois** de a CPU genérica estar bem feita. Um AVR de
8 bits (o ATmega328P é o candidato óbvio: é o do Arduino Uno, tem datasheet público e
detalhado, e é o chip que mais gente já viu).

Os dois alvos testam coisas diferentes, e é por isso que os dois valem:

| A CPU genérica testa | O ATmega testa |
|---|---|
| **Mecanismo** — o motor consegue expressar caminho de dados, controle e ciclo? | **Fidelidade** — o modelo bate com um chip real, num nível em que a discordância é objetiva? |
| A verdade de campo é uma ISA que a gente escolhe | A verdade de campo é um datasheet que a gente não controla |
| Erra-se por incapacidade do motor | Erra-se por o modelo ser mais simples que o mundo — e aí o `not_modeled` precisa dizer isso |

E ele pressiona coisas que a CPU didática não tem, cada uma um candidato a lacuna nova:

- **Interrupção** — controle *assíncrono* que preempta o fluxo. O motor hoje não tem nada
  que interrompa o que está acontecendo; é o primeiro fenômeno da lista que talvez não
  caiba nas primitivas atuais, e por isso é o mais valioso de tentar.
- **Periférico mapeado em memória** — temporizador, GPIO, USART, ADC. Escrever num
  endereço faz uma coisa acontecer no mundo, o que é um efeito colateral endereçado.
- **Harvard** — programa e dados em memórias separadas, com barramentos separados. Bom
  contraste com a von Neumann do alvo anterior, e de graça: é a mesma peça em outra
  topologia.
- **Pinos** — a fronteira do chip com o lado de fora vira porta de verdade.

**Sinal a observar, não critério:** quantas lacunas novas do motor o ATmega abre depois
da CPU genérica. Zero significa que o motor amadureceu. Cinco significa que ele estava
sendo derivado do primeiro alvo, e aí o problema é do motor, não do ATmega.

---

## F7 — Kafka: o terceiro alvo

**Revisado em 28/08/2026.** Era "o teste da tese do projeto", medido pelo custo relativo do
segundo pacote. Com o corte de escopo que fez cada `model` ser ilha
(`why-simulate.md` §9), reuso deixou de ser requisito — logo, deixou de ser critério de
saída. O Kafka volta a ser simplesmente mais um alvo.

Arquétipos da onda 2: `log`, `deliver`, `supervisor`.

**Saída:** o `model` do Kafka existe, com handbook próprio, e o `log` ensina atraso por
leitor — o fenômeno mais estranho ao TracerProvider, e o que justifica o Kafka continuar na lista.

O que continua valendo observar, agora como informação e não como nota de aprovação:
**quantos arquétipos novos o Kafka exigiu além dos três previstos.** Um ou dois é normal.
Cinco significa que o catálogo está sendo derivado caso a caso — e aí o problema é do
catálogo, não do reuso.

---

## F8 — Extração do motor

Só depois de F6 e F7. Motor extraído antes de dois casos completos fica genérico e inútil, e
motor sem conteúdo não atrai ninguém em open source.

Nesta fase entram o contrato de plugin, o pacote publicável e a decisão do repositório
próprio.

---

## Como medir se está dando certo

| Sinal | Bom | Ruim |
|---|---|---|
| Arquétipos novos por alvo | Cai a cada alvo | Constante ou crescendo |
| `modelet` por fenômeno | Menos `modelet` que fenômeno | Trinta `modelet` para oito fenômenos é reimplementação (`why-simulate.md` §3.1) |
| Parâmetro sem procedência | Zero, garantido por CI | "Depois a gente ancora" |
| Fenômeno que precisou de roteiro | Zero | Qualquer um |
| Tarefa da CPU que não ensina nada ao motor | É o sinal de parar e voltar ao OTel | Fazer mesmo assim, porque é divertido |
| Discordância entre modelo e lab real | Resolvida corrigindo o modelo **ou** declarando o que não é modelado | Resolvida deixando o modelo bonito |

O quarto é o mais importante. No dia em que um fenômeno precisar ser roteirizado para
aparecer, o projeto deixou de ser simulação e passou a ser animação — e nenhum dos outros
sinais importa mais.

## Onde a autoria assistida entra, e onde não entra

O Luigi quer usar IA em peso na produção de pacotes. Isso funciona **com** portão e é
perigoso sem, porque o único ativo do projeto é a fidelidade e geração assistida produz
texto plausível (`VISION.md` §9.3).

| Entra bem | Não entra |
|---|---|
| Rascunhar a composição de um pacote a partir da documentação oficial | Escrever comportamento de arquétipo sem revisão |
| Levantar e organizar fontes antes de escrever | Ser a fonte de uma afirmação técnica |
| Propor a ordem de ensino de uma trilha | Decidir o que é fiel |
| Encontrar divergência entre o modelo e a documentação | Resolver a divergência sozinha |

O que torna isso seguro é a §4.1 da visão: **pacote é dado validado por schema.** Compor
dado errado é localizável e difável; comportamento errado escondido numa função, não.

## Ordem, em uma linha

```
F0 destravar → F1 núcleo → F3 palco → F2 piloto (Entregas 1 e 2) → F2b arquétipos
  → F6 cpu → F6b atmega → F4 otel → F5 handbook → F7 kafka → F8 motor
```

Os identificadores de fase são **nomes, não sequência** — F3 sempre veio antes de F2, e desde
29/08/2026 a F6 vem antes da F4. Quem manda é a linha acima.

O piloto e o palco se sobrepõem: não há lab sem palco, e o palco só se justifica pelo lab. E a
onda de arquétipos vem **depois** do piloto, porque o piloto revela quais são realmente
necessários.

A CPU vem antes do OTel porque amadurece o motor por unidade de esforço, e o motor maduro é
pré-requisito de o OTel ficar bom. O critério de reentrada está na F6, e existe justamente
porque essa ordem é a que mais facilmente vira desvio permanente.

O playground (`why-simulate.md` §10) não é fase: ele nasce de graça ao fim de F3, porque é a
mesma paleta e a mesma engine, sem exigência de procedência.

Nenhuma fase começa antes de a anterior ter fechado o critério de saída. O sinal de alarme
mais confiável do projeto é começar o Kafka antes de o OTel estar fechado.
