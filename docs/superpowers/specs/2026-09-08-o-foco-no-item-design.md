# O foco no item — a trilha como projeção, e o herói no motor novo

**Data:** 2026-09-08
**Estado:** desenho aprovado, plano a escrever
**Decisão de projeto que a originou:** `docs/DECISIONS.md` §9 (commits `f638e06`, `7a95318`)

---

## 1. De onde isto veio

A rodada começou pequena: a landing ainda roda o andaime (`Engine`, `Scenario`, `LevelId`,
`DepthShell`, `FlowDiagram`) enquanto todos os labs dos dois handbooks rodam
`World`/`Explorer`/`Stage`, e a seção `.levels` vende quatro níveis fixos — L0 Flow · L1
Mechanism · L2 Wire · L3 Payload — que morreram na Entrega 2. A landing e os labs eram dois
produtos.

Duas correções do Luigi mudaram o tamanho dela.

**A primeira** foi sobre o vocabulário: o `depth-core` não é andaime, é **pilar**. Ele é um
motor de grafos com profundidade — fluxo dinâmico, camadas de abstração, e descer de uma
para a de baixo sendo a mesma coisa vista de outro jeito. Isso, nesta forma, não existe no
mercado, e é por isso que ele recebe atenção desproporcional ao tamanho. O que não serve à
anatomia de um trace é a **escada fixa de quatro níveis**, não o motor.

**A segunda** foi o corte que faltava, e é a razão desta spec existir:

> *"Mesmo que se encaixe na nossa lógica de fluxos, o foco é o item e não a fábrica. O nosso
> sistema de grafos funciona muito bem quando o foco é a fábrica, mas no span o foco é o
> item. Ou melhoramos o foco pro item, ou criamos um lab mais PhET."*

Um trace **é** um fluxo com camadas, e mesmo assim o motor o serve mal — porque o
protagonista dele é a **fábrica**: o grafo, as máquinas, o que tem dentro de cada caixa. O
item é carga que atravessa. Desde a Entrega 14 dá para clicar nele e ler o corpo, mas ele
continua sendo um ponto de sete unidades de raio numa esteira, com o trajeto virando lista de
texto num painel lateral.

Num span, o protagonista é o item. Importa **aquela coisa**, o que ela virou em cada parada, e
onde terminou. A fábrica é cenário.

**E quem nomeia o protagonista é o tema do lab**, não o desenhista:

> *"É que nem estarmos fazendo um lab sobre motorista e focar nas ruas, e um lab de ruas e
> focar no motorista. E num de porta de carros, não vamos montar uma rua para explicar."*

O protagonista já está dito no assunto; a única maneira de errar é não perguntar. É também o
lembrete de que **o lab pequeno é mais barato que o motor**: quando o assunto for a porta, um
lab especializado e bem feito ensina mais — e custa menos — que a rua inteira construída em
volta dela. Esta rodada é o caso oposto, e por isso ela paga o motor: um span atravessando
uma pipeline é a rua **e** o motorista, e o que falta é o motorista ter cara.

**A escolha desta rodada, feita explicitamente e não por omissão:** melhorar o foco no item
**no motor**. Investimento no pilar, com dono e escopo. O herói da landing é a vitrine dela.

---

## 2. A tese

> **A vista do item não é outro desenho. É outra projeção do mesmo estado rodando.**

Esta frase é a régua da rodada inteira, e ela vem da primitiva central do projeto:
profundidade nunca foi modal, sempre foi projeção. A vista de fábrica e a vista de item têm
de ser o mesmo dado visto de dois lugares, pelo mesmo motivo que L0 e L3 tinham de ser — se
uma delas for desenhada à mão, ela pode afirmar o que o modelo não disse, que é o defeito
mais caro do projeto.

O maquinário de dados **já é item-first**, e é por isso que a rodada é viável: `seguir()`
monta o trajeto a partir de `state.flight`, e `diffStates` diz o que cada parada mudou. O que
é fábrica-first é o **desenho**. Nada nesta rodada inventa dado novo.

---

## 3. A Trilha

A projeção escolhida, contra a "lente" (dar zoom no item mantendo o layout da fábrica) e
contra "duas vistas com chave". A lente deixa o item refém do layout — num leque ele fica
espremido onde a fábrica o pôs —, e a chave esconde a vista nova atrás de um botão que
ninguém aperta num herói de quinze segundos.

