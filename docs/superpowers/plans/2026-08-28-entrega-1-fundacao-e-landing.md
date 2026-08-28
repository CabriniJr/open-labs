# OTel Visual Handbook — Entrega 1 (Fundação e Landing) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o monorepo funcionando, o design system derivado do canvas, e a landing page do OTel Visual Handbook publicada no GitHub Pages com uma simulação real (não vídeo) rodando no hero sobre o motor de profundidade.

**Architecture:** Monorepo pnpm com três pacotes e um app. `depth-core` é o motor determinístico e **agnóstico de domínio** (não pode mencionar OpenTelemetry); `otel-domain` é o adaptador que contém todo o conhecimento de OTel; `depth-ui` são as primitivas visuais React, também agnósticas; `apps/site` é o Astro que consome os três. A fronteira entre motor e domínio é imposta por um script no CI, não por disciplina. Toda simulação é uma função pura `step(state) → state` sobre um clock com seed, o que torna rebobinar exato e o comportamento testável sem pixels.

**Tech Stack:** pnpm workspaces, TypeScript estrito, Vitest, Astro 5 + ilhas React 19, CSS puro com custom properties (sem Tailwind — a direção editorial pede tipografia e grid próprios, e utility-first empurra pro visual genérico que estamos evitando), Playwright, GitHub Actions → GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-08-28-otel-visual-handbook-design.md`

---

## Estrutura de arquivos

Criados nesta entrega:

| Caminho | Responsabilidade |
|---|---|
| `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json` | raiz do monorepo |
| `packages/depth-core/src/random.ts` | RNG determinístico com seed |
| `packages/depth-core/src/types.ts` | `Scenario`, `StepContext`, `LevelId` |
| `packages/depth-core/src/engine.ts` | `Engine`: avançar, rebobinar por replay, cache de histórico |
| `packages/depth-core/src/diff.ts` | `diffStates`: caminhos que mudaram entre dois estados |
| `packages/depth-core/src/index.ts` | superfície pública do motor |
| `packages/otel-domain/src/traceparent.ts` | parse/format do header W3C |
| `packages/otel-domain/src/otlp.ts` | tipos OTLP e serialização JSON |
| `packages/otel-domain/src/index.ts` | superfície pública do adaptador |
| `packages/depth-ui/src/*.tsx` | `DepthShell`, `FlowNode`, `Wire`, `Inspector`, `Timeline` |
| `apps/site/src/styles/tokens.css` | tokens derivados do canvas de design |
| `apps/site/src/labs/hero/scenario.ts` | o cenário do hero (topologia, níveis, step) |
| `apps/site/src/components/HeroSim.tsx` | a ilha React do hero |
| `apps/site/src/pages/index.astro` | a landing |
| `scripts/check-boundaries.mjs` | guarda da fronteira motor↔domínio |
| `.github/workflows/ci.yml`, `deploy.yml` | CI e deploy |
| `docs/authoring.md` | o pipeline docs → modelo didático |

---

### Task 1: Scaffold do monorepo

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `vitest.workspace.ts`, `.gitignore`, `.nvmrc`

- [ ] **Step 1: Criar a raiz do workspace**

`package.json`:

```json
{
  "name": "otel-visual-handbook",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@9.12.0",
  "scripts": {
    "typecheck": "tsc -b --pretty false",
    "test": "vitest run",
    "boundaries": "node scripts/check-boundaries.mjs",
    "build": "pnpm --filter @ovh/site build",
    "dev": "pnpm --filter @ovh/site dev"
  },
  "devDependencies": {
    "@testing-library/react": "^16.1.0",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^25.0.1",
    "typescript": "^5.6.3",
    "vitest": "^2.1.4"
  }
}
```

`vitest.workspace.ts` — dois projetos, porque só o `depth-ui` precisa de DOM:

```ts
import react from "@vitejs/plugin-react";
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      name: "node",
      environment: "node",
      include: [
        "packages/depth-core/src/**/*.test.ts",
        "packages/otel-domain/src/**/*.test.ts",
        "apps/site/src/**/*.test.ts",
        "scripts/**/*.test.mjs",
      ],
    },
  },
  {
    plugins: [react()],
    test: {
      name: "dom",
      environment: "jsdom",
      include: ["packages/depth-ui/src/**/*.test.tsx"],
    },
  },
]);
```

Os pacotes do workspace apontam `main` para `src/index.ts`, então o Vitest e o
Vite compilam o TypeScript deles direto da fonte. Se algum import de
`@ovh/*` falhar a resolução, a correção é adicionar
`resolve: { preserveSymlinks: false }` ao projeto — não copiar código entre
pacotes.

`pnpm-workspace.yaml`:

```yaml
packages:
  - "packages/*"
  - "apps/*"
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "declaration": true,
    "composite": true,
    "jsx": "react-jsx"
  }
}
```

`.nvmrc`:

```
22
```

`.gitignore`:

```
node_modules/
dist/
.astro/
tsconfig.tsbuildinfo
*.tsbuildinfo
test-results/
playwright-report/
.DS_Store
```

- [ ] **Step 2: Instalar e verificar**

Run: `pnpm install`
Expected: instala sem erro, cria `pnpm-lock.yaml`.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json vitest.workspace.ts .gitignore .nvmrc pnpm-lock.yaml
git commit -m "chore: scaffold do monorepo pnpm"
```

---

### Task 2: depth-core — RNG determinístico

O motor precisa de aleatoriedade (latências variando, requisições chegando) sem perder determinismo. `Math.random` tornaria impossível rebobinar.

**Files:**
- Create: `packages/depth-core/package.json`, `packages/depth-core/tsconfig.json`, `packages/depth-core/src/random.ts`
- Test: `packages/depth-core/src/random.test.ts`

- [ ] **Step 1: Criar o pacote**

`packages/depth-core/package.json`:

```json
{
  "name": "@ovh/depth-core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run"
  }
}
```

`packages/depth-core/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

- [ ] **Step 2: Escrever o teste que falha**

`packages/depth-core/src/random.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createRandom } from "./random.js";

describe("createRandom", () => {
  it("produz a mesma sequência para a mesma seed", () => {
    const a = createRandom(42);
    const b = createRandom(42);
    const seqA = [a(), a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("produz sequências diferentes para seeds diferentes", () => {
    const a = createRandom(1);
    const b = createRandom(2);
    expect(a()).not.toEqual(b());
  });

  it("produz valores no intervalo [0, 1)", () => {
    const r = createRandom(7);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `pnpm vitest run packages/depth-core/src/random.test.ts`
Expected: FAIL — `Failed to resolve import "./random.js"`.

- [ ] **Step 4: Implementar**

`packages/depth-core/src/random.ts`:

```ts
/**
 * Gerador determinístico (mulberry32). A mesma seed produz sempre a mesma
 * sequência — é o que torna rebobinar uma simulação exato em vez de aproximado.
 */
export function createRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `pnpm vitest run packages/depth-core/src/random.test.ts`
Expected: PASS, 3 testes.

- [ ] **Step 6: Commit**

```bash
git add packages/depth-core
git commit -m "feat(depth-core): RNG deterministico com seed"
```

---

### Task 3: depth-core — Scenario e Engine

**Decisão de design registrada aqui:** mudar um input **reinicia** a simulação no tick 0 com os novos inputs. Não há linha do tempo de inputs. Isso mantém `seek(t)` como um replay puro desde o zero — exato por construção — e é pedagogicamente correto: o leitor mexe num controle e vê o cenário inteiro rodar de novo sob a nova condição.

**Files:**
- Create: `packages/depth-core/src/types.ts`, `packages/depth-core/src/engine.ts`
- Test: `packages/depth-core/src/engine.test.ts`

- [ ] **Step 1: Escrever os tipos**

`packages/depth-core/src/types.ts`:

```ts
/** Um nível de profundidade. O motor não sabe o que cada um significa. */
export type LevelId = "flow" | "mechanism" | "wire" | "payload";

export interface StepContext {
  /** Tick que está sendo calculado, começando em 1. */
  readonly tick: number;
  /** Aleatoriedade com seed. Determinística dentro de um replay. */
  readonly random: () => number;
  /** Valores dos controles expostos ao leitor. Constantes durante um replay. */
  readonly inputs: Readonly<Record<string, number | string | boolean>>;
}

export interface Scenario<S> {
  readonly id: string;
  readonly seed: number;
  /** Níveis que este cenário implementa. Nem todo cenário tem os quatro. */
  readonly levels: readonly LevelId[];
  readonly initialState: (inputs: StepContext["inputs"]) => S;
  /** Função pura: nunca muta `state`, sempre devolve um novo. */
  readonly step: (state: S, ctx: StepContext) => S;
}
```

- [ ] **Step 2: Escrever o teste que falha**

`packages/depth-core/src/engine.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Engine } from "./engine.js";
import type { Scenario } from "./types.js";

interface Counter {
  value: number;
  noise: number;
}

const counter: Scenario<Counter> = {
  id: "counter",
  seed: 99,
  levels: ["flow"],
  initialState: (inputs) => ({ value: Number(inputs.start ?? 0), noise: 0 }),
  step: (state, ctx) => ({
    value: state.value + 1,
    noise: ctx.random(),
  }),
};

describe("Engine", () => {
  it("começa no tick 0 com o estado inicial", () => {
    const e = new Engine(counter, { start: 10 });
    expect(e.tick).toBe(0);
    expect(e.state.value).toBe(10);
  });

  it("avança um tick por vez", () => {
    const e = new Engine(counter, {});
    e.advance();
    e.advance();
    expect(e.tick).toBe(2);
    expect(e.state.value).toBe(2);
  });

  it("é determinístico: mesma seed, mesmo estado no tick N", () => {
    const a = new Engine(counter, {});
    const b = new Engine(counter, {});
    a.advance(10);
    b.advance(10);
    expect(a.state).toEqual(b.state);
  });

  it("rebobinar devolve exatamente o estado que havia naquele tick", () => {
    const e = new Engine(counter, {});
    e.advance(5);
    const at5 = structuredClone(e.state);
    e.advance(5);
    e.seek(5);
    expect(e.tick).toBe(5);
    expect(e.state).toEqual(at5);
  });

  it("não muta o estado anterior ao avançar", () => {
    const e = new Engine(counter, {});
    const before = e.state;
    e.advance();
    expect(before.value).toBe(0);
  });

  it("trocar inputs reinicia no tick 0 com o novo estado inicial", () => {
    const e = new Engine(counter, { start: 0 });
    e.advance(3);
    e.setInputs({ start: 100 });
    expect(e.tick).toBe(0);
    expect(e.state.value).toBe(100);
  });

  it("expõe os níveis declarados pelo cenário", () => {
    const e = new Engine(counter, {});
    expect(e.levels).toEqual(["flow"]);
  });
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `pnpm vitest run packages/depth-core/src/engine.test.ts`
Expected: FAIL — `Failed to resolve import "./engine.js"`.

- [ ] **Step 4: Implementar**

`packages/depth-core/src/engine.ts`:

```ts
import { createRandom } from "./random.js";
import type { LevelId, Scenario, StepContext } from "./types.js";

