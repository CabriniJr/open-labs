# O palco animado (`@ovh/motion`)

**Status:** alpha. Um lab usa (`labs/hard-context-and-baggage`).
**Data:** 2026-11-03
**Depende de:** `DECISIONS.md` §9 e §11

O terceiro motor do projeto, ao lado do de fluxos (`depth-core` + `depth-ui`) e do
de estado (`interactive-core`). Ele serve ao assunto que **é uma coreografia**: atores,
mensagens que viajam entre eles, uma ordem no tempo e uma câmera que leva o olho ao lugar
em que a coisa está acontecendo. Protocolos, handshakes, propagação, filas, sequências de
reconciliação.

O motor não sabe qual é o assunto. Ele está em `pnpm boundaries` como os outros dois.

## As quatro camadas

| Camada | Arquivo | O que faz |
|---|---|---|
| Geometria | `geometry.ts` | Caminhos (`line`, `arc`, `elbow`, `loop`, `through`), parametrizados por **comprimento de arco**: uma ficha anda na mesma velocidade na reta e na curva |
| Tempo | `timeline.ts`, `ease.ts` | Quadros-chave por peça e propriedade. Amostrar é função pura do instante — voltar e pular dão o mesmo quadro |
| Coreografia | `choreography.ts` | As ferramentas de autoria: declarar peças e contar, capítulo a capítulo, o que acontece com elas. Produz um `Film`, que é dado |
| Desenho | `react/` | `MotionStage` (um quadro em SVG, sem estado) e `MotionPlayer` (transporte, capítulos, narração e painel de detalhe) |

## O vocabulário do palco

São formas, não assuntos. `node` (caixa, pílula, círculo, losango, cilindro), `lane`
(linha de vida com cabeça que pode acompanhar a câmera), `link` (ligação que se desenha),
`token` (ficha que percorre um caminho, com rastro e etiqueta), `bar` (barra que cresce),
`note`, `region` e `custom` — a saída de emergência, em que o domínio desenha o que quiser
e ainda anda no tempo do palco.

Toda peça tem as mesmas propriedades animáveis: `opacity`, `dx`, `dy`, `scale`, `glow`,
`ping`, `progress`, `dim`, e as que trocam sem interpolar: `label`, `sublabel`, `tone`.

O `tone` lê o catálogo visual **por sentido** (`processor`, `conduit`, `live`, `kind-1`…).
Nenhum arquivo do motor escreve tinta; `scripts/check-catalogo.mjs` vigia este pacote como
vigia o palco de fluxos.

## Escrever um filme

```ts
import { film, sequence } from "@ovh/motion";

const seq = sequence({ lanes: ["client", "server"], width: 960 });
const f = film<MeuDetalhe>({ width: 960, height: 540, maxZoom: 1.8 });

f.add({ type: "lane", id: "client", head: seq.head("client"), bottom: 500, label: "client", sticky: true });
f.add({ type: "lane", id: "server", head: seq.head("server"), bottom: 500, label: "server", sticky: true });
f.add({ type: "link", id: "syn", path: seq.message("client", "server", 0), arrow: true, label: "SYN", hidden: true });
f.add({ type: "token", id: "syn:pkt", path: seq.message("client", "server", 0), label: "seq=0", hidden: true });

f.chapter({ id: "open", title: "Opening", body: "…", detail: { … } }, (d) => {
  d.camera({ focus: ["client", "server"] });
  d.together(
    (x) => x.draw("syn", { dur: 900 }),
    (x) => x.send("syn:pkt", { dur: 900 }),
  );
  d.glow("server").ping("server");
  d.beat({ title: "A step inside the chapter", detail: { … } }).wait(1200);
});

const filme = f.build();
```

Os verbos avançam um cursor: `show`, `hide`, `draw`, `send`, `to`/`tween`, `set`, `glow`,
`ping`, `dim`, `camera`, `wait`, `beat`. Duas formas de paralelismo:

- `together(...trilhas)` — cada função é uma sequência própria, todas começam juntas, e o
  cursor vai para o fim da mais longa;
