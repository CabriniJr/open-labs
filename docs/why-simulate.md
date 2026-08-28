# Por que simular, se instalar o real é mais fácil

**Status:** análise para decisão. Fontes verificadas em 28/08/2026.
**Depende de:** `VISION.md`, `model-format.md`

A pergunta, como o Luigi a colocou: *não quero refazer o OpenTelemetry quase do zero, porque
é mais fácil instalar e configurar ele — mas aí você não vê como as coisas estão
acontecendo.*

Ela está certa e merece resposta em vez de conforto. As duas metades da frase apontam para
produtos diferentes, e é aí que a discussão trava.

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

## 2.1 E o que essas quatro ferramentas têm em comum é a boa notícia

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

## 6. C: a versão que responde diretamente à sua preocupação

Se o incômodo é "não quero reconstruir o que já existe", há um caminho que usa o real como
fonte em vez de competir com ele:

> **O `model` como lente.** Você já roda o Collector. A ferramenta lê a telemetria interna
> dele e usa como entrada dos medidores do modelo. O mapa é conceitual; os números são seus.

Por que é atraente: não reconstrói nada, resolve exatamente a queixa ("não vejo o que está
acontecendo"), reusa tudo que já está desenhado, e nenhuma das quatro ferramentas da §2 faz
isso.

**E por que não deve ser a v0**, com três razões:

1. **Introduz uma mentira nova.** A telemetria interna é agregada. Animar itens individuais a
   partir de agregado é *reconstituição*, não observação — o item na tela não é aquele item.
   Se isso não for declarado com o mesmo rigor do `out_of_scope`, o projeto quebra sua única
   regra
2. **Quebra o motor puro sem entrada e saída**, que é a concessão já aceita na discussão de
   determinismo. Ler endpoint é efeito colateral, e o contrato de plugin muda
3. **Depende de tudo o resto funcionar.** Sem `model` fiel, sem medidor e sem palco, não há
   onde os números reais entrarem

C é a v1 mais promissora. Não é a v0.

---

## 7. Corte de escopo decidido em 28/08/2026: `model` é ilha

Decisão do Luigi: **cada `model` é coisa separada.** Sem intercâmbio, sem biblioteca
compartilhada obrigatória, sem teste de compatibilidade entre eles.

Concordo, e por razões que valem registrar — mas há um custo que precisa ser assumido de
olhos abertos.

### 7.1 Por que o corte é certo

| Ganho | Detalhe |
|---|---|
| Some o pior risco de versionamento | Era o risco 2 de `model-format.md`: `modelet` muda e quebra três `model`. Ilhas não quebram umas às outras |
| Cada `model` entrega sozinho | Desenvolvido, versionado e revisado isolado. Não precisa acertar a abstração compartilhada antes do primeiro ficar pronto |
| A abstração passa a ser descoberta, não projetada | Extrair o comum **depois** de ver o padrão duas vezes é melhor prática que projetá-lo antes. Reuso deixa de ser requisito e passa a ser observação |

### 7.2 O que se perde, e é real

**A tese de generalização fica sem prova.** O argumento de que isto é um motor e não um
handbook dependia de o segundo `model` custar uma fração do primeiro. Com ilhas, o projeto é
*vários handbooks que compartilham um motor* — o que continua valioso, mas é uma afirmação
menor, e a comunicação precisa refletir isso.

Consequência no plano: **F6 deixa de ser "o teste da tese" e passa a ser simplesmente o
segundo alvo.** O sinal de reuso sai da tabela de critérios e vira curiosidade a observar.

### 7.3 O que fica de `modelet`

A estrutura, não a promessa. `modelet` continua sendo a unidade de composição **dentro** de
um `model` — porque portas, `params`, `teaches` e `not_modeled` são úteis mesmo sem reuso
cruzado. O que sai é a obrigação de ele servir outra aplicação.

Custo do corte: aproximadamente zero. Nada no formato muda; muda o que se promete dele.

### 7.4 Ilha com porto, não ilha fechada

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

## 8. O playground, e uma correção de vocabulário que evita um erro caro

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

### 8.1 O playground tem régua diferente, e isso é o que o torna barato

Um `model` publicado exige `source.native` em todo parâmetro, `anchor`, `valid_for` e
`verified_at` (`model-format.md` §2 e §4.1). Um rascunho no playground **não exige nada** —
não afirma nada sobre ferramenta real, então não tem o que ancorar.

Portão limpo, e ele resolve a tensão sozinho:

> Playground não publica `model`. Para um rascunho virar `model` publicado, ele passa a
> precisar dos campos de procedência.

### 8.2 O ganho estratégico que compensa o corte da §7

Com `model` como ilha, o reuso deixou de ser projetado. O playground é **onde ele emerge**:
as pessoas montam, você observa o que se repete, e o que se repete vira `modelet` de
biblioteca — extraído a partir de evidência, não de hipótese.

O playground substitui a aposta de generalização por descoberta empírica. Ele não é um desvio
do foco; é o instrumento que torna o corte seguro.

---


## 9. Recomendação de ordem

| Quando | O que | Por quê |
|---|---|---|
| **v0** | A puro. Simulador didático, sem deploy e sem leitura do real | É o único que se sustenta sozinho, e é o escopo já desenhado |
| **v0.5** | **Playground**: paleta de arquétipos, validação, engine ao vivo | Reusa o que já existe, não exige procedência, e é onde o reuso emerge (§8.2) |
| **v0.5** | Exportar o `compose` do lab, sem prometer produção | Barato, honesto, e é a §15 da spec do motor. "Rode isto de verdade se quiser" |
| **v1** | C como modo separado: ligue seu Collector | Alto valor, e só faz sentido depois que o modelo é fiel |
| **Não fazer** | B forte: gerar configuração para produção | Concorrência estabelecida, manutenção incompatível com projeto pessoal, e muda a régua de qualidade |

A v0.5 merece atenção porque é quase de graça e desarma o argumento de trabalho duplicado
pelo outro lado: o lab **entrega** o `compose` real. Você aprende no modelo e sai com o
arquivo que roda.

---

## 10. Quando este projeto não deveria existir

Vale definir agora, porque decidir isso sob decepção é pior.

| Condição | O que significa |
|---|---|
| O Collector ganha modo oficial de introspecção visual com controle de tempo | O diferencial evaporou. Contribuir para lá passa a valer mais |
| Alguém publica open source que simula mecanismo com drill-down | Contribuir em vez de competir |
| O segundo `model` custa o mesmo que o primeiro | A tese de generalização está errada (`roadmap.md` F6). Vira handbook de OTel e pronto — o que ainda é útil, mas é outro projeto |
| Ninguém termina o segundo lab | O produto é interessante de construir e chato de usar. É o risco mais silencioso dos quatro |

Nenhuma dessas condições é verdadeira hoje. As duas primeiras foram verificadas em
28/08/2026.

## 11. A resposta curta

O simulador não substitui instalar o Collector, e não deve tentar. Ele substitui **o quadro
branco**, o *"deixa eu te explicar como o batch processor funciona"* que todo time de
observabilidade repete a cada pessoa nova.

Isso é um problema pequeno e real, e é o tipo de problema que uma pessoa consegue resolver
bem. Gerar configuração de produção é um problema grande com quatro concorrentes, e não é.
