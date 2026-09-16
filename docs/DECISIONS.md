# Decisões e ideias consolidadas

**Data:** 2026-08-28, com o enquadramento revisto em 2026-08-29
**Papel deste documento:** ponto de entrada. As ideias que sobreviveram, as que foram
recusadas, e as réguas que decidem discussão futura. Os outros documentos aprofundam; este
resolve.

Ordem de leitura para quem chega: **este** → `VISION.md` → `kinds.md` → `depth.md` →
`model-format.md` → `why-simulate.md` → `roadmap.md`. `theory.md` é opcional e fora da
ordem: é o motor descrito nos formalismos de que ele é instância (grafo hierárquico,
redes de Petri coloridas, cadeias de Markov) e, principalmente, a lista do que ele
**não** modela. Cada handbook tem a sua spec, e ela tem precedência sobre todos estes em matéria de
conteúdo e currículo — nunca sobre o motor: `otel.model` em
`superpowers/specs/2026-08-28-otel-visual-handbook-design.md`, `cpu.model` em
`superpowers/specs/2026-08-29-cpu-model-design.md`.

---

## O enquadramento: OpenLabs

*Revisto em 2026-08-29. Vem antes das seções numeradas porque muda o que elas
significam, e não o que elas decidem — nenhuma decisão abaixo foi revogada.*

O nome deixou de descrever o projeto no dia em que a CPU entrou no roteiro antes do
OTel. Um repositório chamado *OTel Visual Handbook* cujo próximo entregável é um
datapath RV32I mente no título — e a mentira não é cosmética: sugere que o motor é de
telemetria, quando o motor é justamente **o que não sabe o que é um span**.

- **OpenLabs** é a casa: um motor composicional, e vários handbooks rodando nele
- **Cada handbook é um `.model`** — `otel.model` (F4), `cpu.model` (F6). O que muda de
  um para outro é o domínio, nunca o motor. É a mesma fronteira que o CI já guarda
- **Todo handbook tem a mesma anatomia**, e é ela que dá a página: **roadmap** (a ordem
  em que os conceitos se sustentam) · **artigos** (o texto que explica) · **labs** (o
  modelo que roda). Um handbook sem as três não está pronto, e a página diz isso em vez
  de esconder
- **O reuso deixa de ser hipótese e vira o teste.** A §3 mandava recusar generalidade
  sem dois casos; agora há dois casos, e o segundo é de outro mundo — bit e sinal, não
  span e pipeline. O que o `cpu.model` pedir ao motor e o `otel.model` não usar é
  suspeito de ser domínio vazado

**O que não muda:** os pacotes seguem no escopo `@ovh/`. Renomear quebra CI e imports por
um ganho só de fachada; o nome que o leitor vê já está certo. A renomeação técnica sai de
graça quando o motor for para repositório próprio — a decisão aberta nº 7 da §7.

**O que mudou:** o repositório passou a se chamar `CabriniJr/open-labs` (o nome antigo
redireciona, e o clone local ainda se chama `otel-visual-handbook` — pasta é nome de
pasta). Os links que o **site publica** apontam para o nome novo, e há teste cobrando isso:
link que o leitor clica não pode depender de redirecionamento de terceiro continuar
existindo.

**Onde isto poderia mentir em silêncio:** o catálogo
(`apps/site/src/data/handbooks.ts`) é a promessa da capa, e um artigo ou lab apontando
para uma fase inexistente sumiria da página sem aviso. Por isso a página **lança** em
vez de pular, e o teste do catálogo recusa fase inexistente, fase vazia e id repetido.

---

## 1. A ideia-mãe: a gramática de Factorio

Tudo se organiza em torno de uma gramática que se aprende sem tutorial, e ela é emprestada de
Factorio:

> **A cinta transporta. A máquina transforma. O fio de circuito carrega sinal, não item.**

Traduzida, dá quatro famílias e uma distinção que a spec do motor ainda não fazia.

