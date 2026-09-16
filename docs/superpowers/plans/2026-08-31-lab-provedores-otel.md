# O lab dos provedores do OpenTelemetry — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps
> use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir `otelWorld()` em `@ovh/otel-domain` — o processo instrumentado com os
três provedores do SDK — e publicar `labs/providers`, o primeiro lab do `otel.model`, com
L0, L1 e L3 e com o invariante do envelope provado por teste.

**Architecture:** Uma árvore, quatro raízes. `host → process → {tracer,logger,meter}-provider`,
e cada lab futuro da trilha (`queue`, `batch`, `two-providers`) é uma raiz declarada sobre a
mesma árvore, sem código de domínio novo. O `Resource` é `static` (placa), o `Sampler` é
`router` de três saídas, `ForceFlush` é linha de controle, e a assimetria empurra/pede entre
traces e métricas nasce de `buffer + sequencer` contra `store + sequencer`. Nenhum `kind`
novo.

**Tech Stack:** TypeScript estrito, pnpm workspaces, vitest (unit), fast-check (property),
Playwright (e2e), Astro + ilhas React.

**Spec:** `docs/superpowers/specs/2026-08-31-provedores-otel-design.md` — **ler antes da
primeira linha de código.** As decisões D1–D9 não se reabrem aqui.

---

## O idioma do repo — ler antes de escrever qualquer teste

Nomes que **existem de verdade**. Não inventar outros; não acrescentar API ao motor para
facilitar um teste.

```ts
import { World, indexTree, validateWorld } from "@ovh/depth-core";
import type { AnyObject, Message, ObjectSpec, WorldSpec, WorldState, Wire } from "@ovh/depth-core";

const mundo = new World(spec);      // o construtor JÁ valida: mundo inválido lança aqui
mundo.advance(6);                   // anda n ticks
mundo.state;                        // o WorldState corrente
mundo.seek(3);                      // volta a um tick
mundo.setParam("sampling-ratio", 0.1);
mundo.tree.byId.get(id);            // o objeto
mundo.tree.parent.get(id);          // `parent` é um Map, não um método
```

**Não existe `runTicks`.** Helper no próprio arquivo de teste:

```ts
const rodar = (spec: WorldSpec, ticks: number): readonly WorldState[] => {
  const mundo = new World(spec);
  const estados: WorldState[] = [mundo.state];
  for (let i = 0; i < ticks; i += 1) {
    mundo.advance(1);
    estados.push(mundo.state);
  }
  return estados;
};
```

**Convenções que este pacote passa a ter:**

- a função que monta o mundo se chama **`otelWorld`** (como `cpuWorld` e `microWorld`)
- o leitor de estado tipado se chama **`estadoOtel(state: WorldState)`** — o componente
  **nunca** cava `state.nodes`
- **ids em inglês, kebab-case, com o nome da spec do OpenTelemetry** (D4 da spec de
  desenho). Desvio consciente do `cpu-domain`, que usa ids em português
- id e nome de porta **não podem conter `.` nem `:`** — o livro-caixa usa esses separadores
- todo texto que o leitor vê mora em `labels.ts`, em **inglês**

**Armadilhas do `tsconfig.base.json` que vão morder:**

- `verbatimModuleSyntax` → `import type` para tipo, e imports internos com sufixo **`.js`**
- `exactOptionalPropertyTypes` → campo opcional entra por spread condicional
  (`...(cond ? { collapsed: true as const } : {})`), nunca por `undefined`
- `noUncheckedIndexedAccess` → todo acesso indexado devolve `T | undefined`

---

## Estrutura de arquivos

Criar:

