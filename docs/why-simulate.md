# Por que simular, se instalar o real é mais fácil

**Status:** análise para decisão. Fontes verificadas em 28/08/2026.
**Depende de:** `VISION.md`, `model-format.md`

A pergunta, como o Luigi a colocou: *não quero refazer o OpenTelemetry quase do zero, porque
é mais fácil instalar e configurar ele — mas aí você não vê como as coisas estão
acontecendo.*

Ela está certa e merece resposta em vez de conforto. As duas metades da frase apontam para
produtos diferentes, e é aí que a discussão trava.

---

## 0. O princípio que o Luigi enunciou, e ele decide quase tudo

> Se a pessoa quiser fazer intercâmbio, é melhor e mais fácil com as ferramentas verdadeiras.

Elevado a regra, porque resolve várias decisões de uma vez:

> **A ferramenta ensina. Ela não opera.**

Consequências diretas, e uma delas contradiz o que este documento propunha antes:

| Ambição | Decisão |
|---|---|
| Ligar `model` em `model` | Fora. O real faz melhor |
| Gerar configuração para produção | Fora (§2), e agora por dois motivos |
| **Ler a telemetria do seu Collector real** | **Rebaixado de v1 para "provavelmente nunca"** — ver §6.1 |
| Ensinar o mecanismo com controle de tempo | **É isso, e só isso** |

Contexto que a torna mais firme: o projeto nasce de intenção pedagógica — o pai do Luigi é
professor, e a referência declarada é um handbook de aprendizado, não uma ferramenta de ops.
Isso muda a régua de sucesso, e a §12 registra a consequência prática.

---

## 1. Três produtos estão sendo confundidos

| | O que é | Valor | Estado |
|---|---|---|---|
| **A. Simulador didático** | Modelo que roda e mostra o mecanismo. Não faz deploy | Ver o que acontece, e por quê | **É o que está desenhado** |
| **B. Construtor visual de configuração** | Editor gráfico que gera `otelcol.yaml` ou `compose` para você subir | Produtividade de autoria | **Já existe, com dinheiro** |
| **C. Lente sobre o real** | Você já roda o Collector; a ferramenta lê a telemetria interna dele e desenha o mecanismo | Ver o **seu** sistema | Não existe |

A atração pela B é compreensível — parece o passo natural. Mas é a única das três que já
tem concorrência estabelecida.

---

## 2. B já existe, e você perderia essa briga

Levantado em 28/08/2026:

| Ferramenta | Quem | Licença | O que faz |
|---|---|---|---|
| **OTelBin** | dash0 | Open source | Editor web de configuração do Collector, com visualização de pipeline e validação |
| **Visual builder** | Coralogix | Comercial | Editor de pipeline baseado em grafo, integrado a Fleet Management |
| **Config Navigator** | Coralogix | Comercial | Visualização interativa da configuração, em tempo real |
| **Bindplane** | observIQ | Comercial | GUI de fleet via OpAMP, com montagem de pipeline arrastando |

Isso confirma a intuição do Luigi de que B exigiria "muita popularidade e manutenção" — e
explica por quê: **é o tipo de produto que só se sustenta com equipe paga**, porque precisa
acompanhar cada release de cada componente do contrib, e porque configuração errada gerada
pela ferramenta é problema da ferramenta.

Há um custo pior que o de manutenção. **B muda a régua de qualidade.** A régua já decidida é
"a decisão aparece?", não "o número está certo?" (`VISION.md`). Uma ferramenta que gera
configuração de produção precisa estar correta em *todo* campo, incluindo os que não ensinam
nada — que é exatamente o `params` inflando até virar formulário, mas agora obrigatório.

### 2.1 E o que essas quatro ferramentas têm em comum é a boa notícia

**Todas param na configuração estática.** Elas desenham o pipeline declarado; nenhuma mostra
um item atravessando, uma fila enchendo, ou um lote partindo por tempo em vez de tamanho.