| Família | O que faz | Fica no caminho do dado? |
|---|---|---|
| **Cano** | Transporta. **Nunca** altera a carga | Sim — é o caminho |
| **Processador de fluxo** | Age sobre o dado que o atravessa | Sim |
| **Controlador** | Observa, concede, dispara. Não recebe a carga | **Não** |
| **Placa** | Dado anexado, consultado e não atravessado | Não |

Consequência visual direta, e também de Factorio: **duas espécies de linha.** Dado em traço
grosso; controle em tracejado fino. A pergunta "por onde o dado passa?" se responde olhando
só as linhas grossas.

### 1.1 O que Factorio dá, e o que não dá

Vale ser preciso, porque a referência foi aplicada fora do domínio dela uma vez nesta
discussão.

| Factorio dá | Factorio **não** dá |
|---|---|
| A gramática acima | Modelo de drill-down — Factorio é **plano**, uma montadora não abre |
| Currículo bottom-up: peça simples primeiro, composição depois | Hierarquia de abstração |
| Backpressure aprendido sem uma linha de texto | Fidelidade a sistema real |
| A ideia de receita e conservação de matéria | — |

Para drill-down, as referências certas são **Logisim** (subcircuito que abre) e **Ptolemy II**
(composição hierárquica de atores, com regime de execução declarado por nível).

---

## 2. As sete ideias que sobreviveram

Cada uma com o problema que resolve, porque ideia sem problema é enfeite.

### 2.1 O invariante cano-transforma-bloco

**A forma da carga muda exclusivamente na saída de um `transform`.** Resolve: onde a
transformação acontece deixa de ser convenção e passa a ser garantia, porque vira property
test — para toda aresta, o kind da carga é igual nas duas pontas, exceto saindo de um
`transform`.

### 2.2 A família controlador

Árbitro, relógio e supervisor **não ficam no caminho do dado**. Resolve: sem essa família,
seria preciso inventar fluxo onde não existe — o mesmo erro que a placa (`static`) foi criada
para evitar.

### 2.3 Recurso como porta

Um `arbiter` que é folha recebe pedidos e devolve concessões. Resolve **três lacunas com uma
peça**: recurso finito, atribuição dinâmica, e — porque negar concessão é frear quem pede —
**backpressure**. Conceder memória e atribuir partição a um consumidor são a mesma forma com
política diferente.

### 2.4 Os quatro níveis são tipos de coisa, não graus de contenção

L0 e L1 abrem um **bloco**; L2 abre um **cano**; L3 abre uma **carga**. E `model.ts` já tem
exatamente essas roles: `node`, `channel`, `message`. Resolve dois problemas de uma vez: a
recursão convive com níveis nomeados, e o conflito "o `channel` pode transformar a carga?"
desaparece — com L2 sendo o canal aberto, o enquadramento HTTP/2 é um bloco **dentro** do
cano.

### 2.5 Três eixos de profundidade, não um

**Execução** é bottom-up (só folha tem comportamento). **Autoria** é top-down (declarar raso,
refinar depois). **Currículo** é bottom-up, à Factorio. Resolve: a pergunta "bottom-up ou
top-down?" era três perguntas, e por isso não tinha resposta.

E o currículo bottom-up se implementa **movendo a raiz do lab**, sem tocar no motor.

### 2.6 O teste de refinamento

Trocar uma folha aproximada por uma subárvore exige equivalência **na fronteira**, com a mesma
semente. Resolve: aprofundar deixa de ser aposta. E quando a equivalência falha, a informação
é preciosa — significa que a aproximação de cima estava mentindo.

Bônus: **ligar dois `model` um dia é este mesmo teste aplicado à raiz.** Nenhum mecanismo
novo.

### 2.7 Seguir a carga

Selecione uma carga e o foco **desce sozinho** quando ela cruza a fronteira de um bloco, e
sobe quando ela sai. É a câmera acompanhando o item — em Factorio você faz com os olhos porque
o mundo é plano; aqui o nível muda junto.

