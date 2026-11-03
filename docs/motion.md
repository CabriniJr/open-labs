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