É o mesmo padrão que o levantamento de `compose` para diagrama já tinha mostrado
(`VISION.md`): a indústria inteira desenha topologia e para ali. Quatro ferramentas, duas
delas comerciais, resolvendo *ler a configuração* — e nenhuma resolvendo *ver o mecanismo*.

Isso é a evidência mais forte que o projeto tem. Não porque ninguém pensou nisso, mas porque
quem tem incentivo comercial não tem motivo para construir: **entender o mecanismo não vende
licença.**

---

## 3. A: por que não é refazer o OpenTelemetry

O medo é legítimo, e a resposta é que **a comparação está errada**.

O modelo não compete com o Collector rodando. Ele compete com **o quadro branco e o
código-fonte** — que são as duas coisas que alguém usa hoje para entender como o
BatchSpanProcessor decide despachar.

Ninguém instala o Collector para aprender como ele funciona. Instala para coletar telemetria.
E quem instala para aprender descobre o problema que o Luigi descreveu: **você não vê nada**.
Vê logs e séries agregadas. A fila não aparece. O lote não aparece partindo.

E há uma trava concreta que impede o escopo de virar reimplementação, e ela já está escrita:
**modela-se fenômeno, não componente.** Se um componente não produz decisão visível, ele não
entra — nem como caixa. O campo `out_of_scope` de `model-format.md` §2.4 existe justamente
para isso ser declarado em vez de negociado a cada revisão.

### 3.1 Uma métrica para detectar reimplementação antes que doa

> **Razão entre `modelet` e fenômeno.** Trinta `modelet` para oito fenômenos é
> reimplementação. Oito `modelet` para doze fenômenos é ensino.

Mensurável a cada `model`, e o sinal aparece antes de o custo ficar alto. Vale entrar na
tabela de sinais do `roadmap.md`.

---

## 4. O que o real já dá — e é mais do que parece

Honestidade primeiro, porque o argumento fica mais forte assim: o Collector **tem**
introspecção.

| Recurso | O que dá |
|---|---|
| Extensão `zpages` | Endpoint HTTP com dados vivos de componentes instrumentados |
| Telemetria interna documentada | Métricas do processador de lote (tamanho e bytes enviados) e da fila do exportador |
| Log em nível de depuração | Rastro textual do caminho |

Um operador experiente vê bastante. Então "o real é invisível" seria exagero, e o projeto não
deve se apoiar nisso.

## 5. As quatro coisas que o real não dá

O valor está aqui, e é mais estreito e mais defensável do que "o real é opaco".

**1. Controle do tempo.** No real você espera o fenômeno acontecer. Não pausa no instante em
que a fila encheu, não volta dois passos, não avança um item só. O modelo faz o fenômeno
acontecer, para nele, e volta. É a diferença entre um Arduino na mesa e o Wokwi.

**2. Falha sem consequência.** "O que acontece se a saída fechar?" No real, você quebra algo
— e em produção não tenta. No modelo é um clique, reversível, e reprodutível pela semente.
Nenhuma quantidade de introspecção resolve isso, porque o obstáculo não é observabilidade, é
risco.

**3. O indivíduo, não o agregado.** A telemetria interna dá `queue_size` e tamanho de lote
agregados. Ela não mostra *aquele* item atravessando, nem por que *esse* lote partiu por
tempo e não por tamanho. Métrica responde "quanto"; o modelo responde "por quê, neste caso".

**4. Zero instalação.** Estudante de ops sem cluster, sem Docker e sem memória sobrando abre
o navegador. "Só instale o Collector" exclui um público inteiro — e é um dos dois públicos
declarados na visão.

Nenhuma das quatro é resolvível melhorando a introspecção do real. Isso é o que faz o
simulador não ser trabalho duplicado.

---

## 6. C: a lente sobre o real, e por que ela caiu

Ideia: em vez de simular números, ler a telemetria interna do Collector que você já roda.