```
  span 7a3f  ─ following ────────────────

   ●━━━━━━━━━━━━●━━━━━━━━━━━━●
  service     collector    backend
              +resource
              +collector.name

  ┌ body, as it left collector ──────┐
  │ traceId      7a3f9c...           │
  │ name         GET /checkout       │
  │ resource                         │
  │   service.name   checkout      ▸ │
  │   collector.name otelcol       ▸ │
  └──────────────────────────────────┘
```

**O trajeto vira a espinha da tela.** As estações são **uma a mais que as paradas** — uma
parada é um salto, e N saltos tocam N+1 lugares —, o nome de cada uma é a peça da fábrica
reduzida a rótulo, e **o que mudou aparece entre as estações**, no salto em que mudou — não
numa coluna, não numa legenda.

O rótulo do salto mora na estação de **chegada**, e a razão é o leque: no lab dos três
pilares, três saltos saem do mesmo lugar com deltas diferentes, e do lado da partida os três
disputariam uma linha só. Na chegada, cada braço carrega o seu — e os braços penduram na
mesma origem em vez de entrarem em fila, que afirmaria que a carga passou por um depois pelo
outro quando o assunto do lab é que os três viram a mesma coisa. O corpo fica embaixo, com o campo alterado marcado
no lugar em que ele mora, pelo mesmo `Inspector` que já serve o painel e o herói.

### De onde cada traço sai (a régua da gramática visual)

Toda figura tem de sair de um fato que o modelo já tem. Aqui:

| Traço na tela | Fato no modelo |
|---|---|
| uma estação | uma `Parada` — o par (`de`, `para`) do salto |
| a ordem das estações | a ordem em que as paradas foram vistas, por `tick` |
| o rótulo `+campo`, na estação de **chegada** do salto | `Parada.mudou`, que é `diffStates` contra a chegada no nó anterior |
| um braço pendurado, e não uma estação em fila | duas paradas com o mesmo `de` — um leque |
| `first sighting` na primeira chegada | trajeto sem chegada anterior — a ausência é dita, não omitida |
| o campo marcado no corpo | `changedPaths` da última parada |
| a estação em que o item está agora | a última `Parada`, e ela é a única com `data-atual` |

Nada de `+campo` inventado, nada de estação que o item não visitou, e **nenhum roteiro**: se
o modelo parar de enriquecer, a trilha para de dizer que enriqueceu.

### O que a Trilha não faz

Não desenha a árvore de spans (um trace tem irmãos; a trilha tem uma linha só), não substitui
o palco, e não abre peça. Ela é a projeção do **um item**; abrir a fábrica continua sendo o
palco, e as duas convivem na mesma tela.

---

## 4. Fronteiras — onde cada peça mora

O ponto de "primeira classe" é este: seguir um item deixa de ser código do site e passa a ser
capacidade do motor.

| Camada | O que passa a morar lá | Por quê |
|---|---|---|
| `depth-core` | `seguir()`, `Parada`, `LeitorDaCarga` — hoje em `apps/site/src/lib/seguir.ts` | É lógica pura sobre `WorldState`/`Message`, sem React e sem domínio. Identidade e trajeto de um item são conceito do motor, não do site |
| `depth-ui` | `Trilha` — o componente novo | Desenho. Recebe `Parada[]` e nada mais sobre o mundo |
| `otel-domain` | `heroi/` — o mundo do herói, e o leitor da carga dele | Domínio. Quem sabe o que é um span |
| `apps/site` | `HeroSim` reescrito; `PainelDaCarga` encolhe para o que sobrar | Composição |

`PainelDaCarga` não morre: ele continua sendo o painel lateral dos labs que querem o item
como coadjuvante. O que sai de dentro dele é a lista do trajeto, que vira `Trilha`. Uma fonte
por fato — a lista de paradas passa a ter um desenho só, usado pelos dois.

`Engine`, `Scenario` e `LevelId` **ficam** em `depth-core`, por decisão dele, sem consumidor
depois desta rodada. O que muda é o comentário do índice: hoje ele diz *"andaime até a S5
migrar a landing"*, e depois desta rodada isso vira mentira — passa a dizer o que a coisa é e
qual decisão a mantém viva.

---

## 5. O herói

Um mundo próprio em `otel-domain/src/heroi/`, com a mesma anatomia dos outros
(`world` · `estado` · `carga` · `labels` · `views`) e o menor dos três: **`service →
collector → backend`**. Spans nascem no serviço, andam na esteira, param no collector — que
anexa `collector.name` ao recurso —, e seguem para o backend.

**A história não é lab de ninguém, de propósito.** `providers` mora *dentro do processo*;
`anatomy-of-a-trace` mora *entre quatro processos*; o herói é o oleoduto visto de fora, com um
span seguido de ponta a ponta. É o trailer, e cada uma das três caixas tem um lab esperando
atrás dela.

