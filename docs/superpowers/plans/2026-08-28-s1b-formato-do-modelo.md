# Formato do modelo em código — plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA — use superpowers:subagent-driven-development
> para executar tarefa a tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** transformar `docs/model-format.md` — hoje prosa e exemplos em YAML — num
formato que o código lê, valida e compila para um `WorldSpec` que o motor roda.

**Arquitetura:** um pacote novo, `@ovh/model-format`, entre `depth-core` (o motor) e
`otel-domain` (o conteúdo). Ele conhece `kind`, porta, fio e parâmetro — vocabulário do
motor, não do OpenTelemetry —, então continua do lado agnóstico da fronteira que o
`scripts/check-boundaries.mjs` guarda. Zod declara schema e tipo na mesma linha; `yaml`
(eemeli) preserva posição, que é o que permite apontar o erro para a linha do autor.

**Stack:** TypeScript estrito, Zod, `yaml`, Vitest — todas já escolhidas em
`docs/stack.md` §6–8.

---

## Por que este plano existe

`docs/model-format.md` foi desenhado com cuidado e não tem uma linha de código. Enquanto ele
for só prosa, três coisas continuam impossíveis:

1. **Um lab não pode ser escrito por outra pessoa.** A régua de "ser base para outros
   handbooks" é um handbook escrito por quem não construiu o motor, e o que habilita isso é
   um formato que valida e recusa com mensagem clara.
2. **O formato não pode ser contrariado.** Prosa não impede ninguém de escrever um `modelet`
   com fio ligado numa porta que não existe. Schema impede.
3. **A ordem `state: opaque | approximate | refined`** não significa nada até algo verificar
   a diferença.

E há uma trava de custo real: o formato cita `kind`s que a S2 ainda não implementou
(`clock`, `batch`, `transform`). O compilador precisa **recusar kind desconhecido com
mensagem que diga em que onda ele chega** — não fingir que compila.

---

## Task 1: O pacote e o schema de porta, parâmetro e fio

**Files:**
- Create: `packages/model-format/package.json`
- Create: `packages/model-format/tsconfig.json`
- Create: `packages/model-format/src/schema.ts`
- Test: `packages/model-format/src/schema.test.ts`

- [ ] **Step 1: Criar o pacote**

`packages/model-format/package.json`, espelhando `packages/depth-core/package.json`:

```json
{
  "name": "@ovh/model-format",
  "version": "0.0.0",
  "license": "Apache-2.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": { "test": "vitest run" },
  "dependencies": {
    "@ovh/depth-core": "workspace:*",
    "yaml": "^2.5.0",
    "zod": "^3.23.0"
  }
}
```

`packages/model-format/tsconfig.json`: copie o de `depth-core` e ajuste os caminhos.

Rode `pnpm install` na raiz.

- [ ] **Step 2: Escrever o teste que falha**

```ts
// packages/model-format/src/schema.test.ts
import { describe, expect, it } from "vitest";
import { PortSchema, ParamSchema, WireSchema } from "./schema.js";

describe("PortSchema", () => {
  it("aceita uma porta de dado", () => {
    const r = PortSchema.safeParse({ role: "data", direction: "in", accepts: "item" });
    expect(r.success).toBe(true);
  });

  it("aceita descarte como direção — o medidor precisa dele para ser honesto", () => {
    const r = PortSchema.safeParse({ role: "data", direction: "drop", emits: "item" });
    expect(r.success).toBe(true);
  });

  it("recusa direção inventada", () => {
    expect(PortSchema.safeParse({ role: "data", direction: "lateral" }).success).toBe(false);
  });

  it("recusa porta de controle que declara carga: controle carrega sinal, não carga", () => {
    const r = PortSchema.safeParse({ role: "control", direction: "in", accepts: "item" });
    expect(r.success).toBe(false);
  });
});

describe("ParamSchema", () => {
  it("exige unidade em número, para o controle poder mostrar o valor real", () => {
    expect(ParamSchema.safeParse({ type: "int", default: 512, unit: "items" }).success).toBe(true);
    expect(ParamSchema.safeParse({ type: "int", default: 512 }).success).toBe(false);
  });

  it("enum precisa listar valores, e o default precisa estar na lista", () => {
    const bom = { type: "enum", values: ["drop_new", "block"], default: "drop_new" };
    const ruim = { type: "enum", values: ["drop_new", "block"], default: "drop_old" };
    expect(ParamSchema.safeParse(bom).success).toBe(true);
    expect(ParamSchema.safeParse(ruim).success).toBe(false);
  });

  it("duração é string com unidade declarada", () => {
    expect(ParamSchema.safeParse({ type: "duration", default: "5s" }).success).toBe(true);
    expect(ParamSchema.safeParse({ type: "duration", default: 5 }).success).toBe(false);
  });
});

describe("WireSchema", () => {
  it("linha de dado é o padrão", () => {
    const r = WireSchema.parse({ from: "in", to: "queue.in" });
    expect(r.line).toBe("data");
  });

  it("linha de controle é declarada", () => {
    const r = WireSchema.parse({ from: "timer.tick", to: "batcher.trigger", line: "control" });
    expect(r.line).toBe("control");
  });
});
```