> **O `model` como lente.** O mapa é conceitual; os números são seus.

Por que era atraente: não reconstrói nada, resolve a queixa "não vejo o que está acontecendo",
e nenhuma das quatro ferramentas da §2 faz isso.

**Não deve ser a v0**, por três razões:

1. **Introduz uma mentira nova.** A telemetria interna é agregada. Animar itens individuais a
   partir de agregado é *reconstituição*, não observação — o item na tela não é aquele item.
   Sem declarar isso com o rigor do `out_of_scope`, o projeto quebra sua única regra
2. **Quebra o motor puro sem entrada e saída**, concessão já aceita na discussão de
   determinismo. Ler endpoint é efeito colateral, e o contrato de plugin muda
3. **Depende de tudo o resto funcionar.** Sem `model` fiel, medidor e palco, não há onde os
   números reais entrarem

### 6.1 E pela regra da §0, ela provavelmente nunca deve acontecer

"A ferramenta ensina, não opera" se aplica aqui também. Se você quer ver o **seu** Collector,
as ferramentas verdadeiras fazem melhor: zpages, telemetria interna, Grafana. Construir uma
terceira via para observar o real seria competir no terreno onde o real ganha.

Então C sai do roadmap. Fica registrada como ideia analisada e recusada, com o motivo — o que
vale mais que uma promessa vaga de v1.

---

## 7. O concorrente mais próximo que existe: k8s.info

Referência trazida pelo Luigi, verificada em 28/08/2026. É o achado mais relevante deste
documento, e é preciso ser honesto sobre os dois lados.

**O que é:** *The Kubernetes Visual Handbook*. Open source, Docusaurus com MDX, 65 e tantos
visualizadores interativos, currículo em cinco fases (Foundations → Core → Intermediate →
Advanced → Expert), com trilhas separadas por papel — desenvolvedor, plataforma, arquiteto. A
promessa da página inicial é literalmente *mude valores, provoque falhas, e veja o cluster
reagir*.

Isso é mais próximo do projeto do que qualquer coisa levantada antes — mais que LikeC4, mais
que Wokwi, mais que os visualizadores de Kafka. Mesmo gênero, mesmo nome de categoria
("Visual Handbook"), mesma estrutura de currículo. Precisa entrar no prior art da visão com
destaque.

### 7.1 A boa notícia

**O gênero está validado.** Alguém construiu, publicou, manteve e estruturou um currículo
inteiro nesse formato. A dúvida "isso interessa a alguém?" fica respondida, e a estrutura que
`depth.md` §4.3 propôs — currículo progressivo com fenômeno por parada — é a mesma que o
k8s.info usa na prática.

### 7.2 A notícia difícil, e é sobre execução, não sobre ideia

A tabela de currículo do k8s.info tem uma coluna "Visualizer", e cada módulo tem **o seu**:
*Pod lifecycle simulator*, *Reconciliation demo*, *Deployment playground*, *Service selector
playground*, *Storage binding visualizer*. Um componente dedicado por conceito.

Isso é a categoria que o levantamento anterior já tinha nomeado — didático, competente, e
**hardcoded**: sem motor comum, sem drill-down recursivo, sem procedência declarada. O que
significa que a diferenciação do projeto continua existindo. Mas também significa isto, e é
desconfortável:

> **Escrever 65 componentes à mão é mais rápido que construir um motor.** O caminho do motor
> perde no começo e só ganha na escala.

Estimativa grosseira para dar ordem de grandeza: se um visualizador à mão custa X, e o motor
custa algo como 20X mais X/5 por conceito, o motor se paga por volta do vigésimo quinto
conceito. Os números são inventados; a forma da curva não é.

Consequência honesta:

| Se o escopo real é | O caminho certo é |
|---|---|
| Doze páginas sobre OTel | **Componentes à mão.** O k8s.info provou que funciona, e é mais rápido |
| Sessenta páginas cobrindo OTel, Kafka, Prometheus | **O motor**, e aí ele se paga |

