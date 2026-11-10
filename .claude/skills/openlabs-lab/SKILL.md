---
name: openlabs-lab
description: Build, extend or review an OpenLabs lab — a runnable piece of a handbook (flow engine, state model, animated film, isometric/3D view or a free React interaction). Use when asked to create a lab, add a visualization/animation/3D view to a handbook, port a topic into a lab, or QA a lab's visuals and performance.
---

# Montar um lab do OpenLabs

Um lab é **um modelo que roda**, desenhado na mídia que melhor ensina aquele
assunto. O handbook é um playground: escolha a mídia pelo assunto, não pelo
motor que já existe. O que não é negociável é a régua de qualidade abaixo.

## 1. Escolha a mídia (decide sozinha)

| O assunto é… | Use | Onde |
|---|---|---|
| fluxo com camadas, que se abre (pipeline, CPU, circuito) | motor de fluxos | `depth-core` + `depth-ui` (`Stage`) |
| estado com eventos e regras (reconciliação, ciclo de vida) | modelo de estado | `interactive-core` (`InteractiveModel`) |
| coreografia: atores, mensagens, ordem no tempo (protocolos, propagação, handshake) | filme | `@ovh/motion` (`film`, `MotionPlayer`) |
| topologia/dimensão espacial que ganha com profundidade | vista isométrica | `@ovh/stage3d` (`IsoStage`) como `view` do filme |
| manipulação direta, gráfico, editor, qualquer outra coisa | componente React livre | `apps/site/src/components/<Nome>Lab.tsx` |

**Showcase + Simulation.** Todo lab deve considerar os dois modos
(`ModosDoLab`): um filme que conta o mecanismo, com descida de nível animada, e o
modelo que o leitor desmonta. Exemplos: `CpuModos`, `CollectorModos`.