Resolve o argumento mais difícil do projeto: **isso é impossível com um visualizador dedicado
por conceito**, porque exige a mesma carga existindo em dois níveis ao mesmo tempo, derivada.

---

## 3. As réguas que decidem discussão futura

Somam-se aos cinco princípios da spec do handbook, não os substituem.

| Régua | Uso |
|---|---|
| **A ferramenta ensina; não opera** | Regra-mãe. Se a resposta é "faça de verdade", o real ganha |
| **"A decisão aparece?", não "o número está certo?"** | Fidelidade é qualitativa |
| **Só precisa ser simulado o que vai ser apresentado** | Trava de escopo do motor |
| **Arquétipo entra pagando em dois alvos** | Generalizar por evidência, não por antecipação |
| **Nível novo precisa revelar fenômeno novo** | Nível que só revela campo é prosa no inspector |
| **Se precisa de condicional no YAML, precisa de um `kind`** | Impede o formato de virar linguagem de programação |
| **Fenômeno que precisou de roteiro deve ser zero** | O dia em que um precisar, é animação e não simulação |
| **`model` que não cabe num handbook é dois `model`** | Trava contra escopo inflado |
| **Fluxo com camadas usa o motor; o resto vira lab separado** | O motor é pilar, não obrigação. Ver §9 |
| **O tema do lab nomeia o protagonista** | Não se monta uma rua para explicar uma porta. Item → melhora o motor ou lab PhET-like, nunca por omissão. §9 |

---

## 4. Vocabulário — fechado

| Termo | É | Não é |
|---|---|---|
| `kind` | Primitivo do motor, comportamento em código. Dezenove | Conteúdo |
| `modelet` | **Estrutura interna** de composição: portas, `params`, `teaches` | Unidade de reuso |
| **anexo** (The Wire) | **A unidade de reuso visível**, já na spec do handbook §5 | Vocabulário do motor |
| `model` | Uma tecnologia **como ela é operada**: `otel-collector`, não `opentelemetry` | Guarda-chuva |

`.modler` e `.modlet` estão mortos. Sufixo proposto: `<slug>.model.yaml`.

---

## 5. O que foi recusado, e por quê

Registrado para não ser redescoberto.

| Recusado | Motivo |
|---|---|
| Gerar configuração para produção | OTelBin, Coralogix (×2) e Bindplane já ocupam. E muda a régua de qualidade |
| Ler telemetria do Collector real | A ferramenta ensina, não opera. E animar item individual a partir de agregado seria mentira nova |
| Intercâmbio entre `model`s implementado | O que trava não é formato, é regime de execução |
| Canvas livre estilo Excalidraw | Permitiria modelo inválido, e a honestidade estrutural é o ativo inteiro |
| tldraw, WebContainers, CheerpX | Licença |
| `rate`, `breaker`, `lock`, `coordinator`, `scale` | Não pagam em dois alvos ainda |
| Plataforma no escopo (Docker, Linux, K8s) | Trocada por orçamento finito de recurso |

---

## 6. O diferencial, em uma frase

> **Ver o mesmo dado atravessar os quatro níveis, até o frame e o byte.**

L0 e L1 todo mundo faz. Ninguém desce ao frame HTTP/2 e ao campo do protobuf **mantendo a
identidade do dado**. A exigência não é ter quatro vistas — é serem a mesma coisa, e é isso
que exige o motor.

---

## 7. Estado das decisões

### Fechadas

Nomenclatura · a ferramenta ensina e não opera · `model` é ilha com porto · reuso não é
requisito · playground é editor de grafo com regras · segue com o motor · a gramática ·
os quatro níveis como tipos de coisa · **o motor é pilar e não é obrigatório** (§9) · **o projeto é OpenLabs, e cada handbook é um
`.model` com roadmap, artigos e labs** (o enquadramento, no topo).

### Abertas, e nesta ordem de urgência

1. **Licença.** `LICENSE` (Apache-2.0) e `LICENSE-content` (CC BY-SA). Repositório público sem
   licença é todos os direitos reservados — hoje nada disto pode ser reusado por ninguém