- `stagger(itens, intervalo, bloco)` — um bloco por item, defasados;
- e `{ wait: false }` em qualquer verbo, que dispara sem segurar o cursor.

`glow`, `ping` e `dim` não seguram o cursor por padrão: são ênfase, não acontecimento.

## O detalhe é do autor

`Film<D>` carrega um tipo `D` que o motor nunca abre. Cada capítulo e cada `beat` pode
trazer um; o quadro em vigor entrega o último até o `renderDetail` do player. É por ali que
um cabeçalho com os campos destacados, uma tabela ou um bloco de bytes acompanha o momento
do filme — no lab da propagação, é o `traceparent` sendo lido campo a campo e a árvore de
spans que o backend consegue montar.

## O filme é derivado, não roteirizado

A regra do projeto continua valendo: **o que está na tela vem de um modelo**. O filme não
substitui o modelo; ele é uma função dele. No lab da propagação, `propagar(opções)` decide
ids, pais e headers; `filmeDoContexto(opções)` só traduz isso em peças e verbos. Mudar uma
opção recalcula o filme, e o player continua no mesmo instante — o leitor vê a mesma cena
com a outra decisão.

O teste que garante isso não olha o desenho, olha o quadro: com o proxy descartando os
headers, a barra de pagamentos termina num tom diferente da do checkout
(`contexto/propagacao.test.ts`). Se alguém pintar à mão, o teste não sabe — mas o
modelo, sim, e é ele que o teste interroga.

## Acessibilidade e movimento

- O palco é `role="img"` com rótulo; a narração é uma região `aria-live`.
- O player é focável: espaço toca e pausa, ←/→ trocam de capítulo, Home volta ao início.
- Com `prefers-reduced-motion`, o relógio não anima: tocar salta para o fim do capítulo,
  e o filme vira uma sequência de quadros parados com a informação inteira.

## O que ainda não faz

- Não há exportação de vídeo nem de GIF.
- A câmera enquadra caixas declaradas; ela não segue uma ficha em movimento.
- O catálogo de labs (`handbook-catalog`) ainda não tem um `interaction.kind` para filme;
  o lab é publicado pelo roadmap.
- O palco não tem layout automático de grafo — para isso existe o `depth-ui`. Aqui as
  posições vêm do autor ou das ferramentas de `layout.ts` (`sequence`, `grid`, `ring`,
  `connect`).

## Vistas: o mesmo filme em outra mídia

O `MotionPlayer` aceita `views`: vistas extras que desenham **no mesmo relógio**
(mesmo `t`, mesmos capítulos, mesmo painel de detalhe). O palco plano é sempre a
primeira. O motor não depende do que uma vista desenha, e é assim que o 3D entra
sem que `@ovh/motion` saiba o que é WebGL.

### `@ovh/stage3d` — isométrico em three.js

`IsoStage` recebe um `Film` e o desenha de pé: o chão é o plano do palco (`x → x`,
`y → z`), `node`/`lane` viram blocos com altura e sombra, `link` vira linha no chão
com ponta, `token` faz um arco no ar com rastro e halo, `bar` vira trilho, `note`
e rótulos são HTML por cima (fonte e tokens do site). A câmera é ortográfica na
isometria verdadeira e segue a câmera do filme; arrastar gira, duplo clique volta.

Regras de custo, porque 3D na web trava fácil:

- desenha **sob demanda** (só quando o quadro muda ou a vista gira);
- para fora da tela (`IntersectionObserver`); DPR limitado a 2;
- nenhuma geometria nasce por quadro: o filme monta a cena uma vez;
- rótulos só são reescritos quando o texto muda;
- `dispose()` devolve tudo à GPU; o three.js é carregado por `lazy()` só quando
  o leitor escolhe a vista (≈ 510 KB num chunk próprio).

Cores vêm dos tokens do catálogo lidos no elemento (`tons.ts`) e são relidas na
troca de tema. `custom` não tem tradução para 3D e fica de fora dessa vista.

### Layout é do domínio

