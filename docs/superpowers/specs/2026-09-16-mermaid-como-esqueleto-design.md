# Mermaid como esqueleto do motor — Design

**Data:** 2026-09-16
**Status:** proposta. Nada implementado.
**Depende de:** `kinds.md`, `model-format.md`, `2026-08-28-motor-composicional-design.md`
**Inspiração:** [Delineax](https://delineax.nochaos.io/) — editor de Mermaid puro, com
histórico por versão, exploração parcial de subgrafos e publicação. É "só um bom motor
de Mermaid"; o que queremos aqui é herdar essa **linguagem** e essa **experiência de
edição**, e usá-la como entrada canônica do nosso motor de simulação.

---

## 0. A decisão

**2026-09-16, Luigi:** Mermaid é a nova fonte de esqueleto de cenário. O foco
dele é **criar estrutura e relações** — nós, canais, subgrafos, portas. O motor
adiciona por cima o desenho, as animações e a lógica: o que o `.modelet.yaml`
representava vira parte do runtime, não da linguagem. `.modelet.yaml` fica
reservado a `.model` (o aplicativo agregado); nenhum cenário novo é escrito
nele a partir daqui.

Embarcar tudo no Mermaid — parâmetros, `teaches`, `not_modeled` — é meta, não
requisito. Enquanto a gramática do Mermaid não expressar isso sem ficar
grotesca, o front-matter YAML no cabeçalho do `.mmd` carrega o que sobra.

---

## 1. A tese

Hoje um lab é escrito em três lugares: a topologia (um `WorldSpec` em TS), o layout
(uma `View` em TS) e o texto. Escrever um lab novo pede saber TS de um jeito
específico, e ler um lab pronto pede rastrear três arquivos para descobrir onde entra
o que sai.

A proposta é uma **quarta representação**, que passa a ser a canônica: um bloco de
Mermaid. Ele é ao mesmo tempo:

- **Esqueleto do mundo.** Nós, canais, portas, famílias — o que hoje mora no
  `WorldSpec` e em parte no `.modelet.yaml`.
- **Hint de layout.** A ordem e o agrupamento do Mermaid definem o desenho inicial,
  suficiente para o motor renderizar sem `View` escrita à mão.
- **Documentação.** O mesmo bloco renderiza em qualquer visualizador de Markdown que
  aceite Mermaid; a página do lab consegue mostrar o esqueleto mesmo se o motor não
  carregar.
- **Entrada do editor.** O editor de labs (a coisa nova) é um editor de Mermaid, e a
  simulação viva é uma **camada por cima** — animações, medidores, controles — do que
  o Mermaid descreve.

**A regra:** o motor não sabe animar nada que o Mermaid não tenha declarado. Se um
lab quer mostrar um contador em cima de um nó, o nó precisa existir no Mermaid. Isso
mata a classe de bug em que a `View` mostra algo que o `WorldSpec` não tem.

**O que Mermaid não é:** a fonte de comportamento. Comportamento continua em `step`
funções puras (§3 mais adiante). Mermaid é **o esqueleto**; o motor é a carne.

---

## 2. Por que Mermaid (e não YAML puro, e não uma DSL nova)

Três razões, e só a última é técnica.

1. **Já se lê sem tutorial.** Todo mundo que trabalha com docs viu Mermaid no
   GitHub, no Notion, no Obsidian. Um lab escrito nele é lido antes de ser
   explicado.
2. **Ecossistema pronto.** O parser existe (`@mermaid-js/parser`, `mermaid` no
   navegador), a renderização também, e editores como o Delineax mostram que a
   experiência de edição pode ser boa sem gastar seis meses construindo IDE.
3. **A sintaxe já tem o que a gente precisa.** Nós com forma, arestas com rótulo,
   direção do grafo, subgrafos aninhados (que viram `composite`), e atributos por
   classe (`classDef`) — que é onde a nossa família e o nosso `kind` entram sem
   inventar sintaxe nova.

O que Mermaid **não** cobre e a gente vai precisar sobrepor:

- Portas nomeadas em um nó. Em Mermaid, um nó tem um único ponto de conexão. O
  contorno da §4 é usar **arestas rotuladas** e um convite de nomenclatura
  (`in:req`, `out:span`) que o parser do motor extrai.
- Parâmetros do mundo (uma taxa, um limite). Vão em um bloco Front-matter no início,
  ao lado do Mermaid, e não dentro dele.
- Comportamento. Vive em TS, referenciado por `kind` (já existe) — nada muda aí.

Uma DSL nova ganharia expressividade e perderia o resto. Uma vez que a mão dos
autores treina no Mermaid, uma DSL específica não paga o custo.

---

## 3. O que o esqueleto contém, e o que fica fora

**Contém:**

- Nós, com `kind` (do catálogo de §`kinds.md`) e nome legível.
- Canais entre nós, com rótulo (o `kind` de mensagem, no vocabulário do domínio) e
  linha (`data` ou `control`, distinguidas visualmente).
- Subgrafos, que compilam para `composite` ou `pipeline` conforme o próprio
  Mermaid já distingue (retângulo com título contra um `subgraph`).
- Portas, expressas como **rótulos convencionados** nas arestas: `in:req`,
  `out:span`, `control:tick`.
- Uma seção de parâmetros no Front-matter (YAML), lida pelo motor como
  `WorldSpec.params`.

**Fica fora, e é de propósito:**

- **Comportamento.** Como cada `kind` reage a um tick é código TS, importado por
  `kind`. Se um lab quer um `kind` novo, ele contribui um behavior novo — e o
  parser recusa o desenho até o behavior existir.
- **Estado inicial.** Também código. O Mermaid diz "aqui tem um buffer"; o estado
  inicial do buffer é decisão do behavior.
- **Layout preciso pixel-a-pixel.** O motor calcula posições a partir da topologia
  do Mermaid e do algoritmo do Mermaid renderer (dagre). Overrides finos ficam num
  arquivo `<slug>.view.ts` opcional, que ninguém precisa escrever até querer.

---

## 4. A sintaxe, em detalhe

### 4.1 Front-matter

```
---
id: otel-anatomy
title: One request, four processes, four exports
seed: 1
params:
  requisicoes-por-tick: 1
  derrubar-cabecalho-em: 0
  taxa-de-amostragem: 1
levels: [flow]
---
```

Igual ao Front-matter que Mermaid já aceita para configurar tema, e igual ao que
Astro já lê. Um lab que roda no motor precisa de `id`, `title` e pelo menos um nível.

### 4.2 O grafo

```mermaid
flowchart LR
  edge((edge)):::source
  subgraph anatomia[Serviços]
    direction LR
    gateway[gateway]:::processor
    checkout[checkout]:::processor
    payments[payments]:::processor
    ledger[ledger]:::processor
  end
  backend[backend]:::sink

  edge   -- "req"  --> gateway
  gateway -- "req" --> checkout
  checkout -- "req" --> payments
  payments -- "req" --> ledger

  gateway  -. "span" .-> backend
  checkout -. "span" .-> backend
  payments -. "span" .-> backend
  ledger   -. "span" .-> backend

  classDef source     family:processor,kind:source
  classDef processor  family:processor,kind:processor
  classDef sink       family:processor,kind:sink
  classDef controller family:controller,kind:sequencer
```

Regras de tradução para o motor:

| Mermaid | Motor |
|---|---|
| Um `id[Rótulo]` | Um nó do `WorldSpec` com `id` e `label` |
| `classDef X kind:Y,family:Z` + `id:::X` | O `kind`/`family` do nó |
| `A -- "k" --> B` | Canal de **dado** com mensagem de `kind` `k` |
| `A -. "k" .-> B` | Canal de **dado** também: o traço é ênfase visual |
| `A -- "control:k" --> B` | Canal de **controle** — quem decide é o prefixo do rótulo |
| `subgraph g[Nome] ... end` | Um nó `composite` `g` com os filhos declarados dentro |
| Direção `LR`/`TB` | `layout.direction` — dagre resolve o resto |

**Sólido contra pontilhado não decide dado contra controle.** Esta tabela dizia o
contrário até 13/10/2026, e dizia a opção que foi **rejeitada**: a `Nota 1` do
exemplo em `2026-09-16-mermaid-anatomy-example.md` põe as duas saídas lado a lado
e recomenda a segunda, que é a que o parser implementa — traço é **ênfase visual**
(é o fluxo primário ou é a lateral?), e `data`/`control` vem do **prefixo do
rótulo**. A §4.3 aqui embaixo já usava `control:tick`, então a tabela também
contradizia a seção seguinte.

Quem depende disso é a `anatomia`: o span **é dado** — o backend o recebe no
`inbox`, não em `ctx.signals` — e ainda assim sai por linha pontilhada, para
dizer "sai pelo lado, não pela cadeia". Pela regra antiga ela teria de escolher
entre o desenho certo e o fio certo. O `stroke` é parseado e guardado no
`SkeletonEdge`; o compilador não o lê, e um renderizador que queira a ênfase
encontra o dado ali.

A regra está fixada em teste (`parse.test.ts`, "distingue linha de dado e de
controle pela semântica do rótulo, não pelo traço"), e não só nesta prosa.

A restrição da §3 aparece aqui: se um `classDef` referencia um `kind` que o motor
não conhece, o parser recusa, com a mesma mensagem que hoje `compileModelet` usa
("`clock` chega na onda W2"). O `.modelet.yaml` e o Mermaid convergem para o mesmo
compilador — o Mermaid é uma **fachada de sintaxe** para o mesmo modelo de dados.

### 4.3 Portas nomeadas

Um nó de vários `in`/`out` (típico do `router`) declara portas nos rótulos das
arestas:

```
router -- "req:pago"      --> aprovado
router -- "req:recusado"  --> negado
router -- "control:tick"  --. clock
```

O motor lê o prefixo antes de `:` como nome de porta. Sem prefixo, é a porta
padrão (`in` na entrada, `out` na saída). Isso é convenção, não sintaxe nova de
Mermaid — o rótulo continua sendo o rótulo que o Mermaid renderiza.

### 4.4 O que **não** entra no Mermaid

- `initialState`, `step`, `paramsSchema` — código TS, ao lado do arquivo.
- Cenários derivados (variações que só mudam `params`) — YAML, listando o
  esqueleto por referência.
- Layout manual — arquivo separado, opcional.

---

## 5. O editor: onde o Delineax entra

O motor de Mermaid do Delineax faz três coisas que a gente também quer, e não
precisamos reimplementar do zero:

1. **Live render.** Escreve à esquerda, vê à direita. É o loop natural do autor,
   e é o que um lab visualmente denso precisa para não ser escrito às cegas.
2. **Partial mode.** Um `subgraph` colapsa em uma chip; expandir mostra só a
   fatia. Em labs com trinta objetos isso é a diferença entre navegar e travar.
3. **Histórico por versão.** Cada save é uma versão. Comparação lado a lado. É a
   coisa que substitui "vou salvar isso num scratch pad".

Onde diferimos do Delineax:

- **A pré-visualização não é só o Mermaid renderizado.** É o **motor rodando**
  sobre o esqueleto que o Mermaid descreve. O autor edita a topologia à esquerda
  e vê os pacotes andarem, os medidores contarem, o backpressure subir à direita.
  Essa é a razão de existir do editor — Mermaid é meio, não fim.
- **Partial mode reflete `composite`.** Não é uma feature do editor, é a mesma
  operação de "abrir" que o `depth-core` já entende (§ da spec do motor).
  Colapsar/expandir no editor é o mesmo colapsar/expandir do leitor.
- **Publicar é abrir PR.** Não há storage próprio; a "versão publicada" é o
  arquivo `<slug>.mmd` (ou `<slug>.lab.md` com o Mermaid embutido) commitado no
  repositório.

O editor é um pacote novo, provavelmente `apps/editor`, e ele **não** precisa
estar pronto para o formato ser útil. O formato sozinho já melhora a autoria (é
possível escrever um lab novo em Mermaid + `step.ts`, sem `View` nem `WorldSpec`
escritos à mão), e o editor entra numa fase futura como conveniência.

---

## 6. O caminho

Não implementar antes de aprovar a sintaxe da §4. As fases, quando começarem:

1. **Parser Mermaid → `WorldSpec`.** Um pacote novo, `@ovh/mermaid-skeleton`, que
   consome `flowchart` do Mermaid e devolve o mesmo tipo que `compileModelet`
   devolve. Isso é o mínimo — a partir dele, qualquer lab existente pode ser
   reescrito.
2. **Reescrever a `anatomia` como validação.** Substituir `world.ts` +
   `views.ts` do lab por um `anatomia.mmd`, mantendo o comportamento. Se o teste
   `views.test.ts` continua verde e o Storybook do lab não muda, o formato
   passou no primeiro teste real.
3. **Renderizador em cima do Mermaid renderer.** Em vez de reinventar o
   posicionamento, deixar o Mermaid calcular a caixa de cada nó e a curva de
   cada aresta, e sobrepor as animações do motor em SVG. Isso substitui o
   `FlowDiagram.tsx` para labs que optaram pelo esqueleto Mermaid; os que ainda
   têm `View` manual continuam funcionando.
4. **Editor.** Só depois. Live render, partial mode, histórico.

---

## 7. Riscos, e onde a proposta pode desabar

- **Mermaid não expressa portas.** Contornado por convenção de rótulo, mas a
  convenção pode ficar frágil quando um `router` tiver oito saídas nomeadas. Um
  lab de CPU pode forçar isso; se forçar, a saída é permitir um bloco YAML
  paralelo declarando portas por id do nó.
- **Layout de dagre é bom, mas não é bonito.** Alguns labs precisam de
  disposição autoral (a fileira de quatro serviços com a árvore descendo). Já
  está resolvido em §3: um `.view.ts` opcional sobrepõe posições.
- **Duas fontes de verdade.** Existir `.modelet.yaml` **e** `.mmd` para o mesmo
  mundo é o pesadelo que este documento cria se a gente permitir os dois no
  mesmo lab. **Decidido em 2026-09-16 (Luigi):** Mermaid substitui
  `.modelet.yaml` para o **cenário**. O foco do Mermaid é a estrutura e as
  relações; o motor põe por cima o desenho, a animação e a lógica — que é o
  que o modelet representava. Se em algum momento a gramática do Mermaid puder
  embarcar o que hoje sobra em TS (parâmetros, `teaches`, `not_modeled`) numa
  linguagem só, tanto melhor; enquanto não puder, o front-matter YAML no
  cabeçalho do `.mmd` carrega essa parte. `.modelet.yaml` some quando o parser
  de Mermaid cobre os mesmos casos que o compilador de modelet cobre hoje
  (`source`, `buffer`, `sink`); daí em diante, cenário novo é `.mmd`, e YAML
  fica reservado para o agregado `.model` da §4 do `model-format.md` (o
  aplicativo, não o cenário).

  **13/10/2026: esse critério foi atingido e passado.** O compilador de Mermaid
  monta `source`, `buffer`, `sink` e também `static`, que o de modelet recusa.
  A placa entrou sem sintaxe nova porque não precisava de nenhuma: o
  `ObjectSpec` de uma é `{ id, kind, label, leaf }` e nada mais — sem `init` e
  sem `behavior`, porque `indexTree` recusa placa que aja —, e o desenho já traz
  os três campos que sobram. A recusa antiga dizia "o formato ainda não declara
  o conteúdo dela", e isso vale para conteúdo **rico**; esse conteúdo nunca
  chegou ao motor nem pelo caminho do TS, onde `placa()` passa o título como
  `label` e para aí.

  O que falta — `router`, `switch`, `store`, `sequencer` — **não** é do mesmo
  tipo. Neles o que falta é **política** (de rota, de retenção), e isso é
  decisão de linguagem: a §6 manda aprovar a sintaxe antes de implementar, e
  esta nota não a aprova. Até lá eles existem num cenário por `overrides`, que é
  como a `anatomia` tem `router` e `store`.
- **O motor precisa ler dagre.** Adiciona dependência a um pacote que hoje é
  quase sem deps. Aceito, porque a alternativa é reimplementar posicionamento.

---

## 7.1 Limites do formato achados ao escrever o segundo lab

*16/10/2026, construindo `collector-pipeline`, o primeiro lab a nascer em `.mmd`.*

Dois, e os dois são de fato limites — não lacunas de implementação a fechar com mais código.

**1. O `.mmd` não expressa descarte.** No motor, `to: DROP` é "a ausência de destino dita em
voz alta", e o lab dos provedores usa isso. O parser não tem como escrever `@drop`: o id de
nó dele é `[A-Za-z_][A-Za-z0-9_-]*`, e `@` não casa. Não há suporte a `DROP` em lugar nenhum
do `mermaid-skeleton`.

Contornado no `collector-pipeline` por um **nó contador explícito** (`descartes`), e o
contorno acabou melhor que o original: o Collector de verdade expõe
`otelcol_processor_refused_spans` — a perda dele é um contador, não um vazio. Uma caixa com
número ensina melhor que um terminal de descarte, e a caixa recebe das duas pipelines, que é
o que o Collector faz.

Então a decisão é **não** acrescentar `DROP` ao formato por enquanto: o caso que o pediria é
um em que o descarte não deva ser contado, e nenhum lab tem esse caso. Se aparecer, a sintaxe
natural é um id reservado (`drop` como nó implícito), e não um caractere novo.

**2. O `.mmd` declara topologia, então parâmetro não reordena processador.** A tese mais
óbvia do Collector — `processors:` é lista ordenada, e `memory_limiter` antes de `batch` não
é estilo — **não cabe num lab de um mmd**, porque trocar a ordem é trocar o desenho. O lab
ficou com a outra tese (um receiver, duas pipelines, uma cópia para cada), e a da ordem ficou
registrada na tabela de mal-entendidos sem ser simulada.

A saída, quando alguém quiser simulá-la, é **dois `.mmd`** e um parâmetro que escolhe qual
esqueleto compila. Isso é novo e não está aprovado: dobra o desenho e a vista, e a §3 do
`DECISIONS.md` ("só precisa ser simulado o que vai ser apresentado") é o lugar de decidir se
paga.

---

## 8. O exemplo, para leitura

Em `docs/superpowers/specs/2026-09-16-mermaid-anatomy-example.md` está a
`anatomia` reescrita neste formato, junto com o Mermaid renderizado. Ele é a
prova de que a §4 aguenta o lab mais desenhado que temos hoje.