/**
 * Executa um cenário. Mantém o histórico completo desde o tick 0, o que torna
 * `seek` exato: rebobinar é reler o histórico, não recalcular por aproximação.
 */
export class Engine<S> {
  readonly levels: readonly LevelId[];

  #scenario: Scenario<S>;
  #inputs: StepContext["inputs"];
  #history: S[];
  #tick = 0;

  constructor(scenario: Scenario<S>, inputs: StepContext["inputs"] = {}) {
    this.#scenario = scenario;
    this.#inputs = inputs;
    this.levels = scenario.levels;
    this.#history = [scenario.initialState(inputs)];
  }

  get tick(): number {
    return this.#tick;
  }

  get state(): Readonly<S> {
    return this.#at(this.#tick);
  }

  /** Estado em um tick já computado. Lança se o tick ainda não existe. */
  #at(tick: number): Readonly<S> {
    const s = this.#history[tick];
    if (s === undefined) {
      throw new Error(`Engine: tick ${tick} ainda não foi computado`);
    }
    return s;
  }

  /** Garante que o histórico chega até `tick`, computando o que faltar. */
  #ensure(tick: number): void {
    while (this.#history.length <= tick) {
      const nextTick = this.#history.length;
      const previous = this.#at(nextTick - 1);
      // Recria o RNG e o consome até `nextTick` para que o valor sorteado em
      // cada tick dependa só da seed e do número do tick — nunca da ordem em
      // que o leitor navegou pela linha do tempo.
      const random = createRandom(this.#scenario.seed + nextTick);
      this.#history.push(
        this.#scenario.step(previous, {
          tick: nextTick,
          random,
          inputs: this.#inputs,
        }),
      );
    }
  }

  advance(n = 1): void {
    this.seek(this.#tick + n);
  }

  seek(tick: number): void {
    const target = Math.max(0, Math.trunc(tick));
    this.#ensure(target);
    this.#tick = target;
  }

  /** Trocar inputs invalida o histórico: a simulação recomeça do tick 0. */
  setInputs(inputs: StepContext["inputs"]): void {
    this.#inputs = inputs;
    this.#history = [this.#scenario.initialState(inputs)];
    this.#tick = 0;
  }

  /** Estado imediatamente anterior ao tick atual, ou `undefined` no tick 0. */
  get previousState(): Readonly<S> | undefined {
    return this.#tick === 0 ? undefined : this.#at(this.#tick - 1);
  }
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `pnpm vitest run packages/depth-core/src/engine.test.ts`
Expected: PASS, 7 testes.

- [ ] **Step 6: Commit**

```bash
git add packages/depth-core
git commit -m "feat(depth-core): Scenario e Engine com replay exato"
```

---

### Task 4: depth-core — diff entre estados

É o que alimenta a mecânica de **mutação destacada** da spec §4: sem saber quais campos mudaram, não há o que piscar na tela.

**Files:**
- Create: `packages/depth-core/src/diff.ts`
- Test: `packages/depth-core/src/diff.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

`packages/depth-core/src/diff.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { diffStates } from "./diff.js";

describe("diffStates", () => {
  it("devolve vazio para estados iguais", () => {
    expect(diffStates({ a: 1 }, { a: 1 })).toEqual([]);
  });

  it("aponta o caminho de um campo escalar alterado", () => {
    expect(diffStates({ a: 1, b: 2 }, { a: 1, b: 3 })).toEqual(["b"]);
  });

  it("desce em objetos aninhados", () => {
    const before = { span: { attributes: { code: 200 } } };
    const after = { span: { attributes: { code: 500 } } };
    expect(diffStates(before, after)).toEqual(["span.attributes.code"]);
  });

  it("indexa elementos de array", () => {
    expect(diffStates({ xs: [1, 2, 3] }, { xs: [1, 9, 3] })).toEqual(["xs.1"]);
  });

  it("reporta campos adicionados e removidos", () => {
    expect(diffStates({ a: 1 }, { a: 1, b: 2 })).toEqual(["b"]);
    expect(diffStates({ a: 1, b: 2 }, { a: 1 })).toEqual(["b"]);
  });

  it("reporta o array inteiro quando o tamanho muda no fim", () => {
    expect(diffStates({ xs: [1] }, { xs: [1, 2] })).toEqual(["xs.1"]);
  });

  it("trata troca de tipo como alteração", () => {
    expect(diffStates({ a: 1 }, { a: "1" })).toEqual(["a"]);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm vitest run packages/depth-core/src/diff.test.ts`
Expected: FAIL — `Failed to resolve import "./diff.js"`.

- [ ] **Step 3: Implementar**

`packages/depth-core/src/diff.ts`:

```ts
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Caminhos (em notação de ponto) que diferem entre dois estados.
 * Alimenta o destaque de mutação: o leitor aprende no delta, não no estado final.
 */
export function diffStates(before: unknown, after: unknown, path = ""): string[] {
  if (Object.is(before, after)) return [];

  const bothArrays = Array.isArray(before) && Array.isArray(after);
  const bothRecords = isRecord(before) && isRecord(after);

  if (bothArrays) {
    const paths: string[] = [];
    const len = Math.max(before.length, after.length);
    for (let i = 0; i < len; i++) {
      paths.push(...diffStates(before[i], after[i], path ? `${path}.${i}` : String(i)));
    }
    return paths;
  }

  if (bothRecords) {
    const paths: string[] = [];
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      paths.push(...diffStates(before[key], after[key], path ? `${path}.${key}` : key));
    }
    return paths;
  }

  return [path];
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm vitest run packages/depth-core/src/diff.test.ts`
Expected: PASS, 7 testes.

- [ ] **Step 5: Commit**

```bash
git add packages/depth-core
git commit -m "feat(depth-core): diff de estados para destaque de mutacao"
```

---

### Task 5: depth-core — superfície pública

**Files:**
- Create: `packages/depth-core/src/index.ts`

- [ ] **Step 1: Escrever o barrel**

`packages/depth-core/src/index.ts`:

```ts
export { Engine } from "./engine.js";
export { diffStates } from "./diff.js";
export { createRandom } from "./random.js";
export type { LevelId, Scenario, StepContext } from "./types.js";
```

- [ ] **Step 2: Verificar tipos**

Run: `pnpm --filter @ovh/depth-core exec tsc --noEmit -p tsconfig.json`
Expected: sem saída (sucesso).

- [ ] **Step 3: Commit**

```bash
git add packages/depth-core/src/index.ts
git commit -m "feat(depth-core): superficie publica do pacote"
```

---

### Task 6: otel-domain — W3C traceparent

O primeiro pedaço de OpenTelemetry de verdade. Formato: `00-<32 hex traceId>-<16 hex spanId>-<2 hex flags>`. Referência: https://www.w3.org/TR/trace-context/

**Files:**
- Create: `packages/otel-domain/package.json`, `packages/otel-domain/tsconfig.json`, `packages/otel-domain/src/traceparent.ts`
- Test: `packages/otel-domain/src/traceparent.test.ts`

- [ ] **Step 1: Criar o pacote**

`packages/otel-domain/package.json`:

```json
{
  "name": "@ovh/otel-domain",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "@ovh/depth-core": "workspace:*"
  }
}
```

`packages/otel-domain/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

Run: `pnpm install`

- [ ] **Step 2: Escrever o teste que falha**

`packages/otel-domain/src/traceparent.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatTraceparent, parseTraceparent } from "./traceparent.js";

const VALID = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";

describe("parseTraceparent", () => {
  it("extrai traceId, spanId e o bit de amostragem", () => {
    expect(parseTraceparent(VALID)).toEqual({
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      spanId: "00f067aa0ba902b7",
      sampled: true,
    });
  });

  it("lê sampled=false quando o bit está desligado", () => {
    const header = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00";
    expect(parseTraceparent(header)?.sampled).toBe(false);
  });

  it("rejeita header com número errado de partes", () => {
    expect(parseTraceparent("00-abc-def")).toBeNull();
  });

  it("rejeita traceId com tamanho errado", () => {
    expect(parseTraceparent("00-4bf92f-00f067aa0ba902b7-01")).toBeNull();
  });

  it("rejeita traceId só de zeros", () => {
    const header = "00-00000000000000000000000000000000-00f067aa0ba902b7-01";
    expect(parseTraceparent(header)).toBeNull();
  });

  it("rejeita spanId só de zeros", () => {
    const header = "00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01";
    expect(parseTraceparent(header)).toBeNull();
  });

  it("rejeita caracteres fora de hexadecimal", () => {
    const header = "00-4bf92f3577b34da6a3ce929d0e0e473g-00f067aa0ba902b7-01";
    expect(parseTraceparent(header)).toBeNull();
  });

  it("rejeita versão desconhecida", () => {
    const header = "99-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
    expect(parseTraceparent(header)).toBeNull();
  });
});

describe("formatTraceparent", () => {
  it("reconstrói o header a partir do contexto", () => {
    expect(
      formatTraceparent({
        traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
        spanId: "00f067aa0ba902b7",
        sampled: true,
      }),
    ).toBe(VALID);
  });

  it("faz round-trip com parse", () => {
    const parsed = parseTraceparent(VALID);
    expect(parsed).not.toBeNull();
    expect(formatTraceparent(parsed!)).toBe(VALID);
  });
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `pnpm vitest run packages/otel-domain/src/traceparent.test.ts`
Expected: FAIL — `Failed to resolve import "./traceparent.js"`.

- [ ] **Step 4: Implementar**

`packages/otel-domain/src/traceparent.ts`:

```ts
export interface TraceContext {
  /** 32 dígitos hexadecimais, nunca só zeros. */
  readonly traceId: string;
  /** 16 dígitos hexadecimais, nunca só zeros. */
  readonly spanId: string;
  readonly sampled: boolean;
}

const HEX = /^[0-9a-f]+$/;

function isHexOfLength(value: string, length: number): boolean {
  return value.length === length && HEX.test(value) && !/^0+$/.test(value);
}

/**
 * Lê um header `traceparent` do W3C Trace Context.
 * Devolve `null` para qualquer header inválido — é exatamente esse `null` que
 * o lab "Anatomy of a Trace" mostra virando um span órfão.
 * Spec: https://www.w3.org/TR/trace-context/#traceparent-header
 */
export function parseTraceparent(header: string): TraceContext | null {
  const parts = header.trim().split("-");
  if (parts.length !== 4) return null;

  const [version, traceId, spanId, flags] = parts as [string, string, string, string];
  if (version !== "00") return null;
  if (!isHexOfLength(traceId, 32)) return null;
  if (!isHexOfLength(spanId, 16)) return null;
  if (flags.length !== 2 || !HEX.test(flags)) return null;

  return { traceId, spanId, sampled: (Number.parseInt(flags, 16) & 0x01) === 0x01 };
}

export function formatTraceparent(context: TraceContext): string {
  const flags = context.sampled ? "01" : "00";
  return `00-${context.traceId}-${context.spanId}-${flags}`;
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `pnpm vitest run packages/otel-domain/src/traceparent.test.ts`
Expected: PASS, 10 testes.

- [ ] **Step 6: Commit**

```bash
git add packages/otel-domain
git commit -m "feat(otel-domain): parse e format do header W3C traceparent"
```

---

### Task 7: otel-domain — tipos OTLP e serialização JSON

O que o L3 (Payload) exibe. Segue a codificação JSON do OTLP: `traceId`/`spanId` em hex, timestamps como string de nanossegundos.
Referência: https://opentelemetry.io/docs/specs/otlp/#json-protobuf-encoding

**Files:**
- Create: `packages/otel-domain/src/otlp.ts`, `packages/otel-domain/src/index.ts`
- Test: `packages/otel-domain/src/otlp.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

`packages/otel-domain/src/otlp.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { attribute, toOtlpJson } from "./otlp.js";
import type { OtelSpan } from "./otlp.js";

const span: OtelSpan = {
  traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
  spanId: "00f067aa0ba902b7",
  name: "GET /checkout",
  kind: 2,
  startTimeUnixNano: "1700000000000000000",
  endTimeUnixNano: "1700000000120000000",
  attributes: [attribute("http.response.status_code", 200)],
};

describe("attribute", () => {
  it("codifica string como stringValue", () => {
    expect(attribute("http.request.method", "GET")).toEqual({
      key: "http.request.method",
      value: { stringValue: "GET" },
    });
  });

  it("codifica inteiro como intValue em string", () => {
    expect(attribute("http.response.status_code", 200)).toEqual({
      key: "http.response.status_code",
      value: { intValue: "200" },
    });
  });

  it("codifica booleano como boolValue", () => {
    expect(attribute("error", true)).toEqual({
      key: "error",
      value: { boolValue: true },
    });
  });
});

describe("toOtlpJson", () => {
  it("envolve os spans em resourceSpans/scopeSpans", () => {
    const payload = toOtlpJson(
      { attributes: [attribute("service.name", "checkout")] },
      [span],
    );

    expect(payload.resourceSpans).toHaveLength(1);
    const resourceSpan = payload.resourceSpans[0]!;
    expect(resourceSpan.resource.attributes[0]!.key).toBe("service.name");
    expect(resourceSpan.scopeSpans[0]!.spans).toEqual([span]);
  });

  it("mantém o parentSpanId ausente quando o span é raiz", () => {
    const payload = toOtlpJson({ attributes: [] }, [span]);
    expect(payload.resourceSpans[0]!.scopeSpans[0]!.spans[0]).not.toHaveProperty(
      "parentSpanId",
    );
  });

  it("preserva o parentSpanId de um span filho", () => {
    const child: OtelSpan = { ...span, spanId: "aaf067aa0ba902b7", parentSpanId: span.spanId };
    const payload = toOtlpJson({ attributes: [] }, [child]);
    expect(payload.resourceSpans[0]!.scopeSpans[0]!.spans[0]!.parentSpanId).toBe(
      "00f067aa0ba902b7",
    );
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm vitest run packages/otel-domain/src/otlp.test.ts`
Expected: FAIL — `Failed to resolve import "./otlp.js"`.

- [ ] **Step 3: Implementar**

`packages/otel-domain/src/otlp.ts`:

```ts
export interface AnyValue {
  readonly stringValue?: string;
  readonly intValue?: string;
  readonly boolValue?: boolean;
}

export interface KeyValue {
  readonly key: string;
  readonly value: AnyValue;
}

/** SpanKind do OTLP: 1 INTERNAL, 2 SERVER, 3 CLIENT, 4 PRODUCER, 5 CONSUMER. */
export type SpanKind = 1 | 2 | 3 | 4 | 5;

export interface OtelSpan {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly name: string;
  readonly kind: SpanKind;
  readonly startTimeUnixNano: string;
  readonly endTimeUnixNano: string;
  readonly attributes: readonly KeyValue[];
}

export interface OtelResource {
  readonly attributes: readonly KeyValue[];
}

export interface ScopeSpans {
  readonly scope: { readonly name: string };
  readonly spans: readonly OtelSpan[];
}

export interface ResourceSpans {
  readonly resource: OtelResource;
  readonly scopeSpans: readonly ScopeSpans[];
}

export interface ExportTraceServiceRequest {
  readonly resourceSpans: readonly ResourceSpans[];
}

/** Codifica um atributo no formato AnyValue do OTLP/JSON. */
export function attribute(key: string, value: string | number | boolean): KeyValue {
  if (typeof value === "string") return { key, value: { stringValue: value } };
  if (typeof value === "boolean") return { key, value: { boolValue: value } };
  return { key, value: { intValue: String(Math.trunc(value)) } };
}

export function toOtlpJson(
  resource: OtelResource,
  spans: readonly OtelSpan[],
  scopeName = "otel-visual-handbook",
): ExportTraceServiceRequest {
  return {
    resourceSpans: [{ resource, scopeSpans: [{ scope: { name: scopeName }, spans }] }],
  };
}
```

`packages/otel-domain/src/index.ts`:

```ts
export { formatTraceparent, parseTraceparent } from "./traceparent.js";
export type { TraceContext } from "./traceparent.js";
export { attribute, toOtlpJson } from "./otlp.js";
export type {
  AnyValue,
  ExportTraceServiceRequest,
  KeyValue,
  OtelResource,
  OtelSpan,
  ResourceSpans,
  ScopeSpans,
  SpanKind,
} from "./otlp.js";
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm vitest run packages/otel-domain`
Expected: PASS, 16 testes no total do pacote.

- [ ] **Step 5: Commit**

```bash
git add packages/otel-domain
git commit -m "feat(otel-domain): tipos OTLP e serializacao JSON"
```

---

### Task 8: A guarda da fronteira motor↔domínio

Princípio 5 da spec, imposto por máquina. Duas checagens: dependência estrutural e vocabulário.

**Nota sobre o vocabulário:** a lista proíbe apenas termos inequívocos de OpenTelemetry. `span` sozinho está **fora** da lista de propósito — `depth-ui` legitimamente renderiza elementos `<span>` em HTML, e uma regra que quebra com isso seria desligada na primeira semana.

**Files:**
- Create: `scripts/check-boundaries.mjs`
- Test: `scripts/check-boundaries.test.mjs`

- [ ] **Step 1: Escrever o teste que falha**

`scripts/check-boundaries.test.mjs`:

```js
import { describe, expect, it } from "vitest";
import { findViolations } from "./check-boundaries.mjs";

describe("findViolations", () => {
  it("aceita um arquivo agnóstico", () => {
    const source = "export function render(node) { return node.label; }";
    expect(findViolations("packages/depth-ui/src/Node.tsx", source)).toEqual([]);
  });

  it("permite elementos <span> em HTML/JSX", () => {
    const source = 'export const Label = () => <span className="label">x</span>;';
    expect(findViolations("packages/depth-ui/src/Label.tsx", source)).toEqual([]);
  });

  it("acusa import do pacote de domínio", () => {
    const source = 'import { parseTraceparent } from "@ovh/otel-domain";';
    const violations = findViolations("packages/depth-core/src/engine.ts", source);
    expect(violations).toHaveLength(1);
    expect(violations[0].reason).toContain("@ovh/otel-domain");
  });

  it("acusa vocabulário de domínio", () => {
    const source = "// o OTLP chega aqui\nexport const x = 1;";
    const violations = findViolations("packages/depth-core/src/engine.ts", source);
    expect(violations).toHaveLength(1);
    expect(violations[0].reason).toContain("otlp");
  });

  it("ignora arquivos fora dos pacotes agnósticos", () => {
    const source = 'import { parseTraceparent } from "@ovh/otel-domain";';
    expect(findViolations("apps/site/src/labs/hero/scenario.ts", source)).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm vitest run scripts/check-boundaries.test.mjs`
Expected: FAIL — não consegue resolver `./check-boundaries.mjs`.

- [ ] **Step 3: Implementar**

`scripts/check-boundaries.mjs`:

```js
#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { glob } from "node:fs/promises";

/** Pacotes que não podem conhecer domínio nenhum. */
const AGNOSTIC = ["packages/depth-core/", "packages/depth-ui/"];

/** Pacotes de domínio que eles não podem importar. */
const DOMAIN_PACKAGES = ["@ovh/otel-domain"];

/**
 * Termos inequívocos de OpenTelemetry. `span` e `trace` sozinhos ficam de fora
 * de propósito: `<span>` é HTML legítimo e "trace" aparece em "traceability".
 */
const DOMAIN_WORDS = [
  "otlp",
  "opentelemetry",
  "otel",
  "traceparent",
  "tracestate",
  "resourcespans",
  "scopespans",
  "spanid",
  "traceid",
  "collector",
];

export function findViolations(filePath, source) {
  if (!AGNOSTIC.some((prefix) => filePath.startsWith(prefix))) return [];

  const violations = [];

  for (const pkg of DOMAIN_PACKAGES) {
    if (source.includes(pkg)) {
      violations.push({ filePath, reason: `importa o pacote de domínio ${pkg}` });
    }
  }

  const lowered = source.toLowerCase();
  for (const word of DOMAIN_WORDS) {
    if (new RegExp(`\\b${word}\\b`).test(lowered)) {
      violations.push({ filePath, reason: `usa vocabulário de domínio "${word}"` });
    }
  }

  return violations;
}

async function main() {
  const all = [];
  for (const prefix of AGNOSTIC) {
    for await (const file of glob(`${prefix}src/**/*.{ts,tsx}`)) {
      all.push(...findViolations(file, readFileSync(file, "utf8")));
    }
  }

  if (all.length > 0) {
    console.error("Fronteira motor↔domínio violada (spec §8):\n");
    for (const v of all) console.error(`  ${v.filePath}: ${v.reason}`);
    console.error(
      "\nO motor não pode conhecer OpenTelemetry. Mova isso para packages/otel-domain.",
    );
    process.exit(1);
  }

  console.log("Fronteira motor↔domínio intacta.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm vitest run scripts/check-boundaries.test.mjs`
Expected: PASS, 5 testes.

- [ ] **Step 5: Rodar a checagem de verdade**

Run: `pnpm boundaries`
Expected: `Fronteira motor↔domínio intacta.`

- [ ] **Step 6: Commit**

```bash
git add scripts
git commit -m "feat(ci): guarda da fronteira entre motor e dominio"
```

---

### Task 9: App Astro e deploy no GitHub Pages

**Files:**
- Create: `apps/site/package.json`, `apps/site/astro.config.mjs`, `apps/site/tsconfig.json`, `apps/site/src/pages/index.astro`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`

- [ ] **Step 1: Criar o app**

`apps/site/package.json`:

```json
{
  "name": "@ovh/site",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview"
  },
  "dependencies": {
    "@astrojs/react": "^4.2.0",
    "@ovh/depth-core": "workspace:*",
    "@ovh/depth-ui": "workspace:*",
    "@ovh/otel-domain": "workspace:*",
    "astro": "^5.2.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0"
  }
}
```

`apps/site/astro.config.mjs`:

```js
import react from "@astrojs/react";
import { defineConfig } from "astro/config";

// GitHub Pages serve em /<repo>/ até existir domínio próprio.
export default defineConfig({
  site: "https://cabrinijr.github.io",
  base: "/otel-visual-handbook",
  integrations: [react()],
  build: { inlineStylesheets: "auto" },
});
```

`apps/site/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "astro.config.mjs"],
  "compilerOptions": { "jsxImportSource": "react", "noEmit": true }
}
```

`apps/site/src/pages/index.astro` (provisório, só para o build passar):

```astro
---
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>OTel Visual Handbook</title>
  </head>
  <body>
    <h1>OTel Visual Handbook</h1>
  </body>
</html>
```

Run: `pnpm install && pnpm build`
Expected: build gera `apps/site/dist/index.html`.

- [ ] **Step 2: CI**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm boundaries
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
```

- [ ] **Step 3: Deploy**

`.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: apps/site/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 4: Commit**

```bash
git add apps/site .github pnpm-lock.yaml
git commit -m "feat(site): scaffold Astro e workflows de CI e deploy"
```

---

### Task 10: Canvas de design e tokens

Esta task tem uma etapa humana: o canvas é revisado pelo Luigi antes dos tokens serem escritos. **Não escreva os tokens antes da aprovação do canvas** — a spec §7 diz explicitamente que o design system nasce do canvas, não o contrário.

**Files:**
- Create: `apps/site/src/styles/tokens.css`, `apps/site/src/styles/themes/otel.css`, `apps/site/src/styles/base.css`

- [ ] **Step 1: Produzir o canvas**

Usar a skill `design` para criar um canvas com quatro artboards:
1. **Landing (desktop)** — hero com a simulação, as 5 fases, o que é um lab, rodapé
2. **Landing (mobile 390px)** — mesma página, arranjo empilhado
3. **Página de lab (desktop)** — as 6 seções da spec §6, com L0 e o inspector lado a lado
4. **Escala de design** — tipografia, cores, espaçamento, a linguagem de diagrama

Direção obrigatória (spec §7): editorial técnico, fundo claro por padrão, grid com margem larga, serifada nos títulos, mono para dados, **uma** cor de acento, saturação só nos diagramas. Anti-alvos explícitos: gradiente roxo/azul, cards de vidro, raio de borda uniforme em tudo, ícones de biblioteca, hero centralizado com pílula de badge.

Ponto de partida tipográfico a propor no canvas (o canvas pode recusar): IBM Plex Serif nos títulos, IBM Plex Sans na prosa, IBM Plex Mono nos dados — coerente, técnico, e fora do default que faz um site parecer gerado.

- [ ] **Step 2: Aprovação humana do canvas**

Apresentar o canvas e esperar aprovação explícita antes de seguir.

- [ ] **Step 3: Escrever os tokens neutros derivados do canvas**

Duas camadas, conforme spec §7: o cromo editorial nunca muda entre tecnologias; o
tema de domínio pinta acento, sinal e logo — **nunca fundo, nunca tipografia**.

`apps/site/src/styles/tokens.css` (cromo editorial, neutro) — os valores abaixo são o **esqueleto**; substituir cada valor pelo que o canvas aprovado definir, mantendo os nomes:

```css
:root {
  /* Tipografia */
  --font-display: "IBM Plex Serif", Georgia, "Times New Roman", serif;
  --font-body: "IBM Plex Sans", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, "SF Mono", monospace;

  --size-step--1: clamp(0.83rem, 0.8rem + 0.15vw, 0.9rem);
  --size-step-0: clamp(1rem, 0.96rem + 0.2vw, 1.12rem);
  --size-step-1: clamp(1.25rem, 1.15rem + 0.5vw, 1.5rem);
  --size-step-2: clamp(1.6rem, 1.4rem + 1vw, 2.2rem);
  --size-step-3: clamp(2.1rem, 1.7rem + 2vw, 3.4rem);

  /* Tinta e papel — a página é sóbria de propósito */
  --ink: #14110f;
  --ink-muted: #5c554e;
  --paper: #faf7f2;
  --paper-raised: #ffffff;
  --rule: #ddd5c9;

  /* Ritmo */
  --space-1: 0.5rem;
  --space-2: 1rem;
  --space-3: 1.75rem;
  --space-4: 3rem;
  --space-5: 5rem;
  --measure: 68ch;
}

:root[data-theme="dark"] {
  --ink: #ece7e0;
  --ink-muted: #a09890;
  --paper: #16130f;
  --paper-raised: #1f1b16;
  --rule: #3a342c;
}
```

- [ ] **Step 4: Escrever o tema de domínio**

`apps/site/src/styles/themes/otel.css` — o único tema que existe hoje. Um
handbook futuro de outra tecnologia acrescenta um arquivo irmão e nada mais:

```css
/* Identidade do OpenTelemetry: acento e sinais. Nunca fundo, nunca tipografia. */
:root[data-domain="otel"] {
  --accent: #425cc7;

  /* Cor saturada vive só nos diagramas */
  --sig-flow: #425cc7;
  --sig-drop: #b8442a;
  --sig-ok: #3f7a52;
  --sig-mutation: #f5a800;

  --domain-name: "OpenTelemetry";
}

:root[data-domain="otel"][data-theme="dark"] {
  --accent: #8fa2ee;
}
```

O `<html>` carrega `data-domain="otel"` (definido no layout base, Task 14).
Nenhum componente pode referenciar `#425cc7` diretamente — só os tokens.

- [ ] **Step 5: Escrever a base**

`apps/site/src/styles/base.css`:

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: var(--size-step-0);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

h1,
h2,
h3 {
  font-family: var(--font-display);
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.01em;
  text-wrap: balance;
}

code,
pre,
.mono {
  font-family: var(--font-mono);
  font-size: 0.92em;
}

.prose {
  max-width: var(--measure);
}

/* Grid editorial: coluna de texto com margem larga para notas laterais. */
.editorial {
  display: grid;
  grid-template-columns: minmax(0, var(--measure)) minmax(0, 18rem);
  gap: var(--space-4);
  padding-inline: var(--space-3);
  margin-inline: auto;
  max-width: 92rem;
}

@media (max-width: 60rem) {
  .editorial {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/site/src/styles
git commit -m "feat(site): tokens neutros, tema otel e base do design system"
```

---

### Task 11: depth-ui — primitivas mínimas

Só o necessário para o hero. Mais primitivas entram na Entrega 2, quando o piloto revelar quais faltam.

**Files:**
- Create: `packages/depth-ui/package.json`, `packages/depth-ui/tsconfig.json`, `packages/depth-ui/src/types.ts`, `packages/depth-ui/src/FlowDiagram.tsx`, `packages/depth-ui/src/Inspector.tsx`, `packages/depth-ui/src/Timeline.tsx`, `packages/depth-ui/src/DepthShell.tsx`, `packages/depth-ui/src/index.ts`, `packages/depth-ui/src/depth-ui.css`
- Test: `packages/depth-ui/src/Inspector.test.tsx`

- [ ] **Step 1: Criar o pacote**

`packages/depth-ui/package.json`:

```json
{
  "name": "@ovh/depth-ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "@ovh/depth-core": "workspace:*"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@testing-library/react": "^16.1.0",
    "jsdom": "^25.0.1"
  }
}
```

`packages/depth-ui/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src", "jsxImportSource": "react" },
  "include": ["src"]
}
```

Run: `pnpm install`

- [ ] **Step 2: Tipos agnósticos de apresentação**

`packages/depth-ui/src/types.ts`:

```ts
/** Um nó no diagrama de fluxo. Sem domínio: só rótulo e posição. */
export interface FlowNodeView {
  readonly id: string;
  readonly label: string;
  readonly sublabel?: string;
  readonly x: number;
  readonly y: number;
  readonly state: "idle" | "active" | "error";
}

/** Uma aresta com um pacote opcional viajando por ela (0 = origem, 1 = destino). */
export interface FlowEdgeView {
  readonly from: string;
  readonly to: string;
  readonly progress?: number;
  readonly dropped?: boolean;
}

export interface FlowView {
  readonly nodes: readonly FlowNodeView[];
  readonly edges: readonly FlowEdgeView[];
}
```

- [ ] **Step 3: Escrever o teste que falha do Inspector**

O Inspector é a primitiva que materializa a mutação destacada: recebe um objeto e a lista de caminhos alterados, e marca as linhas correspondentes.

`packages/depth-ui/src/Inspector.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Inspector, toInspectorLines } from "./Inspector.js";

describe("toInspectorLines", () => {
  it("achata um objeto em linhas com caminho", () => {
    const lines = toInspectorLines({ a: { b: 1 } });
    expect(lines).toEqual([
      { path: "", text: "{", depth: 0 },
      { path: "a", text: '"a": {', depth: 1 },
      { path: "a.b", text: '"b": 1', depth: 2 },
      { path: "a", text: "}", depth: 1 },
      { path: "", text: "}", depth: 0 },
    ]);
  });

  it("marca como alterada a linha cujo caminho está no diff", () => {
    const lines = toInspectorLines({ a: { b: 1 } }, ["a.b"]);
    expect(lines.find((l) => l.path === "a.b")?.changed).toBe(true);
    expect(lines.find((l) => l.path === "a")?.changed).toBeUndefined();
  });
});

describe("Inspector", () => {
  it("renderiza os valores do objeto", () => {
    render(<Inspector value={{ status: 200 }} changedPaths={[]} />);
    expect(screen.getByText(/"status": 200/)).toBeDefined();
  });

  it("marca visualmente as linhas alteradas", () => {
    const { container } = render(
      <Inspector value={{ status: 500 }} changedPaths={["status"]} />,
    );
    expect(container.querySelectorAll("[data-changed='true']")).toHaveLength(1);
  });
});
```

Este arquivo já é coberto pelo projeto `dom` do `vitest.workspace.ts` criado na
Task 1 — não crie um `vitest.config.ts` no pacote.

- [ ] **Step 4: Rodar e confirmar que falha**

Run: `pnpm vitest run --project dom`
Expected: FAIL — `Failed to resolve import "./Inspector.js"`.

- [ ] **Step 5: Implementar o Inspector**

`packages/depth-ui/src/Inspector.tsx`:

```tsx
export interface InspectorLine {
  readonly path: string;
  readonly text: string;
  readonly depth: number;
  readonly changed?: boolean;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Achata um objeto em linhas legíveis, cada uma carregando o caminho de onde
 * veio. É o caminho que permite marcar exatamente o campo que mudou.
 */
export function toInspectorLines(
  value: unknown,
  changedPaths: readonly string[] = [],
  path = "",
  depth = 0,
): InspectorLine[] {
  const changed = new Set(changedPaths);
  const mark = (line: InspectorLine): InspectorLine =>
    changed.has(line.path) ? { ...line, changed: true } : line;

  const label = path === "" ? "" : `"${path.split(".").at(-1)}": `;

  if (isRecord(value) || Array.isArray(value)) {
    const [open, close] = Array.isArray(value) ? ["[", "]"] : ["{", "}"];
    const entries = Array.isArray(value)
      ? value.map((v, i) => [String(i), v] as const)
      : Object.entries(value);

    const lines: InspectorLine[] = [mark({ path, text: `${label}${open}`, depth })];
    for (const [key, child] of entries) {
      lines.push(
        ...toInspectorLines(
          child,
          changedPaths,
          path === "" ? key : `${path}.${key}`,
          depth + 1,
        ),
      );
    }
    lines.push(mark({ path, text: close, depth }));
    return lines;
  }

  return [mark({ path, text: `${label}${JSON.stringify(value)}`, depth })];
}

export interface InspectorProps {
  readonly value: unknown;
  readonly changedPaths: readonly string[];
  readonly label?: string;
}

export function Inspector({ value, changedPaths, label }: InspectorProps) {
  const lines = toInspectorLines(value, changedPaths);
  return (
    <div className="dui-inspector">
      {label ? <p className="dui-inspector__label">{label}</p> : null}
      <pre className="dui-inspector__body">
        {lines.map((line, i) => (
          <span
            key={`${line.path}-${i}`}
            className="dui-inspector__line"
            data-changed={line.changed === true ? "true" : undefined}
            style={{ paddingInlineStart: `${line.depth * 1.25}ch` }}
          >
            {line.text}
            {"\n"}
          </span>
        ))}
      </pre>
    </div>
  );
}
```

- [ ] **Step 6: Rodar e confirmar que passa**

Run: `pnpm vitest run --project dom`
Expected: PASS, 4 testes.

- [ ] **Step 7: Implementar FlowDiagram, Timeline e DepthShell**

`packages/depth-ui/src/FlowDiagram.tsx`:

```tsx
import type { FlowView } from "./types.js";

export interface FlowDiagramProps {
  readonly view: FlowView;
  readonly onSelectNode?: (id: string) => void;
  readonly selectedNodeId?: string;
}

/** L0: a vista externa. Desenhada à mão em SVG, sem biblioteca de ícones. */
export function FlowDiagram({ view, onSelectNode, selectedNodeId }: FlowDiagramProps) {
  const byId = new Map(view.nodes.map((n) => [n.id, n]));

  return (
    <svg className="dui-flow" viewBox="0 0 400 160" role="img" aria-label="Service flow">
      {view.edges.map((edge) => {
        const from = byId.get(edge.from);
        const to = byId.get(edge.to);
        if (!from || !to) return null;
        const key = `${edge.from}-${edge.to}`;
        return (
          <g key={key}>
            <line
              className="dui-flow__wire"
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
            />
            {edge.progress !== undefined ? (
              <circle
                className="dui-flow__packet"
                data-dropped={edge.dropped === true ? "true" : undefined}
                r={5}
                cx={from.x + (to.x - from.x) * edge.progress}
                cy={from.y + (to.y - from.y) * edge.progress}
              />
            ) : null}
          </g>
        );
      })}

      {view.nodes.map((node) => (
        <g
          key={node.id}
          className="dui-flow__node"
          data-state={node.state}
          data-selected={node.id === selectedNodeId ? "true" : undefined}
          onClick={onSelectNode ? () => onSelectNode(node.id) : undefined}
        >
          <rect x={node.x - 38} y={node.y - 18} width={76} height={36} rx={3} />
          <text x={node.x} y={node.y + 1} textAnchor="middle">
            {node.label}
          </text>
          {node.sublabel ? (
            <text className="dui-flow__sublabel" x={node.x} y={node.y + 13} textAnchor="middle">
              {node.sublabel}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}
```

`packages/depth-ui/src/Timeline.tsx`:

```tsx
export interface TimelineProps {
  readonly tick: number;
  readonly maxTick: number;
  readonly playing: boolean;
  readonly onSeek: (tick: number) => void;
  readonly onTogglePlay: () => void;
}

/** A linha do tempo é compartilhada por todos os níveis (spec §4). */
export function Timeline({ tick, maxTick, playing, onSeek, onTogglePlay }: TimelineProps) {
  return (
    <div className="dui-timeline">
      <button type="button" className="dui-timeline__play" onClick={onTogglePlay}>
        {playing ? "Pause" : "Play"}
      </button>
      <button type="button" onClick={() => onSeek(Math.max(0, tick - 1))}>
        Step back
      </button>
      <input
        className="dui-timeline__scrub"
        type="range"
        min={0}
        max={maxTick}
        value={tick}
        aria-label="Timeline"
        onChange={(event) => onSeek(Number(event.target.value))}
      />
      <span className="dui-timeline__tick mono">
        {tick}/{maxTick}
      </span>
    </div>
  );
}
```

`packages/depth-ui/src/DepthShell.tsx`:

```tsx
import type { LevelId } from "@ovh/depth-core";
import type { ReactNode } from "react";

export interface DepthShellProps {
  readonly levels: readonly LevelId[];
  readonly activeLevel: LevelId;
  readonly onChangeLevel: (level: LevelId) => void;
  readonly labels: Readonly<Record<LevelId, string>>;
  readonly children: ReactNode;
  readonly context?: ReactNode;
}

/**
 * O invólucro da descida. Mantém o nível de cima visível na periferia, em vez
 * de abrir um modal: o leitor desce, nunca sai e volta (spec §4).
 * A transição contínua é feita em CSS (view-transition-name em depth-ui.css).
 */
export function DepthShell({
  levels,
  activeLevel,
  onChangeLevel,
  labels,
  children,
  context,
}: DepthShellProps) {
  return (
    <div className="dui-depth" data-level={activeLevel}>
      <nav className="dui-depth__rail" aria-label="Depth">
        {levels.map((level, index) => (
          <button
            key={level}
            type="button"
            className="dui-depth__step"
            aria-current={level === activeLevel ? "step" : undefined}
            onClick={() => onChangeLevel(level)}
          >
            <span className="dui-depth__index mono">L{index}</span>
            <span className="dui-depth__name">{labels[level]}</span>
          </button>
        ))}
      </nav>
      <div className="dui-depth__stage">{children}</div>
      {context ? <aside className="dui-depth__context">{context}</aside> : null}
    </div>
  );
}
```

`packages/depth-ui/src/index.ts`:

```ts
export { DepthShell } from "./DepthShell.js";
export type { DepthShellProps } from "./DepthShell.js";
export { FlowDiagram } from "./FlowDiagram.js";
export type { FlowDiagramProps } from "./FlowDiagram.js";
export { Inspector, toInspectorLines } from "./Inspector.js";
export type { InspectorLine, InspectorProps } from "./Inspector.js";
export { Timeline } from "./Timeline.js";
export type { TimelineProps } from "./Timeline.js";
export type { FlowEdgeView, FlowNodeView, FlowView } from "./types.js";
```

- [ ] **Step 8: Escrever o CSS das primitivas**

`packages/depth-ui/src/depth-ui.css` — consome os tokens do site, não define cores próprias:

```css
.dui-depth {
  display: grid;
  grid-template-columns: 9rem minmax(0, 1fr) minmax(0, 22rem);
  gap: var(--space-2);
  align-items: start;
}

@media (max-width: 60rem) {
  .dui-depth {
    grid-template-columns: minmax(0, 1fr);
  }
}

.dui-depth__rail {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-inline-start: 2px solid var(--rule);
}

.dui-depth__step {
  display: flex;
  gap: var(--space-1);
  align-items: baseline;
  padding: 0.35rem var(--space-1);
  background: none;
  border: 0;
  border-inline-start: 2px solid transparent;
  margin-inline-start: -2px;
  color: var(--ink-muted);
  font-family: var(--font-body);
  text-align: start;
  cursor: pointer;
}

.dui-depth__step[aria-current="step"] {
  border-inline-start-color: var(--accent);
  color: var(--ink);
}

.dui-depth__index {
  font-size: var(--size-step--1);
  color: var(--ink-muted);
}

.dui-depth__stage {
  view-transition-name: depth-stage;
  background: var(--paper-raised);
  border: 1px solid var(--rule);
  padding: var(--space-2);
}

.dui-flow {
  width: 100%;
  height: auto;
}

.dui-flow__wire {
  stroke: var(--rule);
  stroke-width: 1.5;
}

.dui-flow__packet {
  fill: var(--sig-flow);
}

.dui-flow__packet[data-dropped="true"] {
  fill: var(--sig-drop);
}

.dui-flow__node rect {
  fill: var(--paper);
  stroke: var(--ink);
  stroke-width: 1.5;
}

.dui-flow__node[data-state="error"] rect {
  stroke: var(--sig-drop);
}

.dui-flow__node text {
  fill: var(--ink);
  font-family: var(--font-body);
  font-size: 11px;
}

.dui-flow__sublabel {
  fill: var(--ink-muted);
  font-family: var(--font-mono);
  font-size: 8px;
}

.dui-inspector__body {
  margin: 0;
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: var(--size-step--1);
  line-height: 1.5;
}

.dui-inspector__line {
  display: block;
  transition: background-color 600ms ease-out;
}

.dui-inspector__line[data-changed="true"] {
  background-color: color-mix(in oklab, var(--sig-mutation) 35%, transparent);
}

.dui-timeline {
  display: flex;
  gap: var(--space-1);
  align-items: center;
  margin-block-start: var(--space-2);
}

.dui-timeline__scrub {
  flex: 1;
  accent-color: var(--accent);
}

@media (prefers-reduced-motion: reduce) {
  .dui-inspector__line {
    transition: none;
  }
}
```

- [ ] **Step 9: Verificar a fronteira e os tipos**

Run: `pnpm boundaries && pnpm typecheck`
Expected: `Fronteira motor↔domínio intacta.` e typecheck sem erro. Se a fronteira acusar, o termo de domínio vazou — mova-o para `otel-domain`.

- [ ] **Step 10: Commit**

```bash
git add packages/depth-ui
git commit -m "feat(depth-ui): primitivas DepthShell, FlowDiagram, Inspector e Timeline"
```

---

### Task 12: O cenário do hero

Duas requisições atravessando três serviços. O leitor liga e desliga a propagação de contexto e vê o trace se partir. É o menor cenário que prova a tese inteira do projeto.

**Files:**
- Create: `apps/site/src/labs/hero/scenario.ts`
- Test: `apps/site/src/labs/hero/scenario.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

`apps/site/src/labs/hero/scenario.test.ts`:

```ts
import { Engine } from "@ovh/depth-core";
import { describe, expect, it } from "vitest";
import { heroScenario } from "./scenario.js";

describe("heroScenario", () => {
  it("declara os níveis flow e payload", () => {
    expect(heroScenario.levels).toEqual(["flow", "payload"]);
  });

  it("começa sem spans emitidos", () => {
    const e = new Engine(heroScenario, { propagate: true });
    expect(e.state.spans).toEqual([]);
  });

  it("com propagação ligada, o span filho aponta para o pai", () => {
    const e = new Engine(heroScenario, { propagate: true });
    e.advance(20);
    const [root, child] = e.state.spans;
    expect(root).toBeDefined();
    expect(child).toBeDefined();
    expect(child!.parentSpanId).toBe(root!.spanId);
    expect(child!.traceId).toBe(root!.traceId);
  });

  it("com propagação desligada, o filho vira raiz de outro trace", () => {
    const e = new Engine(heroScenario, { propagate: false });
    e.advance(20);
    const [root, child] = e.state.spans;
    expect(child!.parentSpanId).toBeUndefined();
    expect(child!.traceId).not.toBe(root!.traceId);
  });

  it("o header transportado é um traceparent válido quando há propagação", () => {
    const e = new Engine(heroScenario, { propagate: true });
    e.advance(12);
    expect(e.state.header).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });

  it("não transporta header quando a propagação está desligada", () => {
    const e = new Engine(heroScenario, { propagate: false });
    e.advance(12);
    expect(e.state.header).toBeNull();
  });

  it("é determinístico", () => {
    const a = new Engine(heroScenario, { propagate: true });
    const b = new Engine(heroScenario, { propagate: true });
    a.advance(30);
    b.advance(30);
    expect(a.state).toEqual(b.state);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm vitest run apps/site/src/labs/hero/scenario.test.ts`
Expected: FAIL — `Failed to resolve import "./scenario.js"`.

- [ ] **Step 3: Implementar**

`apps/site/src/labs/hero/scenario.ts`:

```ts
import type { Scenario } from "@ovh/depth-core";
import { attribute, formatTraceparent } from "@ovh/otel-domain";
import type { OtelSpan } from "@ovh/otel-domain";

export interface HeroState {
  /** Posição do pacote na aresta atual, de 0 a 1. */
  readonly progress: number;
  /** Aresta ativa: 0 = client→api, 1 = api→checkout. */
  readonly hop: 0 | 1;
  /** O header carregado neste hop, ou null se a propagação está desligada. */
  readonly header: string | null;
  readonly spans: readonly OtelSpan[];
}

const TRACE_A = "4bf92f3577b34da6a3ce929d0e0e4736";
const TRACE_B = "b7ad6b7169203331b1e5b3f1a2c40d99";
const SPAN_ROOT = "00f067aa0ba902b7";
const SPAN_CHILD = "a3ce929d0e0e4736";
const T0 = 1_700_000_000_000_000_000n;

function span(
  traceId: string,
  spanId: string,
  name: string,
  service: string,
  parentSpanId?: string,
): OtelSpan {
  const base: OtelSpan = {
    traceId,
    spanId,
    name,
    kind: 2,
    startTimeUnixNano: String(T0),
    endTimeUnixNano: String(T0 + 120_000_000n),
    attributes: [attribute("service.name", service), attribute("http.route", name)],
  };
  return parentSpanId === undefined ? base : { ...base, parentSpanId };
}

/**
 * O hero: uma requisição atravessa api → checkout. Com `propagate` ligado o
 * traceparent viaja e os dois spans formam um trace; desligado, o segundo
 * serviço abre um trace novo e o trace original fica pela metade.
 */
export const heroScenario: Scenario<HeroState> = {
  id: "hero",
  seed: 1312,
  levels: ["flow", "payload"],

  initialState: () => ({ progress: 0, hop: 0, header: null, spans: [] }),

  step: (state, ctx) => {
    const propagate = ctx.inputs.propagate !== false;
    const next = state.progress + 0.12;

    if (next < 1) {
      return { ...state, progress: next };
    }

    // Chegou ao fim da aresta: o serviço de destino emite seu span.
    if (state.hop === 0) {
      const root = span(TRACE_A, SPAN_ROOT, "GET /checkout", "api");
      return {
        progress: 0,
        hop: 1,
        header: propagate
          ? formatTraceparent({ traceId: TRACE_A, spanId: SPAN_ROOT, sampled: true })
          : null,
        spans: [root],
      };
    }

    const child = propagate
      ? span(TRACE_A, SPAN_CHILD, "POST /charge", "checkout", SPAN_ROOT)
      : span(TRACE_B, SPAN_CHILD, "POST /charge", "checkout");

    return {
      progress: 0,
      hop: 0,
      header: state.header,
      spans: state.spans.length >= 2 ? state.spans : [...state.spans, child],
    };
  },
};
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm vitest run apps/site/src/labs/hero/scenario.test.ts`
Expected: PASS, 7 testes.

- [ ] **Step 5: Commit**

```bash
git add apps/site/src/labs/hero
git commit -m "feat(site): cenario do hero com propagacao de contexto"
```

---

### Task 13: A ilha React do hero

**Files:**
- Create: `apps/site/src/components/HeroSim.tsx`, `apps/site/src/components/HeroSim.css`

- [ ] **Step 1: Implementar a ilha**

`apps/site/src/components/HeroSim.tsx`:

```tsx
import { Engine, diffStates } from "@ovh/depth-core";
import type { LevelId } from "@ovh/depth-core";
import { DepthShell, FlowDiagram, Inspector, Timeline } from "@ovh/depth-ui";
import type { FlowView } from "@ovh/depth-ui";
import { toOtlpJson } from "@ovh/otel-domain";
import { useEffect, useMemo, useRef, useState } from "react";
import { heroScenario } from "../labs/hero/scenario.js";
import type { HeroState } from "../labs/hero/scenario.js";

const MAX_TICK = 32;

const LEVEL_LABELS: Record<LevelId, string> = {
  flow: "Flow",
  mechanism: "Mechanism",
  wire: "Wire",
  payload: "Payload",
};

function toFlowView(state: HeroState, propagate: boolean): FlowView {
  const orphan = !propagate && state.spans.length >= 2;
  return {
    nodes: [
      { id: "client", label: "client", x: 55, y: 80, state: "idle" },
      { id: "api", label: "api", x: 200, y: 80, state: "active" },
      {
        id: "checkout",
        label: "checkout",
        // `exactOptionalPropertyTypes` proíbe atribuir undefined a prop opcional.
        ...(orphan ? { sublabel: "orphan trace" } : {}),
        x: 345,
        y: 80,
        state: orphan ? "error" : "idle" as const,
      },
    ],
    edges: [
      {
        from: "client",
        to: "api",
        ...(state.hop === 0 ? { progress: state.progress } : {}),
      },
      {
        from: "api",
        to: "checkout",
        dropped: !propagate,
        ...(state.hop === 1 ? { progress: state.progress } : {}),
      },
    ],
  };
}

export function HeroSim() {
  const [propagate, setPropagate] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [level, setLevel] = useState<LevelId>("flow");
  const [tick, setTick] = useState(0);

  const engine = useMemo(() => new Engine(heroScenario, { propagate }), [propagate]);
  const frame = useRef<number | undefined>(undefined);

  useEffect(() => {
    setTick(0);
  }, [engine]);

  useEffect(() => {
    if (!playing) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    let last = performance.now();
    const loop = (now: number) => {
      if (now - last >= 90) {
        last = now;
        setTick((t) => (t + 1) % (MAX_TICK + 1));
      }
      frame.current = requestAnimationFrame(loop);
    };
    frame.current = requestAnimationFrame(loop);
    return () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    };
  }, [playing, engine]);

  engine.seek(tick);
  const state = engine.state;
  const previous = engine.previousState;

  const payload = toOtlpJson(
    { attributes: [] },
    state.spans,
  );
  const previousPayload = previous
    ? toOtlpJson({ attributes: [] }, previous.spans)
    : payload;
  const changedPaths = diffStates(previousPayload, payload);

  return (
    <div className="hero-sim">
      <div className="hero-sim__controls">
        <label className="hero-sim__toggle">
          <input
            type="checkbox"
            checked={propagate}
            onChange={(event) => setPropagate(event.target.checked)}
          />
          Propagate <code>traceparent</code>
        </label>
        <p className="hero-sim__header mono">
          {state.header ?? "— no header on the wire —"}
        </p>
      </div>

      <DepthShell
        levels={engine.levels}
        activeLevel={level}
        onChangeLevel={setLevel}
        labels={LEVEL_LABELS}
        context={
          level === "flow" ? (
            <Inspector
              value={payload}
              changedPaths={changedPaths}
              label="OTLP payload"
            />
          ) : null
        }
      >
        {level === "flow" ? (
          <FlowDiagram view={toFlowView(state, propagate)} />
        ) : (
          <Inspector value={payload} changedPaths={changedPaths} label="OTLP payload" />
        )}
      </DepthShell>

      <Timeline
        tick={tick}
        maxTick={MAX_TICK}
        playing={playing}
        onSeek={(t) => {
          setPlaying(false);
          setTick(t);
        }}
        onTogglePlay={() => setPlaying((p) => !p)}
      />
    </div>
  );
}
```

`apps/site/src/components/HeroSim.css`:

```css
.hero-sim {
  border: 1px solid var(--rule);
  background: var(--paper-raised);
  padding: var(--space-2);
}

.hero-sim__controls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: baseline;
  justify-content: space-between;
  margin-block-end: var(--space-2);
  padding-block-end: var(--space-1);
  border-block-end: 1px solid var(--rule);
}

.hero-sim__toggle {
  display: flex;
  gap: 0.5ch;
  align-items: center;
  font-size: var(--size-step--1);
}

.hero-sim__header {
  margin: 0;
  color: var(--ink-muted);
  font-size: var(--size-step--1);
  overflow-wrap: anywhere;
}
```

- [ ] **Step 2: Verificar tipos**

Run: `pnpm typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/site/src/components
git commit -m "feat(site): ilha do hero rodando o motor de verdade"
```

---

### Task 14: A landing page

A seção "The path" **não é uma lista** — é o mapa clicável (spec §3). Nós são
labs, arestas são pré-requisitos, anexos do The Wire penduram por arestas
tracejadas, e o progresso de cada nó vive em `localStorage`. Desenhado na
linguagem editorial: cantos retos, traço de 1.5px, cor só onde significa algo.

O mapa é componente de site, **não** usa `depth-ui`: nós são labs, não
telemetria em movimento.

**Files:**
- Modify: `apps/site/src/pages/index.astro` (substituir o placeholder da Task 9)
- Create: `apps/site/src/layouts/Base.astro`, `apps/site/src/data/roadmap.ts`,
  `apps/site/src/components/Roadmap.tsx`, `apps/site/src/components/Roadmap.css`

- [ ] **Step 1: As cinco fases como dado**

`apps/site/src/data/phases.ts`:

```ts
export interface Phase {
  readonly number: number;
  readonly title: string;
  readonly question: string;
  readonly status: "available" | "coming";
  readonly labs: readonly string[];
}

/** Spec §3. Publicamos fase por fase; o mapa completo é visível desde o dia 1. */
export const phases: readonly Phase[] = [
  {
    number: 1,
    title: "The Problem",
    question: "Why logs, metrics and traces sitting in three tools is not observability.",
    status: "coming",
    labs: ["Three pillars, one blind spot", "The cost of disconnected signals"],
  },
  {
    number: 2,
    title: "The Model",
    question: "What OpenTelemetry actually moves: signals, context, and the wire format.",
    status: "available",
    labs: ["Anatomy of a Trace", "Hard context and baggage", "Reading an OTLP payload"],
  },
  {
    number: 3,
    title: "The Architecture",
    question: "API, SDK, Collector — who does what, and where each one runs.",
    status: "coming",
    labs: ["The Collector pipeline", "Agent or gateway"],
  },
  {
    number: 4,
    title: "Instrumentation",
    question: "Where telemetry is born: your code, your libraries, your infrastructure.",
    status: "coming",
    labs: ["Manual spans", "Zero-code instrumentation", "Host and Kubernetes signals"],
  },
  {
    number: 5,
    title: "Operating at Scale",
    question: "Pipelines, sampling, cost, and getting an organization to adopt it.",
    status: "coming",
    labs: ["Head vs tail sampling", "Backpressure and drops", "The rollout"],
  },
];
```

- [ ] **Step 2: O layout base**

`apps/site/src/layouts/Base.astro`:

```astro
---
import "../styles/tokens.css";
import "../styles/themes/otel.css";
import "../styles/base.css";
import "@ovh/depth-ui/src/depth-ui.css";

interface Props {
  title: string;
  description: string;
}

const { title, description } = Astro.props;
---

<!doctype html>
<html lang="en" data-domain="otel">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500&family=IBM+Plex+Serif:wght@500;600&display=swap"
    />
  </head>
  <body>
    <slot />
  </body>
</html>
```

- [ ] **Step 3: A landing**

`apps/site/src/pages/index.astro`:

```astro
---
import { HeroSim } from "../components/HeroSim.tsx";
import Base from "../layouts/Base.astro";
import { phases } from "../data/phases.ts";
---

<Base
  title="OTel Visual Handbook"
  description="Every OpenTelemetry concept as a model you can take apart — from the service graph down to the bytes on the wire."
>
  <header class="site-header">
    <p class="site-header__mark mono">OTel Visual Handbook</p>
  </header>

  <main>
    <section class="hero editorial">
      <div>
        <h1>See how the telemetry actually moves.</h1>
        <p class="hero__lede prose">
          Most OpenTelemetry material shows you a diagram and a config file. This
          one gives you the running mechanism: change something, watch the trace
          react, then open it up and read the exact bytes that produced what you
          just saw.
        </p>
        <p class="prose">
          Turn off context propagation below. The picture breaks — and so does
          the payload underneath it, because they are the same data.
        </p>
      </div>
      <aside class="hero__note">
        <p class="mono">Live simulation. Not a video.</p>
      </aside>
    </section>

    <section class="hero-stage">
      <HeroSim client:visible />
    </section>

    <section class="editorial">
      <div class="prose">
        <h2>What a lab is</h2>
        <p>
          Every lab answers one concrete question, and it answers it four times —
          at four depths. The outside view shows services and telemetry flowing.
          Go one level down and you are inside a component. Another, and you are
          on the wire, in HTTP/2 frames. Another, and you are reading the OTLP
          payload field by field, with whatever just changed still highlighted.
        </p>
        <p>
          Those are not four drawings. They are four views of one running state,
          so what you read at the bottom is what produced the picture at the top.
          When a lab makes a claim, there is a <code>docker compose</code> in the
          repository that lets you check it against a real Collector.
        </p>
      </div>
      <aside class="sidenote">
        <p>
          Sourced from the OpenTelemetry specification and official docs. The
          teaching order follows <em>Learning OpenTelemetry</em>, because the
          order in which the concepts hold each other up is right there.
        </p>
      </aside>
    </section>

    <section class="editorial">
      <div class="prose">
        <h2>The path</h2>
        <ol class="phases">
          {
            phases.map((phase) => (
              <li class="phase" data-status={phase.status}>
                <p class="phase__number mono">Phase {phase.number}</p>
                <h3 class="phase__title">{phase.title}</h3>
                <p class="phase__question">{phase.question}</p>
                <ul class="phase__labs mono">
                  {phase.labs.map((lab) => (
                    <li>{lab}</li>
                  ))}
                </ul>
                {phase.status === "coming" ? (
                  <p class="phase__status mono">In progress</p>
                ) : null}
              </li>
            ))
          }
        </ol>
      </div>
      <aside class="sidenote">
        <p>
          Phases ship as they are written. The whole map is visible from day one
          on purpose — knowing what is coming is part of knowing where you are.
        </p>
      </aside>
    </section>
  </main>

  <footer class="site-footer editorial">
    <p class="mono">
      Open source ·
      <a href="https://github.com/CabriniJr/otel-visual-handbook">GitHub</a>
      · Built with Claude
    </p>
  </footer>
</Base>

<style>
  .site-header {
    padding: var(--space-2) var(--space-3);
    border-block-end: 1px solid var(--rule);
  }

  .site-header__mark {
    margin: 0;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    font-size: var(--size-step--1);
  }

  .hero {
    padding-block: var(--space-5) var(--space-3);
  }

  h1 {
    margin: 0 0 var(--space-2);
    font-size: var(--size-step-3);
    max-width: 20ch;
  }

  .hero__lede {
    font-size: var(--size-step-1);
    color: var(--ink);
  }

  .hero__note {
    align-self: end;
    color: var(--ink-muted);
    font-size: var(--size-step--1);
  }

  .hero-stage {
    max-width: 92rem;
    margin-inline: auto;
    padding-inline: var(--space-3);
    padding-block-end: var(--space-5);
  }

  section.editorial {
    padding-block: var(--space-4);
  }

  h2 {
    font-size: var(--size-step-2);
    margin-block: 0 var(--space-2);
  }

  .sidenote {
    color: var(--ink-muted);
    font-size: var(--size-step--1);
    border-block-start: 2px solid var(--accent);
    padding-block-start: var(--space-1);
  }

  .phases {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .phase {
    padding-block: var(--space-2);
    border-block-start: 1px solid var(--rule);
  }

  .phase[data-status="coming"] {
    color: var(--ink-muted);
  }

  .phase__number {
    margin: 0;
    font-size: var(--size-step--1);
    color: var(--ink-muted);
  }

  .phase__title {
    margin: 0.15rem 0 0.35rem;
    font-size: var(--size-step-1);
  }

  .phase__question {
    margin: 0 0 var(--space-1);
    max-width: 55ch;
  }

  .phase__labs {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: var(--size-step--1);
    color: var(--ink-muted);
  }

  .phase__status {
    margin: var(--space-1) 0 0;
    font-size: var(--size-step--1);
    color: var(--accent);
  }

  .site-footer {
    padding-block: var(--space-3);
    border-block-start: 1px solid var(--rule);
    color: var(--ink-muted);
    font-size: var(--size-step--1);
  }
</style>
```

- [ ] **Step 4: Rodar o dev server e conferir a olho**

Run: `pnpm dev`
Expected: `http://localhost:4321/otel-visual-handbook` abre; o hero anima; desligar o checkbox faz o `checkout` ficar marcado como `orphan trace` e o `traceId` do segundo span mudar no inspector, com a linha destacada.

- [ ] **Step 5: Commit**

```bash
git add apps/site/src
git commit -m "feat(site): landing page editorial com hero interativo"
```

---

### Task 15: Smoke test com Playwright

**Files:**
- Create: `apps/site/playwright.config.ts`, `apps/site/tests/landing.spec.ts`
- Modify: `apps/site/package.json` (script `test:e2e`), `.github/workflows/ci.yml` (rodar o e2e)

- [ ] **Step 1: Configurar**

`apps/site/playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  use: { baseURL: "http://localhost:4321/otel-visual-handbook" },
  webServer: {
    command: "pnpm build && pnpm preview --port 4321",
    url: "http://localhost:4321/otel-visual-handbook",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
```

Adicionar em `apps/site/package.json`: `"test:e2e": "playwright test"` e a devDependency `"@playwright/test": "^1.49.0"`.

- [ ] **Step 2: Escrever o teste**

`apps/site/tests/landing.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("a landing carrega e o hero hidrata", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("telemetry");
  await expect(page.locator(".hero-sim")).toBeVisible();
  await expect(page.getByRole("img", { name: "Service flow" })).toBeVisible();
});

test("desligar a propagação quebra o trace", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("checkbox");
  await expect(toggle).toBeChecked();

  await toggle.uncheck();
  await expect(page.locator(".hero-sim__header")).toContainText("no header on the wire");
  await expect(page.locator("text=orphan trace")).toBeVisible({ timeout: 10_000 });
});

test("a linha do tempo permite parar num tick e ler o payload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("slider", { name: "Timeline" }).fill("20");
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  await expect(page.locator(".dui-inspector__body")).toContainText("resourceSpans");
});

test("a página não rola horizontalmente no mobile", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
```

- [ ] **Step 3: Rodar e confirmar que passa**

Run: `pnpm --filter @ovh/site exec playwright install --with-deps chromium && pnpm --filter @ovh/site test:e2e`
Expected: PASS, 8 execuções (4 testes × 2 projetos).

- [ ] **Step 4: Ligar no CI**

Adicionar ao final do job `check` em `.github/workflows/ci.yml`:

```yaml
      - run: pnpm --filter @ovh/site exec playwright install --with-deps chromium
      - run: pnpm --filter @ovh/site test:e2e
```

- [ ] **Step 5: Commit**

```bash
git add apps/site/playwright.config.ts apps/site/tests apps/site/package.json .github/workflows/ci.yml pnpm-lock.yaml
git commit -m "test(site): smoke da landing no desktop e no mobile"
```

---

### Task 16: Guia de autoria e README

**Files:**
- Create: `docs/authoring.md`
- Modify: `README.md`

- [ ] **Step 1: Escrever o guia**

`docs/authoring.md`:

```markdown
# Authoring a lab

## The pipeline

1. **Question first.** Open an issue whose title is the question the lab answers.
   If you cannot state it as a question, the lab is not ready to be written.
2. **Gather the sources.** The OpenTelemetry specification, the official docs,
   the relevant RFC or W3C document. Collect links before writing anything.
3. **Distil with Claude.** Feed the sources and the question; produce a draft
   scenario (topology, levels, armed failures) and a draft of the prose.
4. **Verify against the sources.** Every technical claim in the draft must trace
   back to a link. Anything that cannot be traced is cut, not softened.
5. **Write the scenario and the MDX.** The scenario is a `Scenario<S>` in
   `apps/site/src/labs/<slug>/scenario.ts`; the prose is the MDX beside it.
6. **Build the real counterpart.** `labs/<slug>/` with a compose that runs, and
   OTLP fixtures captured from it feeding the `otel-domain` tests.
7. **Open the PR.**

Claude never runs in the reader's browser. The published site is static.

## Rules that are not negotiable

- The book *Learning OpenTelemetry* supplies the **teaching order only**. No text
  from it is copied or closely paraphrased, and it is never the source of a
  technical claim.
- A simulation that does not react to input is not a lab. It is a figure — put it
  in the prose.
- `depth-core` and `depth-ui` must never learn what OpenTelemetry is. If a lab
  needs a new primitive, it goes in `depth-ui` in domain-neutral terms.
  `pnpm boundaries` enforces this.
- Every level shown must be a projection of the same state. If the payload view
  is hand-written to "look right", the lab is lying and must be rewritten.

## The shape of a lab page

1. The question
2. The model (the simulation)
3. Break it (armed failure scenarios)
4. Why it works this way (prose, with links to the spec)
5. Run it for real (`labs/<slug>/`)
6. Check yourself (2–3 questions, revealable answers)
```

- [ ] **Step 2: Escrever o README**

`README.md`:

```markdown
# OTel Visual Handbook

Every OpenTelemetry concept as a model you can take apart — from the service
graph down to the bytes on the wire.

**https://cabrinijr.github.io/otel-visual-handbook**

## Why

Most OpenTelemetry material shows a diagram and a config file. This one shows the
running mechanism at four depths — flow, component, wire, payload — where each
depth is a projection of the same state. What you read at the bottom is what
produced the picture at the top. Every lab has a `docker compose` beside it so
you can check the model against a real Collector.

## Layout

| Path | What lives there |
|---|---|
| `apps/site` | The Astro site: content, pages, one scenario per lab |
| `packages/depth-core` | The deterministic engine. Knows nothing about OpenTelemetry |
| `packages/depth-ui` | Visual primitives. Also domain-neutral |
| `packages/otel-domain` | The only place OpenTelemetry exists: OTLP types, `traceparent` |
| `labs/<slug>` | The compose that runs for real |
| `docs/` | Specs, ADRs, and the authoring guide |

The boundary between engine and domain is enforced by `pnpm boundaries` in CI,
not by discipline — the engine is meant to outlive this one subject.

## Development

```bash
pnpm install
pnpm dev          # http://localhost:4321/otel-visual-handbook
pnpm test         # unit tests
pnpm boundaries   # engine/domain boundary check
pnpm typecheck
pnpm build
```

Writing a lab: see [`docs/authoring.md`](docs/authoring.md).

## Sources

Technical claims come from the [OpenTelemetry specification](https://opentelemetry.io/docs/specs/)
and the official documentation, linked inline. The teaching order follows
*Learning OpenTelemetry* by Ted Young and Austin Parker (O'Reilly, 2024); no text
from the book is reproduced here.

Built with Claude.
```

- [ ] **Step 3: Commit**

```bash
git add README.md docs/authoring.md
git commit -m "docs: guia de autoria e README"
```

---

### Task 17: Publicar

**Etapa com decisão humana.** O repositório é público: o push é o momento em que o projeto vira visível. Confirmar com o Luigi antes.

- [ ] **Step 1: Rodar a bateria completa**

Run: `pnpm install && pnpm boundaries && pnpm typecheck && pnpm test && pnpm build && pnpm --filter @ovh/site test:e2e`
Expected: tudo verde. Não seguir para o push se qualquer etapa falhar.

- [ ] **Step 2: Confirmar o push com o usuário**

Perguntar explicitamente antes de empurrar para `main` no repositório público.

- [ ] **Step 3: Push**

```bash
git push -u origin main
```

- [ ] **Step 4: Habilitar o GitHub Pages**

Etapa manual do Luigi: Settings → Pages → Source: **GitHub Actions**. Depois, conferir que o workflow `Deploy` roda e que a URL responde.

- [ ] **Step 5: Verificar a publicação**

Run: `curl -sSI https://cabrinijr.github.io/otel-visual-handbook/ | head -1`
Expected: `HTTP/2 200`.

---

## Notas para a Entrega 2

Fora do escopo deste plano, registrado para não se perder: o lab piloto *Anatomy
of a Trace* com os quatro níveis, o anexo **W3C Trace Context** do acervo The
Wire, e `labs/anatomy-of-a-trace/` com o compose real e as fixtures OTLP
capturadas dele para alimentar os testes de `otel-domain`. As primitivas L1
(Mechanism) e L2 (Wire) de `depth-ui` nascem lá, quando o piloto revelar
exatamente o que elas precisam fazer.