2. **`entrega-1` contra `main`** como branch default
3. **Recurso, backpressure e `transform` desenhados juntos.** Contenção de recurso *é*
   backpressure; separar produziria dois mecanismos concorrentes
4. **Unidade de recurso.** Se sair `MB` e `vCPU`, a ferramenta será usada para dimensionar
5. **Equivalência de fronteira** para o teste de refinamento
6. **Realimentação e conservação** — registrar como lacuna declarada, não construir
7. **Quando o motor sai para repositório próprio** — depois de dois casos, não antes

---

## 8. As três coisas baratas que faltam, e nenhuma exige o motor

1. **Predição antes da revelação.** Perguntar o que a pessoa acha que vai acontecer **antes**
   de rodar. É o achado mais replicado da pesquisa em simulação didática.

   **Virou duas peças (08/09/2026).** A `Predicao` pergunta *o que vai acontecer*; o
   `Exercicio` pergunta *o que eu escrevo aqui* — a decisão que a pessoa toma no trabalho,
   no meio do código em que ela é tomada. As duas dividem a mesma regra: **a resposta não se
   refaz**, porque o compromisso é o mecanismo. E as duas só põem a explicação no DOM
   depois da resposta, e não escondida por CSS
2. **O mal-entendido que cada lab desfaz.** "As pessoas acham que o span vai direto para o
   backend." Vira campo no `teaches`, e força escrever para quem já tem ideia errada — que é
   o caso real
3. **`docs/authoring.md` como interface pública.** O teste de "ser base para outros handbooks"
   é um handbook escrito por outra pessoa, e o que habilita isso é o guia, não o motor

---

## 9. O motor é um pilar — e não é obrigatório

*Decidido em 2026-09-08, no meio da rodada que ia migrar a landing para o motor novo.*

Duas afirmações que só valem juntas. Separadas, cada uma vira um erro que o projeto já
esteve perto de cometer.

**A primeira: o `depth-core` é pilar do projeto, e não infraestrutura.** Ele é um motor de
**grafos com profundidade** — representar fluxo de forma dinâmica, com camadas de abstração,
e descer de uma para a de baixo sem que as duas sejam desenhos diferentes da mesma coisa.
Isso, *nesta forma e com estes conceitos*, **não existe no mercado**. É por isso que ele
recebe atenção desproporcional ao tamanho: cada rodada de refino nele (o túnel, as vistas
fundas, o roteador, a gramática do Factorio) é investimento no único ativo do projeto que
ninguém mais tem. Ele nunca é "o jeito rápido de fazer o lab"; ele é o motivo de o projeto
existir.

**A segunda: nem todo assunto é um fluxo com camadas.** O motor foi construído para grafo e
profundidade, e há assunto que simplesmente não é isso. O caso que trouxe a decisão à tona
é a **escada fixa de quatro níveis na anatomia de um trace**: abrir uma CPU até o fio é uma
descida de verdade, e um trace não tem *dentro* — ele tem uma árvore espalhada por quatro
processos que só se encontram no Collector. Forçar o assunto na forma do motor produziria um
lab pior que um lab simples, e ainda mentiria sobre o assunto.

### A regra, e ela decide sozinha

> **O assunto é um fluxo com camadas de abstração e lógica?**
> **Sim** → usa o motor. Sem discussão, sem "seria mais rápido à mão": é para isto que
> pagamos as rodadas de refino.
> **Não** → **lab separado**, enxuto, exclusivo do assunto — uma experiência mais *mockada*
> mesmo, desde que **represente melhor**. Mais perto do PhET do que do Factorio.

**E o lab pequeno é mais barato que o motor** — este é o outro lado, e ele importa tanto
quanto: o motor é bom, funciona, e adentrar nele é a melhor coisa que o projeto tem, mas isso
é razão para usá-lo onde ele ganha, e não para forçá-lo onde o assunto não é fluxo. Um lab
especializado, isolado e **bem feito** ensina mais que uma rua construída para explicar uma
porta, e custa menos.