Isso não é argumento contra o projeto. É a explicitação de que **o motor é uma aposta em
escala**, e vale saber que é uma aposta antes de fazê-la.

### 7.3 E o que o motor dá que 65 componentes não dão

Três coisas, e todas já foram declaradas importantes nas decisões anteriores:

1. **Drill-down recursivo consistente.** O mesmo objeto visto em dois níveis, derivado, sem
   redesenhar. Componentes independentes não compõem: não há como abrir o Pod que está dentro
   do ReplicaSet que está dentro do Deployment e ser o mesmo objeto
2. **Procedência num lugar só.** Sessenta e cinco componentes à mão são sessenta e cinco
   lugares onde um default pode estar errado sem ninguém saber. `verified_at` num modelo é um
   ponto de verificação
3. **Determinismo e deep link.** Apontar para o instante exato do fenômeno, e a outra pessoa
   ver o mesmo

---


## 8. A régua pedagógica, e o que ela exige que ainda não existe

O projeto nasce de intenção de ensino. Isso muda o critério de sucesso de um jeito que nenhum
dos documentos anteriores tratou:

> O critério não é **quantas simulações a ferramenta tem**. É **o que a pessoa consegue
> explicar depois**.

Consequência incômoda: um handbook sem checagem de compreensão é um vídeo. A pessoa assiste a
fila encher, acha bonito, fecha a aba, e não muda nada no que ela sabe. É o risco mais
silencioso da §12 — "ninguém termina o segundo lab" — visto pelo outro lado.

O que a régua pedagógica sugere acrescentar, e nada disso está no plano:

| Peça | Por quê |
|---|---|
| **Predição antes da revelação** | Perguntar "o que você acha que vai acontecer se a saída fechar?" **antes** de rodar. É o achado mais replicado da pesquisa em simulação didática: quem prediz e erra aprende; quem só assiste, não |
| **Fenômeno como pergunta, não como legenda** | O `teaches` do `modelet` já declara o fenômeno. Falta declará-lo como pergunta com resposta verificável |
| **O que a pessoa leva** | Ao fim de uma trilha, o `compose` que ela montou, ou uma explicação que ela escreveu. Artefato, não sensação de ter entendido |

Isso é barato e cabe no formato: `teaches` ganha um campo de pergunta, e a parada do handbook
ganha um momento de predição antes de liberar o controle do tempo. Não exige nada do motor.

E é onde o método do PhET é aproveitável de graça — o código é GPL-3 e as simulações são
CC BY-NC, mas o **método** de desenho de simulação didática é literatura publicada, livre para
aplicar.

---


Decisão do Luigi: **cada `model` é coisa separada.** Sem intercâmbio, sem biblioteca
compartilhada obrigatória, sem teste de compatibilidade entre eles.

Concordo, e por razões que valem registrar — mas há um custo que precisa ser assumido de
olhos abertos.

### 9.1 Por que o corte é certo

| Ganho | Detalhe |
|---|---|
| Some o pior risco de versionamento | Era o risco 2 de `model-format.md`: `modelet` muda e quebra três `model`. Ilhas não quebram umas às outras |
| Cada `model` entrega sozinho | Desenvolvido, versionado e revisado isolado. Não precisa acertar a abstração compartilhada antes do primeiro ficar pronto |
| A abstração passa a ser descoberta, não projetada | Extrair o comum **depois** de ver o padrão duas vezes é melhor prática que projetá-lo antes. Reuso deixa de ser requisito e passa a ser observação |

### 9.2 O que se perde, e é real

**A tese de generalização fica sem prova.** O argumento de que isto é um motor e não um
handbook dependia de o segundo `model` custar uma fração do primeiro. Com ilhas, o projeto é
*vários handbooks que compartilham um motor* — o que continua valioso, mas é uma afirmação
menor, e a comunicação precisa refletir isso.