| Arquivo | Responsabilidade |
| --- | --- |
| `packages/otel-domain/src/providers/world.ts` | A árvore: os três provedores, as placas, a fiação. Exporta `otelWorld`. |
| `packages/otel-domain/src/providers/sampler.ts` | A decisão de amostragem, pura, sem motor. As três saídas. |
| `packages/otel-domain/src/providers/batch.ts` | Fila, gatilho de tempo e exportador — a fábrica reusada por traces e logs. |
| `packages/otel-domain/src/providers/metrics.ts` | `store` de pontos, `MetricReader`, e o colapso de cardinalidade. |
| `packages/otel-domain/src/providers/envelope.ts` | `WorldState` → `ExportTraceServiceRequest`. O L3. |
| `packages/otel-domain/src/providers/estado.ts` | `estadoOtel`: o leitor tipado do `WorldState`. |
| `packages/otel-domain/src/providers/views.ts` | As seis views. |
| `packages/otel-domain/src/providers/labels.ts` | `ROTULOS`, `DESCRICOES`, `MAL_ENTENDIDOS`. |
| `packages/otel-domain/src/providers/carga.ts` | `leituraDaCarga`, `especieDaCarga`. |
| `apps/site/src/components/ProvidersLab.tsx` | A ilha React. |
| `apps/site/src/components/ProvidersLab.css` | **Sem hexadecimal** — só `var(--…)`. |
| `apps/site/src/components/Predicao.tsx` | Predição antes da revelação. Neutra de domínio (D9). |
| `apps/site/src/components/Predicao.css` | Idem. |
| `apps/site/src/pages/labs/providers.astro` | A página do lab. |
| `apps/site/tests/providers-lab.spec.ts` | Playwright. |
| `labs/providers/compose.yaml` | A contraparte real (bloco E). |
| `labs/providers/README.md` | O que observar nela. |

Modificar:

| Arquivo | O quê |
| --- | --- |
| `packages/otel-domain/package.json` | dependência `@ovh/depth-ui` (as views importam `View`) |
| `packages/otel-domain/src/index.ts` | barril: exportar tudo o que a UI usa |
| `apps/site/src/data/roadmap.ts` | nó `providers` na fase 3; fase 4 e abaixo `+56`; `MAP_HEIGHT` 926 |
| `docs/roadmap.md` | a fase 3 ganha o lab |
| `docs/PROGRESS.md` | o round |
| `docs/authoring.md` | **está desatualizado** — descreve `Scenario<S>`, que o `depth-core` marca como andaime proibido em código novo. Ver bloco F |

**Nada a registrar em `tsconfig.json`, `vitest.workspace.ts` nem `apps/site/package.json`:**
`@ovh/otel-domain` já está nos três. Verificado em 31/08/2026.

**Por que `providers/` dentro de `otel-domain` e não pacote novo:** é o mesmo domínio e o
mesmo handbook, e `parseTraceparent`/`toOtlpJson` são reusados sem serem exportados para
fora.

---

## Bloco A — a decisão de amostragem, sem motor

### Task 1: as três saídas do amostrador

**Files:**
- Create: `packages/otel-domain/src/providers/sampler.ts`
- Test: `packages/otel-domain/src/providers/sampler.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

```ts
import { describe, expect, it } from "vitest";
import { decidir, PORTA_DA_DECISAO } from "./sampler.js";