Diagrama de sequência deitado no chão lê mal: o tempo vira profundidade. O que
fica de pé é **topologia**. Por isso o lab de propagação gera dois filmes do
mesmo modelo — `filmeDoContexto(opções, "sequence" | "topology")` — com os mesmos
verbos e durações, e um teste cobra que capítulos e passos batam ao milissegundo.
O leitor troca entre *Sequence*, *Topology* e *Iso* no meio de um capítulo.

## Pacotes: o que atravessou o fio

`d.packet({ tag, tone, from, to, protocol, payload, bytes? })` registra um pacote no
instante do cursor; não move nada no palco. O player usa o registro para:

- o **cartão do pacote** em vigor, na narração ("Packet 3 of 9 · OTLP");
- a tabela **Packet flow**, que revela as linhas conforme o tempo anda e destaca a
  atual (`packetsTitle`, `packetLegend` — a legenda diz o que a COR significa, e
  por padrão é o protocolo).

A ficha que anda no palco pode ter etiqueta de duas linhas: `label` é o cabeçalho
(cheio, na cor do tom) e `sublabel` o conteúdo — no plano e no isométrico.

`bytes` só quando o domínio sabe o tamanho. Um número inventado na coluna é pior
que um travessão.

## Profundidade: um mundo, vários níveis

Um filme pode aninhar níveis no mesmo mundo — o interior de uma peça desenhado
DENTRO da caixa dela, em escala menor — e descer por zoom contínuo:

- `lod: { appear, vanish }` em qualquer peça: ela surge entre `appear·0,7` e
  `appear`, e some entre `vanish` e `vanish·1,4` (rampa em logaritmo). Regra:
  `vanish·1,4` de um nível < zoom em que a câmera para no de baixo, para nunca haver
  dois níveis ao mesmo tempo na tela;
- `textScale` (≈ `1/zoom` do nível): texto, traços, setas, fichas e placas escalam
  com a peça, no plano e no 3D, e leem no mesmo tamanho quando a câmera chega;
- `d.camera({ box })` voa como um mapa: zoom em logaritmo e centro ancorado no
  ponto que fica parado na tela — o alvo não foge do quadro num mergulho de 70×.

## Formas que dizem o que a peça é

`shape`: `box pill circle diamond cylinder stack chip mux alu register memory and
or xor not`. Cada uma é um contorno + detalhes em `shapes.ts`; o palco plano
desenha, o isométrico **extruda o mesmo contorno** e pinta os detalhes na face de
cima (pinos de chip rentes à base). Forma nova entra lá, uma vez, e serve às duas
vistas.

## Showcase e Simulation

Um lab pode ter os dois modos (`ModosDoLab` no site): o **showcase** é um filme que
conta o mecanismo, com câmera e narração; a **simulation** é o modelo que o leitor
desmonta. O filme do showcase continua sendo derivado do domínio — a vitrine da
CPU executa o programa no RV32I de referência; a do Collector monta o envelope com
`toOtlpJson` e conta os bytes do JSON.

## Ícones e rótulos no 3D

Toda peça aceita `icon: Glyph` — `{ paths: string[]; fill?: string[] }`, traço
numa grade 24×24, na tinta do tom da peça. No 3D, o ícone é um selo redondo
que flutua sobre o rótulo, preso por uma haste; no plano, fica no canto de cima
da caixa, do tamanho que ela comporta. O motor não traz ícone nenhum: o desenho
é da identidade do handbook (`ICONES_OTEL` em `otel-domain`, `ICONES_K8S`,
`ICONES_CPU`) e chega junto da peça.

No isométrico, rótulos **cedem**: a cada quadro, os rótulos das peças entram
por prioridade (peça acesa primeiro, depois a de maior área) e um rótulo que
cobriria outro já posto fica oculto (`data-cede`) até ter espaço. O tamanho é
estimado pelo texto, sem medir o DOM. Uma troca de capítulo que acende outra
peça devolve o rótulo dela.

## Layout do player

Com o player largo (container ≥ 54rem), a cena fica à esquerda e o andamento
(capítulos, narração, pacote atual, painel do nível) à direita. Sem `sticky`:
colunas de alturas diferentes grudando no topo quebravam a rolagem. Estreito,
empilha. A tabela
de pacotes fica sempre embaixo, na largura toda.