Consequência no plano: **F6 deixa de ser "o teste da tese" e passa a ser simplesmente o
segundo alvo.** O sinal de reuso sai da tabela de critérios e vira curiosidade a observar.

### 9.3 O que fica de `modelet`

A estrutura, não a promessa. `modelet` continua sendo a unidade de composição **dentro** de
um `model` — porque portas, `params`, `teaches` e `not_modeled` são úteis mesmo sem reuso
cruzado. O que sai é a obrigação de ele servir outra aplicação.

Custo do corte: aproximadamente zero. Nada no formato muda; muda o que se promete dele.

### 9.4 Ilha com porto, não ilha fechada

Esclarecimento do Luigi no mesmo dia: entrada e saída devem ser **possíveis**, preparando o
terreno sem construir agora — "não voar perto do sol e acabar sem nada concreto".

É a decisão certa, e a distinção é o que a torna barata:

| Agora | Um dia | Nunca prometido antes de existir |
|---|---|---|
| Cada `model` **declara** sua fronteira externa | Ligar `model` em `model` | Compatibilidade negociada automaticamente |
| A fronteira é alimentada por contorno: `source` sintético entra, `sink` consome | Substituir o contorno pelo `model` vizinho | Semântica de tempo compartilhada |

Custo hoje é zero, porque a fronteira é necessária de qualquer jeito — o handbook precisa saber
por onde a telemetria entra, e o importador precisa saber quais serviços conversam.

E ligar dois `model` um dia **não exige mecanismo novo**: é o teste de refinamento de
`depth.md` §3 aplicado à raiz, trocando a folha aproximada pela subárvore real.

O que trava não é formato, é **regime de execução** — o Collector e um broker têm semântica de
tempo diferente, e o motor tem escalonador único e global. Essa é a parte cara, está registrada
como lacuna, e é o que não deve ser prometido junto. Porta agora; tempo quando houver
necessidade real.

---

## 10. O playground, e uma correção de vocabulário que evita um erro caro

Ideia do Luigi: um editor livre, no espírito do draw.io ou do Excalidraw, aproveitando a
engine que já existe.

O uso é bom e barato. **Mas "canvas livre" é o vocabulário errado, e adotá-lo custaria a
única coisa que o projeto tem.**

| | Canvas livre (Excalidraw) | Editor de grafo com regras (Logisim, Wokwi) |
|---|---|---|
| O que uma seta é | Um desenho | Um `wire`, com porta de origem e destino |
| Ligação inválida | Permitida, e não significa nada | **Recusada pelo editor** |
| Onde vive a verdade | No desenho | No modelo; o desenho é projeção |
| O que roda | Nada | O modelo |

Num canvas livre você pode ligar a saída de um `buffer` num cano que transforma a carga, ou
dar comportamento a um composto. O modelo passa a poder mentir — e a honestidade estrutural é
o ativo defensável inteiro.

**O que o Excalidraw empresta é a sensação**: leve, direto, sem cerimônia, sem projeto para
criar. Não a mecânica.

E a boa notícia é que a stack já escolhida faz isso: React Flow tem validação de conexão,
handles tipados e arraste de paleta. O playground é **paleta dos dezenove arquétipos, mais
validação, mais a engine rodando ao vivo** — que é bem menos trabalho que um canvas de
desenho, não mais.

### 10.1 O playground tem régua diferente, e isso é o que o torna barato

Um `model` publicado exige `source.native` em todo parâmetro, `anchor`, `valid_for` e
`verified_at` (`model-format.md` §2 e §4.1). Um rascunho no playground **não exige nada** —
não afirma nada sobre ferramenta real, então não tem o que ancorar.

Portão limpo, e ele resolve a tensão sozinho:

> Playground não publica `model`. Para um rascunho virar `model` publicado, ele passa a
> precisar dos campos de procedência.

### 10.2 O ganho estratégico que compensa o corte da §9