Run: `pnpm vitest run packages/model-format/src/schema.test.ts`
Expected: FAIL — `Failed to resolve import "./schema.js"`

- [ ] **Step 3: Implementar `schema.ts`**

```ts
import { z } from "zod";

/**
 * Duas espécies de linha, e a diferença é dura: uma linha de controle carrega
 * sinal — pedido, concessão, gatilho, medida — e nunca carga. É o que faz a
 * pergunta "por onde o dado passa?" ter resposta olhando só as linhas de dado.
 */
export const LineSchema = z.enum(["data", "control"]);

/**
 * Descarte é `direction: "drop"`, e não a ausência de uma porta. Um objeto que
 * joga coisa fora sem porta de descarte não pode ser medido, e um amostrador
 * que não mostra o que descartou não ensina nada.
 */
export const PortSchema = z
  .object({
    role: LineSchema.default("data"),
    direction: z.enum(["in", "out", "drop"]),
    accepts: z.string().optional(),
    emits: z.string().optional(),
  })
  .strict()
  .refine((p) => p.role !== "control" || (p.accepts === undefined && p.emits === undefined), {
    message:
      "porta de controle não declara accepts/emits: controle carrega sinal, não carga",
  });

const NumeroSchema = z
  .object({
    type: z.enum(["int", "float"]),
    default: z.number(),
    // Sem unidade, o leitor inventa a correspondência e não há como corrigi-lo.
    unit: z.string().min(1),
    min: z.number().optional(),
    max: z.number().optional(),
  })
  .strict();

const DuracaoSchema = z
  .object({
    type: z.literal("duration"),
    // String com unidade ("5s", "200ms"): número puro esconde a escala.
    default: z.string().regex(/^\d+(ms|s|m|h)$/),
  })
  .strict();

const EnumSchema = z
  .object({
    type: z.literal("enum"),
    values: z.array(z.string()).min(2),
    default: z.string(),
  })
  .strict()
  .refine((p) => p.values.includes(p.default), {
    message: "o default precisa estar entre os values",
  });

export const ParamSchema = z.union([NumeroSchema, DuracaoSchema, EnumSchema]);

export const WireSchema = z
  .object({
    from: z.string().min(1),
    to: z.string().min(1),
    line: LineSchema.default("data"),
  })
  .strict();

export type Port = z.infer<typeof PortSchema>;
export type Param = z.infer<typeof ParamSchema>;
export type Wire = z.infer<typeof WireSchema>;
```

Run: `pnpm vitest run packages/model-format/src/schema.test.ts`
Expected: PASS — 9 testes

- [ ] **Step 4: Commit**

```bash
git add packages/model-format package.json pnpm-lock.yaml
git commit -m "feat(model-format): pacote novo e schema de porta, parametro e fio"
```

---

## Task 2: O `modelet` inteiro, e as regras que só valem olhando o documento todo

**Files:**
- Create: `packages/model-format/src/modelet.ts`
- Test: `packages/model-format/src/modelet.test.ts`

Um schema de campo isolado não pega o erro que mais acontece: fio apontando para porta que
não existe. Essa regra precisa do documento inteiro, e é ela que faz o formato valer a pena.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// packages/model-format/src/modelet.test.ts
import { describe, expect, it } from "vitest";
import { parseModelet } from "./modelet.js";