describe("a decisão de amostragem tem três resultados, não dois", () => {
  it("AlwaysOn devolve record-and-sample", () => {
    expect(decidir({ tipo: "always-on" }, { aleatorio: 0.9 })).toBe("record-and-sample");
  });

  it("AlwaysOff devolve drop", () => {
    expect(decidir({ tipo: "always-off" }, { aleatorio: 0.1 })).toBe("drop");
  });

  it("razão 0.1 amostra o sorteio abaixo do limiar e descarta o resto", () => {
    expect(decidir({ tipo: "ratio", razao: 0.1 }, { aleatorio: 0.05 })).toBe("record-and-sample");
    expect(decidir({ tipo: "ratio", razao: 0.1 }, { aleatorio: 0.5 })).toBe("drop");
  });

  it("parent-based herda a decisão do pai remoto", () => {
    const s = { tipo: "parent-based", raiz: { tipo: "always-off" } } as const;
    expect(decidir(s, { aleatorio: 0.9, paiAmostrado: true })).toBe("record-and-sample");
    expect(decidir(s, { aleatorio: 0.1, paiAmostrado: false })).toBe("drop");
  });

  it("always-record converte drop em record-only, e é assim que a porta do meio acende", () => {
    const s = { tipo: "always-record", raiz: { tipo: "always-off" } } as const;
    expect(decidir(s, { aleatorio: 0.9 })).toBe("record-only");
  });

  it("cada decisão tem porta própria — o desenho não pode confundir gravado com descartado", () => {
    expect(PORTA_DA_DECISAO["record-and-sample"]).toBe("sampled");
    expect(PORTA_DA_DECISAO["record-only"]).toBe("recorded");
    expect(PORTA_DA_DECISAO.drop).toBe("dropped");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run packages/otel-domain/src/providers/sampler.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

`Decisao` é `Record` fechado sobre as três decisões da spec, e `PORTA_DA_DECISAO` é
`Record<Decisao, PortId>` — decisão nova sem porta não compila. Cabeçalho do arquivo cita
[Tracing SDK · ShouldSample](https://opentelemetry.io/docs/specs/otel/trace/sdk/#shouldsample)
e a [tabela de reação](https://opentelemetry.io/docs/specs/otel/trace/sdk/#recording-sampled-reaction-table),
e diz por que `always-record` existe: é o decorador da spec que transforma `DROP` em
`RECORD_ONLY`, e é o caminho honesto para o leitor ver a porta do meio.

- [ ] **Step 4: Rodar e ver passar**
- [ ] **Step 5: Commit** — `feat(otel): as três decisões de amostragem, com porta própria`

---

### Task 2: a fábrica do lote

**Files:**
- Create: `packages/otel-domain/src/providers/batch.ts`
- Test: `packages/otel-domain/src/providers/batch.test.ts`

O `BatchSpanProcessor` e o `BatchLogRecordProcessor` são a mesma forma. Uma fábrica:

```ts
export interface LoteConfig {
  readonly prefixo: string;          // "span" | "log" — entra nos ids
  readonly maxQueueSize: number;     // padrão da spec: 2048
  readonly maxExportBatchSize: number; // 512
  readonly scheduledDelayTicks: number; // scheduledDelayMillis em ticks
}
export function loteProcessor(cfg: LoteConfig): { objeto: AnyObject; wires: readonly Wire[] };
```

- [ ] **Step 1: Escrever os testes que falham**

Quatro, e cada um é um gatilho da spec:

1. a fila solta o lote quando atinge `maxExportBatchSize`, **antes** do prazo
2. a fila solta o lote no prazo, mesmo com menos que `maxExportBatchSize`
3. a fila **cheia descarta**, e o descarte aparece no livro-caixa como `.unwired` ou em
   `DROP` — nunca desaparece em silêncio
4. `flush` pela porta de controle solta o lote fora dos dois gatilhos acima

- [ ] **Step 2–4:** falhar, implementar, passar.

Notas de implementação que economizam uma hora:

- a fila é `kind: "buffer"`, com `init` e estado `{ itens: readonly Message[] }`
- o gatilho é `kind: "sequencer"` e **só pode emitir `line: "control"`** — se ele tentar
  carregar carga, `validateWorld` recusa
- linha de controle **exige `toPort`**; linha de dado **proíbe** `toPort` quando o destino
  não tem inlets nomeados
- não fazer laço acomodado: se fila e gatilho se olharem só por `timing: "settle"`,
  `validateWorld` recusa por ciclo combinacional. Um dos dois lados é `clocked`
- **peso, não partícula:** um lote de 512 é `Message` de `weight: 512`. O `depth.md` §5 é
  explícito, e instanciar 512 objetos é o erro que faz o lab travar no browser

- [ ] **Step 5: Commit** — `feat(otel): o lote, com os quatro gatilhos da spec`

---

### Task 3: o lado das métricas — o que pede em vez de empurrar

**Files:**
- Create: `packages/otel-domain/src/providers/metrics.ts`
- Test: `packages/otel-domain/src/providers/metrics.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

```ts
it("o store não emite nada sem o reader pedir", () => { /* N ticks, zero saída */ });

it("o reader pede a cada exportIntervalTicks, e é aí que o ponto sai", () => { /* ... */ });

it("acima do limite de cardinalidade os pontos COLAPSAM, não são descartados", () => {
  // a soma dos valores continua fechando; o que muda é o número de linhas,
  // e a linha excedente carrega o atributo de overflow.
  // É o contraste com a fila: buffer recusa, store colapsa.
});

it("a soma total é conservada no colapso — colapsar não é perder", () => { /* ... */ });
```

O terceiro e o quarto são o coração de F4. Ancorados em
[Cardinality limits](https://opentelemetry.io/docs/specs/otel/metrics/sdk/#cardinality-limits)
e [Overflow attribute](https://opentelemetry.io/docs/specs/otel/metrics/sdk/#overflow-attribute):
a spec **garante** que nenhuma medição é contada duas vezes nem perdida no overflow. Se o
nosso modelo perder, ele está errado, e o teste é quem diz.

- [ ] **Step 2–4:** falhar, implementar, passar.
- [ ] **Step 5: Commit** — `feat(otel): o store de pontos, o reader que pede, e o colapso`

---

## Bloco B — a árvore

### Task 4: o mundo

**Files:**
- Create: `packages/otel-domain/src/providers/world.ts`
- Test: `packages/otel-domain/src/providers/world.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

```ts
import { indexTree, familyOf, World } from "@ovh/depth-core";
import { otelWorld } from "./world.js";

it("o mundo é válido — o construtor de World valida", () => {
  expect(() => new World(otelWorld())).not.toThrow();
});

it("o recurso é PLACA: sem porta, sem behavior, e nenhum fio o toca", () => {
  const spec = otelWorld();
  const arvore = indexTree(spec.root);
  for (const id of ["resource-traces", "resource-logs", "resource-metrics", "propagators", "views"]) {
    const o = arvore.byId.get(id);
    expect(o?.kind).toBe("static");
    expect(familyOf("static")).toBe("plate");
    expect(o?.behavior).toBeUndefined();
    expect(spec.wires.some((w) => w.from === id || w.to === id)).toBe(false);
  }
});

it("os propagadores penduram no PROCESSO, não em provider nenhum", () => {
  const arvore = indexTree(otelWorld().root);
  expect(arvore.parent.get("propagators")).toBe("process");
});

it("o collector está FORA do processo", () => {
  const arvore = indexTree(otelWorld().root);
  expect(arvore.parent.get("collector")).toBe("host");
});

it("o amostrador tem três saídas, e a do meio não vai para o exportador", () => { /* ... */ });

it("o flush do provider desce por CONTROLE para todos os processadores registrados", () => {
  const spec = otelWorld();
  const doFlush = spec.wires.filter((w) => w.from === "trace-flush");
  expect(doFlush.length).toBeGreaterThan(1);
  expect(doFlush.every((w) => w.line === "control" && w.toPort !== undefined)).toBe(true);
});

it("a linha entre o amostrador e a porta de logs é de CONTROLE e cruza fronteira de provider", () => {
  const spec = otelWorld();
  const cruza = spec.wires.find((w) => w.from === "sampler" && w.to === "trace-gate");
  expect(cruza?.line).toBe("control");
});
```

- [ ] **Step 2: Rodar e ver falhar**

- [ ] **Step 3: Implementar**

Ordem que evita retrabalho: placas → `app` → `sampler` → os três providers com as fábricas
do bloco A → `collector` → fiação plana em `wires`.

**O canal opaco é aresta, não filho.** `otlp-out` é o objeto `channel` que a aresta
`span-exporter → collector` **é**, então ele vai em `WorldSpec.channels` e a aresta o
referencia por `channel: "otlp-out"`. `validateWorld` recusa `Wire.channel` cujo id não
esteja em `channels`, e recusa canal que apareça como filho de alguém. É o que torna a
linha clicável e abrível — e o que ela diz ao abrir é "não modelado aqui" (D1/D6). Note que
o micro usa `kind: "channel"` como **filho** para os barramentos dele; aqui é o outro uso,
e é o primeiro do repo.

> ⚠️ **A regra que o último teste esbarra.** Lido em `packages/depth-core/src/validate.ts`
> em 31/08/2026: linha de controle **exige** `toPort`, e o destino do sinal **tem de agir**
> — *"sinal tem destinatário nomeado e não atravessa contêiner"*. Não há regra restringindo
> sinal a irmãos da mesma subárvore, então D5 deve passar: `trace-gate` é folha `switch`
> com `behavior`, e recebe em porta nomeada. Se ainda assim recusar, **não contorne no
> domínio.** Pare, abra a Task 4b com o teste do motor que descreve o caso. A regra do repo
> é que primitiva faltando vai para o motor, não para o lab.

- [ ] **Step 4: Rodar e ver passar**
- [ ] **Step 5: Commit** — `feat(otel): a árvore do processo instrumentado e dos três provedores`

---

### Task 5: o leitor de estado

**Files:**
- Create: `packages/otel-domain/src/providers/estado.ts`
- Test: `packages/otel-domain/src/providers/estado.test.ts`

```ts
export interface EstadoOtel {
  readonly criados: number;          // quantos o app criou
  readonly amostrados: number;
  readonly gravadosSemSair: number;  // RECORD_ONLY
  readonly descartadosPeloSampler: number;
  readonly naFila: number;
  readonly descartadosPelaFila: number;
  readonly exportados: number;       // o que o collector recebeu
  readonly pontos: readonly { readonly chave: string; readonly valor: number }[];
  readonly colapsados: number;
}
export function estadoOtel(s: WorldState): EstadoOtel;
```

- [ ] **Step 1: Escrever o teste que falha**

O teste que importa é de **conservação**, e ele é o que impede o painel de mentir:

```ts
it("nada aparece nem desaparece: criados = amostrados + gravados + descartados", () => {
  // property test com fast-check sobre semente e carga
});

it("o que saiu da fila mais o que ela descartou mais o que está nela fecha com o que entrou", () => { /* ... */ });
```

- [ ] **Step 2–5:** falhar, implementar, passar, commit
  (`feat(otel): o leitor de estado, com conservação provada`).

---

### Task 6: o envelope — o L3, e a tese da spec

**Files:**
- Create: `packages/otel-domain/src/providers/envelope.ts`
- Test: `packages/otel-domain/src/providers/envelope.test.ts`

Esta é **a** task do round. É o T1 da spec de desenho.

- [ ] **Step 1: Escrever o teste que falha**

```ts
import fc from "fast-check";
import { indexTree, World } from "@ovh/depth-core";
import { envelopesDe } from "./envelope.js";
import { otelWorld } from "./world.js";
import { ROTULOS } from "./labels.js";

it("INVARIANTE: o resource do envelope é a placa do provider que o emitiu", () => {
  fc.assert(fc.property(fc.integer({ min: 1, max: 50 }), fc.integer({ min: 0, max: 40 }), (semente, ticks) => {
    const spec = otelWorld({ seed: semente });
    const mundo = new World(spec);
    mundo.advance(ticks);
    for (const env of envelopesDe(mundo.state)) {
      for (const rs of env.resourceSpans) {
        // (⊆) não inventa campo
        expect(rs.resource.attributes).toEqual(ROTULOS.recursoDeTraces.attributes);
        // (⊇) e o escopo é o que o app usou
        expect(rs.scopeSpans.every((ss) => ss.scope.name.length > 0)).toBe(true);
      }
    }
  }));
});

it("o resource está UMA CAMADA ACIMA dos spans — é a tese do lab, e é estrutural", () => {
  // nenhum span carrega service.name como atributo próprio
});

it("o bit sampled do traceparent concorda com a porta pela qual o span saiu", () => {
  // parseTraceparent do que o envelope carrega
});
```

- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar** — reusar `toOtlpJson`, `attribute` e `parseTraceparent`, que já
  existem em `otel-domain`. **Não** escrever um segundo serializador.
- [ ] **Step 4: Rodar e ver passar**
- [ ] **Step 5: Commit** — `feat(otel): o envelope OTLP derivado do run, com o invariante provado`

---

### Task 7: os cinco fenômenos, como teste

**Files:**
- Create: `packages/otel-domain/src/providers/fenomenos.test.ts`

Um teste por fenômeno da §5 da spec. Nenhum deles pode passar por roteiro: todos são
`otelWorld` mais parâmetro.

- [ ] F1 — dois recursos diferentes produzem dois `resourceSpans` distintos, e nada falha
- [ ] F2 — razão baixa acende a porta `recorded`; o `collector` não recebe o que saiu por ela
- [ ] F3 — mesma semente, dois runs: sem flush perde a fila, com flush não perde
- [ ] F4 — no mesmo run, o número de saídas de trace é ~12× o de métrica, **com os padrões
      da spec** (5 000 ms contra 60 000 ms), e o número sai do livro-caixa
- [ ] F5 — no-op: `criados === contador do sink no-op` e `exportados === 0` (é o T2)
- [ ] Commit — `test(otel): os cinco fenômenos, nenhum roteirizado`

---

## Bloco C — a tela

### Task 8: rótulos, descrições e os mal-entendidos

**Files:**
- Create: `packages/otel-domain/src/providers/labels.ts`
- Test: `packages/otel-domain/src/providers/labels.test.ts`

Três exportações, e a terceira é nova no repo:

```ts
export const ROTULOS = { /* ... */ } as const;
export const DESCRICOES: Readonly<Record<string, string>>;   // chave = ID do objeto
export const MAL_ENTENDIDOS: readonly {
  readonly crenca: string;    // o que se acredita
  readonly spec: string;      // o que a spec diz
  readonly fonte: string;     // o link
  readonly onde: string;      // o id do objeto que desfaz
}[];
```

- [ ] **Step 1: Teste que falha**

```ts
it("todo objeto que o leitor pode selecionar tem descrição", () => {
  const arvore = indexTree(otelWorld().root);
  for (const id of arvore.byId.keys()) expect(DESCRICOES[id]).toBeDefined();
});

it("todo mal-entendido aponta para um objeto que existe e tem fonte", () => {
  const arvore = indexTree(otelWorld().root);
  for (const m of MAL_ENTENDIDOS) {
    expect(arvore.byId.has(m.onde)).toBe(true);
    expect(m.fonte).toMatch(/^https:\/\//);
  }
});

it("o bloco opaco se declara opaco", () => {
  expect(DESCRICOES.collector).toMatch(/not modelled/i);
});
```

- [ ] **Step 2–5.** Commit — `feat(otel): rótulos, descrições e os mal-entendidos que o lab desfaz`

---

### Task 9: as seis views

**Files:**
- Create: `packages/otel-domain/src/providers/views.ts`
- Test: `packages/otel-domain/src/providers/views.test.ts`
- Modify: `packages/otel-domain/package.json` (dependência `@ovh/depth-ui`)

- [ ] **Step 1: Teste que falha**

```ts
import { indexTree } from "@ovh/depth-core";
import { fracaoDoQuadro, quantoAparece, viewDisagreement } from "@ovh/depth-ui";
import { OTEL_VIEWS, VIEW_LOGGER_PROVIDER, VIEW_METER_PROVIDER, VIEW_PROCESS, VIEW_TRACER_PROVIDER } from "./views.js";

it("toda view concorda com a árvore", () => {
  const arvore = indexTree(otelWorld().root);
  for (const v of OTEL_VIEWS) expect(viewDisagreement(arvore, v)).toBeNull();
});

it("R3 — as três views de provider compartilham a moldura, então o diff é o interior", () => {
  const tres = [VIEW_TRACER_PROVIDER, VIEW_LOGGER_PROVIDER, VIEW_METER_PROVIDER];
  expect(new Set(tres.map((v) => `${v.width}x${v.height}`)).size).toBe(1);
});

it("as três molduras de provider passam do limiar de LOD — senão a assimetria só aparece com clique", () => {
  const quadro = { largura: VIEW_PROCESS.width, altura: VIEW_PROCESS.height };
  for (const id of ["tracer-provider", "logger-provider", "meter-provider"]) {
    const caixa = VIEW_PROCESS.places.find((p) => p.id === id);
    // `quantoAparece` devolve 0 abaixo de LIMIAR_ENTRA. O limiar em si NÃO é
    // exportado pelo barril de `depth-ui` (conferido em 31/08/2026), e não vale
    // repetir o número aqui: pedir > 0 pergunta a mesma coisa sem duplicar a régua.
    expect(quantoAparece(fracaoDoQuadro(caixa!, quadro))).toBeGreaterThan(0);
  }
});

it("R2 — todo sequenciador é desenhado acima da faixa de dado", () => { /* y menor que o y da faixa */ });

it("R1 — toda placa encosta na borda de quem a declara", () => { /* ... */ });
```

O terceiro teste é o que impede a regressão silenciosa de layout descrita na §8.3 da spec.

- [ ] **Step 2–4.** Se o teste de LOD reprovar, **muda o layout**, não o teste.
- [ ] **Step 5: Commit** — `feat(otel): as seis views, e as três regras de desenho como teste`

---

### Task 10: a peça de predição

**Files:**
- Create: `apps/site/src/components/Predicao.tsx`, `Predicao.css`
- Test: `apps/site/src/components/Predicao.test.tsx` (projeto `dom` do vitest)

Neutra de domínio (D9). Contrato mínimo, e o mínimo é de propósito:

```tsx
interface PredicaoProps {
  readonly pergunta: string;
  readonly opcoes: readonly string[];
  readonly correta: number;
  readonly revelacao: string;
  /** Some depois de responder: predição feita não se refaz. */
  readonly onResponder?: (escolhida: number) => void;
}
```

- [ ] **Step 1: Testes que falham** — a revelação não aparece antes de responder; responder
      mostra a revelação e marca a escolha; não dá para trocar depois de responder.
- [ ] **Step 2–4.**
- [ ] **Step 5:** CSS **sem hexadecimal** — `pnpm catalogo` reprova. Commit —
      `feat(site): predição antes da revelação, neutra de domínio`

---

### Task 11: a ilha e a página

**Files:**
- Create: `apps/site/src/components/ProvidersLab.tsx`, `ProvidersLab.css`
- Create: `apps/site/src/pages/labs/providers.astro`

Molde: `MicroLab.tsx` e `micro.astro`. Não inventar arranjo novo.

- [ ] **Step 1:** o pipeline em `useMemo` — `params → spec = otelWorld(params) → arvore =
      indexTree(spec.root) → mundo = new World(spec)`; o histórico é do lab, não do `World`.
- [ ] **Step 2:** `<Explorer views={OTEL_VIEWS} inicial="otel-process" comFicha descricoes={DESCRICOES} …/>`
      no palco; `readouts` montado de `estadoOtel`, **nunca** de `state.nodes`.
- [ ] **Step 3:** controles: razão de amostragem, `maxQueueSize`, `scheduledDelay`,
      `exportInterval`, `trace_based`, e os dois botões de cenário (`flush` e `no SDK`).
      Parâmetro no L0; composição, se um dia houver, no L1 — spec do handbook §4.
- [ ] **Step 4:** a página, na espinha de seis seções da spec do handbook §6, com a peça de
      predição em *Break it*. `client:only="react"`. Importar
      `@ovh/depth-ui/src/stage.css` na página.
- [ ] **Step 5: Commit** — `feat(site): o lab dos provedores`

---

### Task 12: o espaguete e o e2e

**Files:**
- Create: `apps/site/tests/providers-lab.spec.ts`
- Modify: o teste de espaguete, se ele enumerar labs

- [ ] a página carrega, a ilha hidrata, o tick anda
- [ ] descer do processo até a fila e voltar mantém o tick — **descer nunca reinicia**
- [ ] o espaguete do lab novo fica dentro do teto, com zero sobreposição cega
- [ ] Commit — `test(site): e2e e espaguete do lab dos provedores`

---

## Bloco D — o handbook

### Task 13: o mapa

**Files:**
- Modify: `apps/site/src/data/roadmap.ts`, `docs/roadmap.md`

- [ ] **Step 1:** o nó `providers` na fase 3, esquerda, `y = 434`, `status: "available"`,
      `href: "labs/providers"`
- [ ] **Step 2:** `collector-pipeline` e `agent-or-gateway` para `y = 490`; o anexo
      `grpc-http2` para 490
- [ ] **Step 3:** fase 4 e tudo abaixo `+56`; `MAP_HEIGHT` 870 → 926; `spineBottom` idem
- [ ] **Step 4:** rodar o teste de sobreposição do mapa. Se reprovar, **o layout muda**
- [ ] **Step 5:** `storageKey` **não** muda (`ovh:progress:v1`) — mudar apagaria o progresso
      de quem já leu. Está escrito no próprio arquivo; respeitar
- [ ] Commit — `feat(site): o lab dos provedores entra na fase 3 do mapa`

### Task 14: o artigo

- [ ] O artigo da fase 3 é `who-owns-the-pipeline`, e ele já está declarado como `coming`.
      Este lab é o par dele. Escrever, em **inglês**, com toda afirmação ancorada na §11 da
      spec de desenho, e virar o `status` para `available` com `href`
- [ ] Item pronto tem link; item por escrever **não tem**. Há teste dos dois lados
- [ ] Commit — `docs(site): o artigo who-owns-the-pipeline`

---

## Bloco E — a contraparte real

Princípio 3 da spec do handbook: **todo lab tem contraparte real.** Sem isto o lab não está
pronto, e as fixtures daqui é que provam que a simulação não mente.

### Task 15: `labs/providers/`

- [ ] **Step 1:** `compose.yaml` com um app instrumentado, um Collector com exportador de
      debug, e nada mais. Duas variáveis para o leitor mexer: `OTEL_TRACES_SAMPLER_ARG` e
      `OTEL_BSP_SCHEDULE_DELAY`
- [ ] **Step 2:** capturar OTLP real dela e guardar como fixture
- [ ] **Step 3:** o teste de `otel-domain` que compara o nosso envelope com a fixture, campo
      por campo. É a garantia mecânica do princípio 2 — se a spec mudar, este teste quebra
- [ ] **Step 4:** `README.md` com o que observar e o que **não** dá para ver ali
- [ ] **Step 5: Commit** — `feat(labs): a contraparte real dos provedores, e a fixture OTLP`

> ⚠️ **Repositório público.** Zero conteúdo interno: sem IP, sem host de intranet, sem nome
> de sistema interno, sem configuração real de coletor de produção. Se o compose espelhar
> um padrão nosso, generalizar antes.

---

## Bloco F — fechar a rodada

### Task 16: `docs/authoring.md` deixa de mentir

Achado medido em 31/08/2026: `authoring.md` manda escrever `Scenario<S>` em
`apps/site/src/labs/<slug>/scenario.ts`, e `depth-core/src/index.ts` marca esse modelo como
*"andaime até a S5 migrar a landing. NÃO usar em código novo"*. O guia é a **interface
pública** do projeto (`DECISIONS.md` §8.3): um handbook escrito por outra pessoa é o teste
de "ser base para outros handbooks", e hoje essa pessoa seria mandada para uma API
proibida.

- [ ] **Step 1:** reescrever "Writing a scenario" para o motor composicional: `WorldSpec`,
      `View`, `estadoDe`, e o esqueleto de arquivos deste plano
- [ ] **Step 2:** acrescentar o campo dos mal-entendidos e a predição ao molde de página
- [ ] **Step 3:** a seção do L2 opaco: como declarar não modelado sem parecer defeito
- [ ] Commit — `docs: authoring.md passa a descrever o motor que existe`

### Task 17: o registro

- [ ] `docs/PROGRESS.md` com o round, e os cinco retornos de motor da §12 da spec
- [ ] `docs/DECISIONS.md`: a decisão aberta nº 4 (ordem da trilha) passa a ter resposta —
      uma árvore, quatro raízes —, e a nº 6 (como o opaco aparece) passa a ter um caso real
- [ ] Commit — `docs: o registro do round dos provedores`

---

## Os portões — rodar nesta ordem, da raiz

```bash
pnpm install --frozen-lockfile
pnpm boundaries      # ← o que mais provavelmente vai reprovar. Ver abaixo
pnpm catalogo        # hexadecimal no CSS do lab reprova aqui
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @ovh/site test:e2e
```

**`pnpm boundaries` é o portão perigoso deste round.** Ele proíbe, em `depth-core`,
`depth-ui` e `model-format`, as palavras `otel`, `otlp`, `opentelemetry`, `traceparent`,
`collector`, `tracerprovider`, `spanprocessor`, `batchspanprocessor`, `spanexporter`,
`sampler`, `spanid`, `traceid`, `grpc`, `protobuf`, `w3c` e mais — **incluindo em
comentário e em CSS**. Este é o primeiro round em que o vocabulário proibido é exatamente o
vocabulário do trabalho, então:

- se uma primitiva visual faltar, ela entra em `depth-ui` **em termos neutros de domínio**.
  A placa é `plate`, não "resource"; a porta do meio é uma porta, não "record-only"
- `[data-kind="X"]` em pacote agnóstico só vale se `X` for um `Kind` do motor. Espécie de
  **mensagem** é palavra de domínio: usa-se `especieDaCarga`
- o próprio `depth-ui/src/kinds.ts` já foi pego pela guarda por *citar* palavra proibida
  como exemplo. Ela está certa: a regra é sobre o texto

---

## Auto-revisão do plano

**Onde este plano pode dar errado, e o que fazer:**

1. **A linha de controle entre providers irmãos** (Task 4). Risco menor do que parecia:
   `validate.ts` só exige `toPort` e destino que age, e não restringe por subárvore. Se
   ainda assim recusar, é Task 4b **no motor** — não contorno no domínio. Se o motor
   estiver certo e a linha for ilegítima, então D5 cai e o `trace_based` passa a ser
   parâmetro em vez de linha; nesse caso o fenômeno fica mais fraco e isso tem de estar
   escrito, porque foi perda
2. **O LOD não deixa as três molduras abrirem em `otel-process`** (Task 9). Sai no teste.
   Muda-se o layout; se nenhum layout couber, o L1 vira três views irmãs em vez de uma com
   três molduras, e a comparação por superposição continua valendo
3. **Cardinalidade estoura o browser** se o `store` instanciar ponto por medição. Peso, não
   partícula — `depth.md` §5
4. **O envelope divergir da fixture real** (Task 15). É o melhor resultado ruim possível:
   significa que o modelo estava mentindo e o teste pegou. Corrige-se o modelo, não a
   fixture
5. **O round crescer.** Cinco fenômenos, seis views, cinco blocos. Se o bloco C não estiver
   fechado com A e B verdes, **para e abre PR só de A + B** — o modelo com testes já é
   entrega, e o modelo de investimento do projeto é bloco fechado, não trabalho longo em
   aberto

**O que este plano deliberadamente não faz:** interior do canal, payload de métrica e de
log no L3, segundo processador na pipeline, retry no exportador, `.model.yaml`. Os motivos
estão na §10 da spec de desenho, e nenhum deles é "não deu tempo".