**Sem nenhum controle na tela.** Sem checkbox de propagação, sem timeline, sem slider:
controle é assunto de lab, e o herói que pede configuração já pediu demais de quem chegou
agora. Três gestos:

1. a carga anda sozinha — autoplay, respeitando `prefers-reduced-motion`;
2. **clicar em outro item** troca quem está sendo seguido — a trilha já está aberta desde o
   primeiro quadro (ver abaixo), e o clique é para escolher outro. É a ideia nº 7 do
   `DECISIONS.md` no lugar de onde ela veio;
3. **duplo clique numa caixa** desce para dentro dela — a profundidade deixa de ser prometida
   em parágrafo e vira gesto na primeira dobra da página.

O herói **abre já seguindo um item**. Uma vitrine que exige um clique para mostrar o que ela
tem de diferente mostra, para a maioria das visitas, nada.

Morrem: `apps/site/src/labs/hero/scenario.ts` e o uso do andaime no `HeroSim`.

---

## 6. A landing em volta

**A seção `.levels` sai.** No lugar entra o que o motor faz e por que ele existe — sem escada
única e sem numeração inventada: abrir uma peça e ver as peças de dentro; abrir a mensagem e
ver o corpo; **seguir uma coisa e ver o que cada parada mudou nela**. Isso vale para uma CPU e
vale para um trace, que é exatamente o que a escada fixa não conseguia.

E a seção diz a segunda metade do pilar, que hoje não está em lugar nenhum do site: quando um
assunto **não** é um fluxo com camadas, ou quando o protagonista é o item e não a fábrica, o
lab é outro, feito sob medida. Isso vende o ativo e já explica por que nem todo lab se parece
com o herói — em vez de deixar a incoerência para o leitor descobrir sozinho na terceira
página.

Dois textos do herói também mentem hoje e são reescritos: *"turn off context propagation and
the picture breaks"* (não haverá botão) e *"the bytes on the wire, or the wire that is either
high or low"* (herda a escada morta).

---

## 7. O que os labs herdam

`three-pillars` e `anatomy-of-a-trace` já passam `chaveDaCarga`/`painelDaCarga` ao `Explorer`,
então a Trilha entra neles **sem código de domínio novo** — a lista de texto do painel vira o
desenho. Nos pilares, o leque de três braços é o teste mais duro da forma: as três estações
saem da mesma chegada, e é ali que se vê se "o diff é contra a chegada" continua legível
quando vira figura.

Não entra nos labs da CPU nesta rodada: lá o protagonista é a fábrica, e está certo assim.

---

## 8. Critério de pronto

Testes que cobram o que pode quebrar em silêncio, e não a existência das peças:

**Da Trilha (unit, em `depth-ui`):**

1. uma estação por parada, na ordem dos ticks — não a ordem em que chegaram ao array;
2. o rótulo do que mudou aparece **entre** as duas estações do salto em que mudou;
3. parada sem chegada anterior diz `first sighting`; parada sem mudança diz `unchanged`. A
   ausência é dita;
4. só a última estação tem `data-atual`.

**Do herói (e2e, em `landing.spec.ts` — os quatro de hoje viram estes):**

1. a ilha hidrata e a carga **anda** (dois quadros diferentes, com espera de verdade — a
   lição da Entrega 14: rolar até a ilha `client:visible`, e não esperar texto que o servidor
   já mandou);
2. o herói abre **já seguindo**, e a trilha tem as três estações com o diff certo — se o
   collector parar de enriquecer, o teste cai;
3. duplo clique numa caixa **desce**, e a vista de dentro não é a de fora;
4. varredura: `L0`/`L1`/`L2`/`L3`/`FlowDiagram`/`DepthShell` não aparecem em `apps/site/src`.
   A mentira não volta por descuido.

**Do de sempre:** teto de espaguete do mundo novo **medido**, não estimado; contraste nos dois
papéis; e `unit`, `typecheck`, `boundaries`, catálogo e `build` verdes.

---

## 9. O que não entra

- **Remover `Engine`/`Scenario`/`LevelId`** do `depth-core`. Decisão dele: o código morto
  fica, com dono numa rodada futura.
- **A árvore de spans na Trilha.** Um trace tem irmãos, e desenhá-los é outra projeção — e
  provavelmente o primeiro candidato a lab PhET-like, pela §9.
- **Qualquer controle no herói**, e qualquer mexida nos labs da CPU.
- **A espinha da apostila v1** (`manual-spans`, `head-vs-tail-sampling`). Continua esperando,
  e é a próxima rodada.