const bom = `
modelet: batch-processor
version: 1
title: Processador com fila e lote
state: refined
ports:
  in:      { role: data, direction: in,  accepts: item }
  out:     { role: data, direction: out, emits: item-batch }
  dropped: { role: data, direction: drop, emits: item }
params:
  queue_capacity: { type: int, default: 2048, unit: items }
children:
  queue:   { kind: buffer }
  batcher: { kind: batch }
wires:
  - { from: in,          to: queue.in }
  - { from: queue.out,   to: batcher.in }
  - { from: queue.drop,  to: dropped }
  - { from: batcher.out, to: out }
teaches:
  - phenomenon: a fila enche e passa a descartar
    perturbation: burst na entrada
    watch: [queue.occupancy, dropped.rate]
not_modeled:
  - alocação de memória do SDK
`;

describe("parseModelet", () => {
  it("aceita um modelet completo", () => {
    const r = parseModelet(bom);
    expect(r.ok).toBe(true);
  });

  it("recusa fio que sai de porta inexistente, e diz qual", () => {
    const r = parseModelet(bom.replace("from: in,          to: queue.in", "from: entrada, to: queue.in"));
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.errors.join(" ")).toMatch(/entrada/);
  });

  it("recusa fio que entra em filho inexistente", () => {
    const r = parseModelet(bom.replace("to: batcher.in", "to: fantasma.in"));
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.errors.join(" ")).toMatch(/fantasma/);
  });

  it("recusa porta declarada e nunca ligada — porta órfã é desenho que mente", () => {
    const orfa = bom.replace("params:", "  sobrando: { role: data, direction: out, emits: item }\nparams:");
    const r = parseModelet(orfa);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.errors.join(" ")).toMatch(/sobrando/);
  });

  it("recusa parâmetro declarado e nunca usado", () => {
    const r = parseModelet(bom.replace("children:", "  nunca_usado: { type: int, default: 1, unit: items }\nchildren:"));
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.errors.join(" ")).toMatch(/nunca_usado/);
  });

  it("exige teaches: um lab que não diz o que ensina não é um lab", () => {
    const r = parseModelet(bom.replace(/teaches:[\s\S]*?not_modeled:/, "not_modeled:"));
    expect(r.ok).toBe(false);
  });

  it("acusa YAML inválido sem estourar", () => {
    const r = parseModelet("modelet: [isto: não fecha");
    expect(r.ok).toBe(false);
  });
});
```

Run: `pnpm vitest run packages/model-format/src/modelet.test.ts`
Expected: FAIL — `Failed to resolve import "./modelet.js"`

- [ ] **Step 2: Implementar `modelet.ts`**

Estrutura obrigatória (escreva o corpo seguindo os testes acima):

```ts
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { ParamSchema, PortSchema, WireSchema } from "./schema.js";

const TeachesSchema = z
  .object({
    phenomenon: z.string().min(1),
    perturbation: z.string().min(1),
    watch: z.array(z.string()).min(1),
  })
  .strict();

const ChildSchema = z.object({ kind: z.string().min(1) }).passthrough();

export const ModeletSchema = z
  .object({
    modelet: z.string().min(1),
    version: z.number().int().positive(),
    title: z.string().min(1),
    /** Quanto do interior já foi construído. `depth.md` §2. */
    state: z.enum(["opaque", "approximate", "refined"]),
    ports: z.record(PortSchema),
    params: z.record(ParamSchema).default({}),
    children: z.record(ChildSchema).default({}),
    wires: z.array(WireSchema).default([]),
    /** Um lab que não declara o que ensina não é um lab. */
    teaches: z.array(TeachesSchema).min(1),
    not_modeled: z.array(z.string()).default([]),
  })
  .strict();

export type Modelet = z.infer<typeof ModeletSchema>;

export type ParseResult =
  | { readonly ok: true; readonly value: Modelet }
  | { readonly ok: false; readonly errors: readonly string[] };

/**
 * Lê um `modelet` e recusa com mensagem que diz ao autor o que consertar.
 *
 * As checagens que exigem o documento inteiro moram aqui, não no schema de
 * campo: fio apontando para porta inexistente é o erro que mais acontece, e é
 * exatamente o que um schema por campo não vê.
 */