Com `model` como ilha, o reuso deixou de ser projetado. O playground é **onde ele emerge**:
as pessoas montam, você observa o que se repete, e o que se repete vira `modelet` de
biblioteca — extraído a partir de evidência, não de hipótese.

O playground substitui a aposta de generalização por descoberta empírica. Ele não é um desvio
do foco; é o instrumento que torna o corte seguro.

---


## 11. Recomendação de ordem

| Quando | O que | Por quê |
|---|---|---|
| **v0** | A puro. Simulador didático, sem deploy e sem leitura do real | É o único que se sustenta sozinho, e é o escopo já desenhado |
| **v0.5** | **Playground**: paleta de arquétipos, validação, engine ao vivo | Reusa o que já existe, não exige procedência, e é onde o reuso emerge (§8.2) |
| **v0.5** | Exportar o `compose` do lab, sem prometer produção | Barato, honesto, e é a §15 da spec do motor. "Rode isto de verdade se quiser" |
| **v0.5** | Predição antes da revelação (§8) | Barato, não mexe no motor, e é o que separa handbook de vídeo |
| **Não fazer** | B: gerar configuração para produção | Concorrência estabelecida, manutenção incompatível com projeto pessoal, e muda a régua |
| **Não fazer** | C: ler telemetria do Collector real | Pela regra da §0, as ferramentas verdadeiras fazem melhor (§6.1) |

A v0.5 merece atenção porque é quase de graça e desarma o argumento de trabalho duplicado
pelo outro lado: o lab **entrega** o `compose` real. Você aprende no modelo e sai com o
arquivo que roda.

---

## 12. Quando este projeto não deveria existir

Vale definir agora, porque decidir isso sob decepção é pior.

| Condição | O que significa |
|---|---|
| O Collector ganha modo oficial de introspecção visual com controle de tempo | O diferencial evaporou. Contribuir para lá passa a valer mais |
| Alguém publica open source que simula mecanismo **com drill-down e motor comum** | Contribuir em vez de competir. **Verificado em 28/08/2026: o k8s.info chega perto** — simula e provoca falha, mas com visualizador dedicado por conceito, sem motor nem drill-down. O gatilho não disparou; está a um refactor de disparar |
| O segundo `model` custa o mesmo que o primeiro | A tese de generalização está errada (`roadmap.md` F6). Vira handbook de OTel e pronto — o que ainda é útil, mas é outro projeto |
| Ninguém termina o segundo lab | O produto é interessante de construir e chato de usar. É o risco mais silencioso dos quatro |

Nenhuma dessas condições é verdadeira hoje, e as três primeiras foram verificadas em
28/08/2026. A terceira deixou de ser critério com o corte de escopo da §9 — fica como
observação.

## 13. Decisão: segue com o motor, e a primitiva é fluxo

Decidido pelo Luigi em 28/08/2026, depois do contraponto da §7.2: **segue com o motor**, com a
justificativa de que os arquétipos são intercambiáveis e reutilizáveis em **qualquer coisa com
fluxo**.

Isso muda o cálculo de equilíbrio a favor da decisão, e vale explicitar por quê: se o domínio
é "sistemas de fluxo" e não "ferramentas de observabilidade", o número de conceitos possíveis
deixa de ser sessenta e passa a ser aberto. O vigésimo quinto conceito que faz o motor se pagar
fica fácil de atingir.

**A ressalva, e é a de sempre com generalidade:** "serve para qualquer coisa" é também o modo
clássico de um motor não servir bem para nada. Cada arquétipo genérico é menos preciso que um
componente dedicado. A trava contra isso já está no plano e precisa ser respeitada:
**generalizar por evidência, não por antecipação** — arquétipo só entra pagando em dois alvos.

### 13.1 Teste de generalidade, feito no papel

Se a primitiva é fluxo, o catálogo de `kinds.md` deveria expressar sistemas de fluxo fora de
TI. Testado contra seis, e o resultado é útil nas duas direções.