O critério de qualidade **não cai** no segundo caso: pequeno e dedicado não é rascunho. Um
lab PhET-like continua devendo o mesmo que qualquer outro — uma pergunta concreta, resposta
derivada do estado e não de texto, o mal-entendido que ele desfaz, contraparte real quando
ele afirma algo sobre o mundo, e teste que cai quando o lab para de ensinar o que promete.
O que ele **não** deve é profundidade: sem árvore de composição, sem palco, sem `kinds`.

### O corte real: a fábrica ou o item?

*Afiado por ele em 2026-09-08, logo depois:* **"mesmo que se encaixe na nossa lógica de
fluxos, o foco é o item e não a fábrica — o nosso sistema de grafos funciona muito bem
quando o foco é a fábrica, mas no span o foco é o item; ou melhoramos o foco pro item, ou
criamos um lab mais PhET."**

"Fluxo com camadas" era a pergunta certa e não era a pergunta suficiente. Um trace **é** um
fluxo com camadas, e mesmo assim o motor não o serve bem — porque o motor é centrado na
**fábrica**. O protagonista dele é o grafo: as máquinas, as esteiras, o que tem dentro de
cada caixa. O item é carga que atravessa; desde "seguir a carga" dá para clicar nele e ler o
corpo, mas ele continua sendo um ponto pequeno numa esteira, com o painel de lado.

Num span, o protagonista é o item: importa **aquela coisa**, o que ela virou em cada parada,
e onde ela terminou. A fábrica é cenário. Aplicar o motor sem enxergar isso produz um lab
que desenha a tubulação com capricho e trata de raspão o assunto.

**O tema do lab é quem nomeia o protagonista — e não a gente.** A formulação dele, e ela
resolve o caso sozinha:

> *"É que nem estarmos fazendo um lab sobre motorista e focar nas ruas, e um lab de ruas e
> focar no motorista. E num de porta de carros, não vamos montar uma rua para explicar."*

O protagonista não é escolha de desenho: ele já está dito no assunto, e a única maneira de
errar é não perguntar. Lab de oleoduto → a fábrica protagoniza. Lab de span → o item
protagoniza. Lab de porta de carro → **nem um nem outro**, e montar a rua em volta para
explicar a porta é gastar caro para ensinar pior.

E ela é assumidamente subjetiva. Isso não a enfraquece: a alternativa é a omissão, que decide
igual e decide sempre a favor do motor, porque o motor está pronto.

**Então a régua tem duas perguntas, nesta ordem:**

1. **É um fluxo com camadas de abstração e lógica?** Não → lab separado, PhET-like.
2. **Quem é o protagonista, a fábrica ou o item?** Fábrica → motor, é o caso para o qual ele
   foi feito. **Item → decisão explícita entre duas saídas, e nunca por omissão:** ou a
   rodada **melhora o foco no item no motor** — e aí é investimento no pilar, com dono e
   escopo —, ou o lab é **separado e PhET-like**. O que não pode acontecer é usar o motor
   como está e deixar o item de coadjuvante num assunto que é sobre ele.

### O que isto revoga, e o que não

Não revoga nada da §3: "só precisa ser simulado o que vai ser apresentado" e "`model` que
não cabe num handbook é dois `model`" continuam valendo, e esta regra é irmã das duas.
Revoga uma expectativa que nunca foi escrita mas estava no ar — a de que **todo** lab de
todo handbook nasceria do `.model`. Não nasce. O handbook é a casa; o motor é o inquilino
principal, não o único.

**Onde isto poderia mentir em silêncio:** um lab PhET-like desenhado à mão pode afirmar o
que nenhum modelo sustenta, que é o defeito mais caro do projeto. A trava é a mesma dos
outros: **contraparte real**. Se o lab diz algo sobre o mundo, o repositório tem de ter como
conferir contra a coisa de verdade — e sem modelo por baixo, essa dívida fica *maior*, não
menor.