export function parseModelet(source: string): ParseResult {
  // 1. YAML inválido vira erro, nunca exceção que sobe
  // 2. ModeletSchema.safeParse
  // 3. checagens de coerência (abaixo), acumulando TODOS os erros antes de
  //    devolver — devolver o primeiro obriga o autor a consertar em N rodadas
}
```

As checagens de coerência, cada uma com a sua mensagem:

| Regra | Por quê |
|---|---|
| Toda ponta de fio existe: ou é uma porta do próprio `modelet`, ou é `filho.porta` de um filho declarado | Fio para o vazio é desenho que mente |
| Toda porta declarada é usada por pelo menos um fio | Porta órfã aparece no desenho e não faz nada |
| Todo `param` declarado é referenciado por algum filho (`{ param: nome }`) | Parâmetro morto vira controle que não controla |
| `watch` de cada `teaches` aponta para porta ou filho que existe | Um fenômeno que manda olhar o que não existe não ensina |

- [ ] **Step 3: Verde, depois commit**

Run: `pnpm test && pnpm typecheck && pnpm boundaries`

```bash
git add packages/model-format
git commit -m "feat(model-format): modelet validado inclusive nas regras do documento inteiro"
```

---

## Task 3: Compilar para `WorldSpec` — e recusar o que ainda não existe

**Files:**
- Create: `packages/model-format/src/compile.ts`
- Test: `packages/model-format/src/compile.test.ts`

- [ ] **Step 1: A decisão que esta tarefa toma**

O formato cita `kind`s das ondas futuras (`clock`, `batch`, `transform`, `tee`, `merge`,
`arbiter`). O motor hoje implementa oito. O compilador **recusa kind desconhecido e diz em
que onda ele chega** — fingir que compila produziria um lab que roda errado, que é pior que
um lab que não roda.

```ts
const ONDAS: Record<string, string> = {
  transform: "onda 1", tee: "onda 1", merge: "onda 1",
  batch: "onda 1", clock: "onda 1", arbiter: "onda 1",
  log: "onda 2", deliver: "onda 2", supervisor: "onda 2",
  store: "onda 3", probe: "onda 3",
};
```

Mensagem: `` `kind "clock" ainda não existe no motor — chega na onda 1 (docs/kinds.md §3)` ``.
Kind que não está nem no motor nem nas ondas é erro de digitação, e a mensagem deve dizer
isso e listar os disponíveis.

- [ ] **Step 2: Escrever o teste que falha**

Cubra, no mínimo:

- um `modelet` só com `kind`s de hoje compila para um `WorldSpec` que o `World` roda por 10
  ticks sem lançar;
- `params` do `modelet` viram `WorldSpec.params` com os defaults;
- fios de controle chegam ao `WorldSpec` com `line: "control"` e a fiação **não** os segue
  como caminho de dado (importe `resolveTarget` de `@ovh/depth-core`);
- `kind: clock` é recusado com mensagem que cita "onda 1";
- `kind: bufer` (digitado errado) é recusado com mensagem que lista os disponíveis;
- porta com `direction: "drop"` vira fio para `DROP`.

- [ ] **Step 3: Implementar, verde, commit**

```bash
git add packages/model-format
git commit -m "feat(model-format): compilador de modelet para WorldSpec"
```

---

## Task 4: Fechar a fronteira e registrar

**Files:**
- Modify: `scripts/check-boundaries.mjs`
- Modify: `docs/PROGRESS.md`
- Modify: `docs/model-format.md`

- [ ] **Step 1: `model-format` entra na guarda**

O pacote conhece `kind`, porta e fio — vocabulário do motor. Ele **não** pode conhecer
OpenTelemetry. Acrescente `packages/model-format` à lista de pacotes que o
`scripts/check-boundaries.mjs` vigia.

Cuidado conhecido: a guarda é **literal** e não entende negação. Um comentário dizendo "isto
não sabe o que é span" quebra a checagem.

- [ ] **Step 2: `model-format.md` deixa de ser só proposta**

No topo do documento, trocar o status por um que diga o que já é código e o que ainda é
proposta, com link para o pacote. Um documento de formato que não diz o que está implementado
manda o autor tentar coisas que não existem.

- [ ] **Step 3: `PROGRESS.md`**

Registrar a entrega, o que ficou de fora e as decisões que não estão no código — em especial:
**o compilador recusa kind de onda futura em vez de fingir**, e **porta órfã e parâmetro morto
são erro, não aviso**.

- [ ] **Step 4: Commit**

```bash
git add scripts docs
git commit -m "docs: formato do modelo entra na guarda de fronteira e no progresso"
```