| Sistema | Como o catálogo o expressa |
|---|---|
| **Linha de produção** | `source` extração · `channel` esteira · `transform` fundição · `merge` e `tee` · `buffer` caixa · `arbiter` energia |
| **Rede de água** | `source` reservatório · `channel` tubo com capacidade · `buffer` caixa d'água · `router` válvula · `sink` consumo. **Pressão é backpressure literal** |
| **Pipeline de CI/CD** | `source` commit · `pipeline` estágios · `tee` matriz de build · `buffer` fila de jobs · **`arbiter` pool de runners** · `sink` deploy |
| **Processamento de pagamento** | `transform` autorização · `store` saldo · **`log` razão append-only** · `deliver` confirmação com reenvio · `router` antifraude |
| **Trânsito urbano** | `channel` via com capacidade · `merge` confluência · `buffer` estacionamento · **`arbiter` semáforo** |
| **Cadeia de suprimentos** | `store` estoque · `batch` carga · `deliver` com confirmação |

Os seis são expressáveis, e três encaixes são bons o bastante para servirem de argumento:
semáforo como árbitro, pool de runners como árbitro, e pressão hidráulica como backpressure.
São o mesmo arquétipo em domínios sem relação — que é exatamente a afirmação do Luigi,
sustentada.

### 13.2 As duas lacunas que o teste expôs

E aqui o teste paga o custo dele, porque encontrou o que faltava.

**1. Realimentação.** Bomba controlada por nível de reservatório, termostato, controle
proporcional. Sistemas de fluxo físico são cheios de malha fechada, e o motor não tem laço —
`depth.md` registra que nada no escopo atual exige um, porque a plataforma saiu. Se o motor for
anunciado como "qualquer coisa com fluxo", **alguém vai chegar com um termostato no primeiro
mês.**

**2. Conservação e receita.** Em fábrica e em rede de água a matéria se conserva: três minérios
viram uma placa. O motor tem `weight`, mas não tem razão de conversão declarada nem
verificação de conservação. Um `transform` hoje pode criar massa do nada sem que nada reclame.

Decisão proposta para as duas: **registrar, não construir.** Nenhuma paga em alvo de
observabilidade, e a régua de dois alvos vale para elas como para qualquer outra. Mas elas
mudam uma coisa hoje, de graça: **o motor não deve ser anunciado como universal para fluxo
enquanto não tiver realimentação.** "Fluxo de dados e de itens discretos, sem malha fechada" é
verdadeiro e continua amplo.

### 13.3 O que reduz o risco da aposta, e é acionável agora

Três coisas, e a primeira é a que muda o plano.

**Provar o motor com um lab, não com o catálogo.** A tentação é construir os dezenove
arquétipos, o formato e o palco, e só então o primeiro lab. O caminho de menor risco é o
inverso — e há um achado favorável: o primeiro lab do currículo de `depth.md` §4.3 é *a fila
enche e descarta*, que precisa de `source`, `channel`, `buffer` e `sink`. **Todos os quatro já
existem.** O que falta é capacidade e política, que é F1.

Ou seja: **o primeiro lab não exige nenhum arquétipo novo.** Ele exige o núcleo. Isso permite
provar o motor inteiro — modelo, tick, medidor, palco, perturbação, deep link — com o catálogo
que já está no código.

**A métrica de reuso volta, mais cedo e melhor.** O corte de escopo tirou o teste "o segundo
`model` custa uma fração". Em troca, a justificativa da aposta dá um teste mais precoce:
**quantos arquétipos o segundo lab reusa do primeiro.** Mensurável no lab dois, não no `model`
dois.

**A guarda de fronteira passa a ser ativo estratégico.** `node scripts/check-boundaries.mjs`
era higiene; se o valor do projeto é um motor reutilizável, ela é o que protege o valor.
Qualquer vazamento de vocabulário de observabilidade para dentro do motor custa a
reutilização que justifica a decisão.