**O motor de fluxos não é obrigatório.** Ele serve quando o leitor precisa
abrir camadas de um sistema que roda (pipeline, CPU). Quando o assunto é o que
acontece com *uma coisa* no caminho — o protobuf é o caso de referência —, o
formato que ensina é o do hero antigo, modernizado no filme: **o papelzinho
pulando de app em app**, com ícone em cada app, e **uma tela ao lado somando o
texto** do que cada um fez, em verbos curtos ("checkout *cria* o span", "o SDK
*carimba* service.name", "o SDK *escreve* 8 campos → 173 B", "o Collector *lê e
junta*", "o backend *guarda*"). A profundidade fica no papel: a câmera desce
para dentro dele (os campos) e de um campo (do que ele é feito). A
interatividade são escolhas que refazem o filme (codificação, um atributo a
mais). **Não mostre a máquina por dentro** — buffer em hexa, offsets — como
showcase: isso é a simulação, para quem quer cavar. Simples primeiro, fundo
depois.

Combine à vontade: um filme pode ter vistas *Sequence / Topology / Iso* no
mesmo relógio (veja `ContextoLab.tsx`). Se nada serve, **escreva o componente**
— nenhum contrato existe para impedir uma mídia que ensina melhor.

## 2. A anatomia (sempre nesta ordem)

1. **Modelo do domínio primeiro**, puro e determinístico, em
   `packages/<dominio>-domain/src/<lab>/`. Ids de gerador semeado, sem
   `Math.random` nem `Date.now`. Testes do modelo antes de qualquer desenho.
2. **O desenho é derivado do modelo.** Um filme é `filmeDe(opcoes) → Film`;
   nada de roteiro solto. Se o leitor muda uma opção, o filme é recalculado.
   O teste interroga o quadro (`frameAt`), não o pixel: "com o proxy
   descartando, a barra de pagamentos tem outro tom".
3. **Componente do site** em `apps/site/src/components/<Nome>Lab.tsx` + `.css`,
   página em `apps/site/src/pages/labs/<slug>.astro` (copie a estrutura de
   `hard-context-and-baggage.astro`: cabeça editorial, palco, "Break it",
   fronteira do experimento, `Predicao`).
   O palco mora em `<section class="lab-palco">` com **uma** ilha dentro, e a
   `<section class="lab-prosa">` logo depois dele abre com o "Break it": a
   bancada (`LabBench.astro`) leva esse primeiro bloco como guia ao modo foco
   (tela cheia, lado a lado no 16:9, embaixo no celular em pé). Em tela cheia
   o lab ganha a altura toda — meça o próprio tamanho no `resize`, não só na
   montagem.
4. **Publicar**: status/href no roadmap do handbook (`data/roadmap.ts` ou o
   `handbook.yaml`). Lab sem `.dui-stage` entra em `SEM_PALCO`
   (`tests/espaguete.spec.ts`).
5. **e2e** em `apps/site/tests/<slug>.spec.ts`: um gesto real, o resultado
   derivado, sem rolagem horizontal, sem erro de página.

## 3. Linguagem visual (vigiada por script)

- **Cor só por sentido.** Tons: `processor`, `container`, `controller`,
  `conduit`, `live`, `high`, `kind-1…5`, `ink`, `muted`. A tinta mora em
  `packages/depth-ui/src/stage.css` (catálogo); `pnpm catalogo` reprova hex
  fora dele. Misturar com `color-mix(in oklab, var(--x) N%, …)` é permitido.
- **Motor não conhece domínio**: `pnpm boundaries` reprova "otel", "kubernetes",
  "opcode"… em `depth-*`, `motion`, `stage3d`, `interactive-core`, `model-format`.
- Três temas (claro, escuro, sem marca): tokens em `:root`, nunca cor fixa.
- Fonte: `--font-display`/`--font-body` (Outfit), `--font-mono` (JetBrains Mono).
- Nada se mexe sem motivo: movimento conta o que o modelo fez.

## 4. Animação com `@ovh/motion`

```ts
const f = film<Detalhe>({ width: 1280, height: 720, maxZoom: 1.75 });
f.add({ type: "node", id: "a", box, label: "A", tone: "processor" });
f.add({ type: "token", id: "msg", path: connect(boxA, boxB), hidden: true, label: "SYN" });
f.chapter({ id: "open", title: "Opening", body: "…", detail }, (d) => {
  d.camera({ focus: ["a", "b"] });
  d.together((x) => x.draw("link"), (x) => x.send("msg"));
  d.glow("b").ping("b");
  d.beat({ title: "Field by field", detail: proximo }).wait(1500);
});
```

Verbos: `show hide draw send to tween set glow ping dim camera wait beat
together stagger`. Layouts: `sequence grid ring connect boxAt`. Peças: `node
lane link token bar note region custom`. Detalhes em `docs/motion.md`.

- Dois layouts da mesma história devem usar **os mesmos verbos e durações**;
  teste que `chapters[].start/end/steps[].t` batem.
- Notas nunca em cima do caminho de uma ficha: `align: "end"` à esquerda da
  raia, `"start"` à direita.
- Câmera: `maxZoom` ≤ 2 em filmes com texto, senão o rótulo fica gigante.

### Modelos que se parecem com a coisa

Caixa é o último recurso. Use a forma que diz o que a peça é (`chip`, `mux`,
`alu`, `register`, `memory`, `and/or/xor/not`, `stack` para equipamento,
`cylinder` para armazenamento) — ou acrescente uma em `shapes.ts`. Para descer de
nível: interior aninhado dentro da caixa, `lod` e `textScale` por nível, e
`d.camera({ box })` (ver `docs/motion.md`, "Profundidade").

### Ícones: o que a peça é, num relance

`icon: Glyph` em qualquer peça (`{ paths, fill? }`, traço 24×24). No 3D vira um
selo que flutua sobre o rótulo; no plano, o canto da caixa. **O motor não tem
ícones**: cada handbook tem o catálogo dele (`ICONES_OTEL`, `ICONES_K8S`,
`ICONES_CPU`), e um papel tem o mesmo ícone em todos os labs do handbook. Papel
novo → ícone novo no catálogo, nunca um desenho solto no filme.

### Roteiro do handbook

Antes de criar um lab, leia o roteiro do handbook (`docs/roteiros/<handbook>.md`):
pergunta, mal-entendido, mídia, capítulos, o que a altura significa no 3D,
ícones, correlações com os outros labs e critério de pronto. Criou ou mudou um
lab? Atualize o roteiro no mesmo PR.

## 5. 3D / isométrico com `@ovh/stage3d`

- Entre como `views` do `MotionPlayer`, com `lazy()` + `Suspense`: o three.js
  só baixa quando o leitor pede.
- Topologia fica de pé; diagrama de sequência não (o tempo vira profundidade).
- Peça `custom` não aparece no 3D — se o lab depende dela, a vista 3D não serve.
- **A altura tem significado ou não existe**: aninhamento, camada de implantação,
  nível de zoom. `elevation`, `height` e `lift` animável.
- Rótulo **cede**, não empilha: no 3D, um rótulo que cobriria outro some até
  ter espaço (prioridade: aceso, depois peça maior). Não aperte layout para
  "caber" rótulos no isométrico — espace as peças e deixe a regra decidir.
- Layout do player: janela à esquerda, andamento (capítulos, narração, painel)
  à direita, por container query no `MotionPlayer`, sem `sticky` (quebra a
  rolagem). Não refaça no lab.

## 6. Regras de desempenho (aprendidas medindo)

- **Nunca** `filter`/`drop-shadow`/`blur` em algo que se move ou anima; halo é
  um disco translúcido. Nunca animar `filter` em keyframes.
- Nada de busca linear por peça dentro de render: monte índices (`Map`/`Set`)
  uma vez. Componentes caros em `memo`; zoom contínuo chega em degraus.
- DOM por quadro só quando o valor muda (rótulos 3D: `escrever`/`marcar`).
- 3D: desenho sob demanda, pausa fora da tela, DPR ≤ 2, `dispose()`.

## 7. QA duro — o lab só está pronto quando passa

```bash
pnpm test && pnpm typecheck && pnpm boundaries && pnpm catalogo
pnpm build && pnpm qa:labs --only=labs/<slug>/      # PW_CHROMIUM=… se preciso
```

`qa:labs` abre o lab em desktop e celular com CPU a 4× e **reprova** erro de
console/página, rolagem horizontal, controle sem nome acessível e palco sem
rótulo; **alerta** acima do orçamento (parado p95 ≤ 50 ms, zoom p95 ≤ 120 ms,
long tasks ≤ 250 ms/s; `--strict` faz alerta reprovar). E fotografa cada
capítulo de cada vista em `apps/site/qa-report/shots/`.

**Abra e olhe todas as fotografias.** Checklist do olho:

- texto sobre texto, rótulo cortado, nota em cima de fio ou ficha;
- câmera cortando o que o capítulo fala;
- cor que não diz nada (tudo da mesma espécie) ou que diz errado;
- o painel de detalhe mostra o *mesmo instante* que o palco;
- tema escuro (`data-theme="dark"`) e 390 px de largura;
- o que o leitor faz em 10 segundos sem ler nada.

Relate números e defeitos com honestidade: o que não passou fica escrito
(veja `docs/qa/2026-11-03-performance.md`), nunca escondido.