---

## 15. O diferencial está em L2 e L3, não em "ver acontecer"

**Registrado em 28/08/2026**, depois de ler a spec do handbook — que este documento deveria ter
lido antes de argumentar.

Correções a fazer no que foi dito acima:

- O conselho de "esboçar o currículo primeiro" era desnecessário. **A ordem já existe e tem
  fonte:** as cinco fases vêm dos capítulos de *Learning OpenTelemetry* (Parker & Young,
  O'Reilly 2024), com a regra explícita de que o livro dá a ordem e as docs oficiais dão a
  verdade. A navegação já está desenhada como mapa de pré-requisitos, no espírito do roadmap.sh
- A objeção "o gargalo é conteúdo" cai em grande parte. O conteúdo tem ordem, fonte, fluxo de
  autoria documentado, e um acervo de anexos para não repetir explicação
- O princípio 2 da spec já é o que o campo `anchor` de `model-format.md` §2.4 implementa. A
  ideia estava lá antes

E o que sobra, depois das correções, é mais preciso do que "poder ver acontecer":

> **O diferencial é ver o mesmo dado atravessar os quatro níveis — até o frame e o byte.**

L0 e L1 são o que todo mundo faz: topologia e mecanismo. O k8s.info faz, o OTelBin faz à sua
maneira, qualquer diagrama animado faz. **Ninguém desce ao frame HTTP/2 e ao campo do protobuf
mantendo a identidade do dado.** É L2 e L3 que ficam vazios no levantamento inteiro.

E é exatamente isso que exige o motor, o que fecha a discussão da §7.2 com um argumento melhor
que o de escala: **a exigência não é ter quatro vistas — é serem a mesma coisa.** Um componente
dedicado por nível pode desenhar um frame HTTP/2 bonito; ele não pode garantir que aquele frame
carrega aquele span que o L0 mostrou entrando. Quatro visualizadores independentes produzem
quatro verdades que divergem no primeiro ajuste de parâmetro.

Consequência para o plano: L2 e L3 não são refinamento para depois. **São o produto**, e é por
isso que a spec acertou ao dizer que o piloto nasce com os quatro níveis porque prova parcial
não prova nada.

### 15.1 E "ser base para outros handbooks" tem um teste concreto

Não é o Kafka. O teste é **um handbook escrito por outra pessoa** — e o que habilita isso não é
o motor, é `docs/authoring.md`. Se o guia de autoria for bom o suficiente para alguém de fora
produzir um lab sem ler o código do motor, a base existe. Se não, o motor é reutilizável em
teoria e por uma pessoa só.

Isso reprioriza algo barato: o guia de autoria deixa de ser documentação de apoio e passa a ser
**interface pública do produto**.

---

## 16. A resposta curta

O simulador não substitui instalar o Collector, e não deve tentar. Ele substitui **o quadro
branco**, o *"deixa eu te explicar como o batch processor funciona"* que todo time de
observabilidade repete a cada pessoa nova.

Isso é um problema pequeno e real, e é o tipo de problema que uma pessoa consegue resolver
bem. Gerar configuração de produção é um problema grande com quatro concorrentes, e não é.

A pergunta que restava não era *se* vale fazer — era **se vale fazer com motor**. O k8s.info
mostra que o gênero funciona sem um, e o motor é a aposta de que o projeto vai ser grande o
suficiente para se pagar. **A aposta foi feita, com justificativa** (§13): os arquétipos são
reutilizáveis em qualquer sistema de fluxo, e o teste no papel sustenta isso em seis domínios
sem relação entre si.

O que a decisão exige em troca é disciplina em três pontos, e todos são verificáveis:
generalizar por evidência e não por antecipação; provar o motor num lab antes de encher o
catálogo (§13.3); e não anunciar como universal para fluxo enquanto não houver realimentação
(§13.2).
