# O microprocessador genérico — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reinstanciar no motor o microprocessador genérico do deck de Prof. Filippo
Valiante Filho — máquina de acumulador de 8 bits, multiciclo — e abrir a profundidade dele
até o transistor, com a tabela de tempo do slide 43 como oráculo.

**Architecture:** Um segundo mundo (`micro`) dentro de `@ovh/cpu-domain`, ao lado do RISC-V.
O tick deixa de ser a instrução e passa a ser o micro-passo (uma transferência entre
registradores). A unidade de controle vira uma máquina de fases com estado, e para isso
nasce `kind: "sequencer"` na família `controller`, que já existe em `depth-core` e não
tinha nenhum `kind`. A tabela de tempo é uma vista derivada do `WorldState`, mais grossa
que o tick: uma linha por transação de barramento.

**Tech Stack:** TypeScript, pnpm workspaces, vitest (unit), Playwright (e2e), Astro + React
(site). Comandos: `pnpm test`, `pnpm typecheck`, `pnpm boundaries`, `pnpm catalogo`.

**Spec:** `docs/superpowers/specs/2026-08-30-microprocessador-generico-design.md`

---

## O idioma do repo — leia antes de escrever qualquer teste

Estes são os nomes que **existem de verdade**. Não invente outros; não acrescente API ao
motor para facilitar um teste.

```ts
import { World, indexTree, shortcutDisagreement } from "@ovh/depth-core";

const mundo = new World(spec);   // o construtor JÁ valida: mundo inválido lança aqui
mundo.advance(6);                // anda n ticks
mundo.state;                     // o WorldState corrente
mundo.seek(3);                   // volta a um tick; `state` passa a ser o de lá
mundo.tree.parent.get(id);       // o pai de um objeto — `parent` é um Map, não um método
mundo.tree.byId.get(id);         // o objeto
```

**Não existe `runTicks`.** Para colher a sequência de estados de um run, escreva o helper
no próprio arquivo de teste:

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

**A convenção de nomes do domínio:** a função que monta o mundo do RISC-V se chama
`cpuWorld`; a do genérico se chama `microWorld`. O montador do RISC-V se chama `assemble` e
devolve um **Result** (`{ ok: true, image } | { ok: false, errors }`) em vez de lançar,
porque quem escreve o programa é o leitor do lab e erro dele não é exceção. O do genérico
segue a mesma forma e se chama `montarMicro`.

---

## Estrutura de arquivos

Criar:

| Arquivo | Responsabilidade |
| --- | --- |
| `packages/cpu-domain/src/micro/isa.ts` | A tabela de opcodes e os dois formatos. Único lugar que sabe codificar e decodificar. |
| `packages/cpu-domain/src/micro/assembler.ts` | Texto assembly → bytes. |
| `packages/cpu-domain/src/micro/fases.ts` | A máquina de fases da UC, pura, sem motor. |
| `packages/cpu-domain/src/micro/datapath.ts` | O mundo: registradores, MAR/MBR, barramentos, memórias, fiação. |
| `packages/cpu-domain/src/micro/tempo.ts` | A tabela de tempo, derivada de `WorldState`. |
| `packages/cpu-domain/src/micro/oraculo-slide43.ts` | A tabela do deck, transcrita. |
| `packages/cpu-domain/src/micro/views.ts` | As views do mundo `micro`. |
| `apps/site/src/pages/labs/micro.astro` | A página do lab. |
| `apps/site/src/components/TabelaDeTempo.tsx` | A vista da tabela no palco. |

Modificar:

| Arquivo | O quê |
| --- | --- |
| `packages/depth-core/src/model.ts` | `Kind` ganha `"sequencer"`; `FAMILY` mapeia para `controller`. |
| `packages/depth-core/src/validate.ts` | Guarda: `sequencer` não emite carga. |
| `packages/cpu-domain/src/labels.ts` | Seção `micro` em `ROTULOS` e `DESCRICOES`. |
| `packages/cpu-domain/src/datapath.ts` | A UC do RISC-V passa de `router` a `sequencer`. |
| `packages/cpu-domain/src/index.ts` | Exporta o mundo `micro`. |
| `apps/site/src/data/handbooks.ts` | `riscv` → `cpu`; artigos e labs novos. |
| `apps/site/src/data/roadmap-riscv.ts` → `roadmap-cpu.ts` | Mapa reordenado. |

**Por que `micro/` dentro de `cpu-domain` e não um pacote novo:** é o mesmo domínio e o
mesmo handbook, e a fatia de profundidade **reusa** `gates.ts` e `transistors.ts`. Um
pacote novo obrigaria a exportar essas peças para fora, que é o oposto da prova.

---

## Bloco A — o motor

### Task 1: `kind: "sequencer"` na família `controller`

**Files:**
- Modify: `packages/depth-core/src/model.ts`
- Test: `packages/depth-core/src/model.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar em `packages/depth-core/src/model.test.ts`:

```ts
it("sequencer é da família controller — a família existia sem nenhum kind", () => {
  expect(familyOf("sequencer")).toBe("controller");
});

it("a família controller tem pelo menos um kind", () => {
  const kinds: Kind[] = [
    "composite", "source", "router", "switch", "pipeline",
    "buffer", "store", "sink", "channel", "static", "sequencer",
  ];
  expect(kinds.filter((k) => familyOf(k) === "controller")).not.toHaveLength(0);
});
```

Garanta que o `import` do topo do arquivo traz `familyOf` e o tipo `Kind` de `./model.js`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run packages/depth-core/src/model.test.ts`
Expected: FAIL — o typecheck do teste recusa `"sequencer"`, que não está em `Kind`.

- [ ] **Step 3: Implementar**

Em `packages/depth-core/src/model.ts`, acrescentar o membro ao tipo:

```ts
export type Kind =
  | "composite"
  | "source"
  | "router"
  | "switch"
  | "pipeline"
  | "buffer"
  | "store"
  | "sink"
  | "sequencer"
  | "channel"
  | "static";
```

E a entrada na tabela, com o comentário que diz por que ela não é `router`:

```ts
const FAMILY: Record<Kind, Family> = {
  composite: "container",
  pipeline: "container",
  source: "processor",
  router: "processor",
  switch: "processor",
  buffer: "processor",
  store: "processor",
  sink: "processor",
  /**
   * Guarda estado entre ticks e decide por linha de controle. É o que uma
   * unidade de controle multiciclo é: uma máquina de fases.
   *
   * Não é `router`, porque `router` escolhe caminho e não lembra do tick
   * passado. Não é `store`, porque `store` guarda **carga** — e o desenho
   * mostraria a unidade de controle como memória, que ela não é. A família
   * `controller` existia desde o começo e não tinha nenhum `kind`; este é o
   * primeiro, e ele nasceu porque um modelo precisou dele, não para completar
   * a tabela.
   */
  sequencer: "controller",
  channel: "conduit",
  static: "plate",
};
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run packages/depth-core/src/model.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/depth-core/src/model.ts packages/depth-core/src/model.test.ts
git commit -m "feat(motor): nasce o kind sequencer, e a família controller deixa de ser vazia"
```

---

### Task 2: a guarda — um `sequencer` não carrega carga

**Files:**
- Modify: `packages/depth-core/src/validate.ts`
- Test: `packages/depth-core/src/validate.test.ts`

- [ ] **Step 1: Escrever os dois testes que falham**

Acrescentar em `packages/depth-core/src/validate.test.ts`:

```ts
it("recusa sequencer com aresta de dado na saída", () => {
  const spec: WorldSpec = {
    id: "t", seed: 1, params: {},
    root: {
      id: "raiz", kind: "composite", label: "raiz",
      children: [
        { id: "uc", kind: "sequencer", label: "uc", behavior: () => ({ state: null, out: [] }) },
        { id: "alvo", kind: "buffer", label: "alvo", behavior: () => ({ state: null, out: [] }) },
      ],
    },
    // sem `line: "control"`, esta é uma linha de dado
    wires: [{ from: "uc", port: "out", to: "alvo" }],
  };
  expect(() => validateWorld(spec, indexTree(spec))).toThrow(/sequencer/);
});

it("aceita sequencer que só emite por linha de controle", () => {
  const spec: WorldSpec = {
    id: "t", seed: 1, params: {},
    root: {
      id: "raiz", kind: "composite", label: "raiz",
      children: [
        { id: "uc", kind: "sequencer", label: "uc", behavior: () => ({ state: null, out: [] }) },
        { id: "alvo", kind: "buffer", label: "alvo", behavior: () => ({ state: null, out: [] }) },
      ],
    },
    wires: [{ from: "uc", port: "op", to: "alvo", line: "control", toPort: "op" }],
  };
  expect(() => validateWorld(spec, indexTree(spec))).not.toThrow();
});
```

Use os mesmos helpers de construção que os outros testes do arquivo já usam (`indexTree`
vem de `./tree.js`); se o arquivo tiver uma fábrica local de mundo, use-a em vez de montar
o objeto à mão.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run packages/depth-core/src/validate.test.ts`
Expected: FAIL — o primeiro teste não lança nada.

- [ ] **Step 3: Implementar**

Em `packages/depth-core/src/validate.ts`, dentro do `for (const wire of spec.wires)`, depois
do bloco que já calcula `const line = wire.line ?? "data"`:

```ts
    // Um `sequencer` decide; ele não está no caminho da carga. Se pudesse
    // emitir dado, a unidade de controle viraria caminho de dados por acidente
    // de fiação, e o desenho — que separa as duas espécies de linha por cor —
    // estaria mentindo sobre qual é qual. A regra é sobre o **fio**, e não
    // sobre o nó: o defeito é "esta linha carrega carga saindo de quem não
    // carrega carga".
    if (line === "data") {
      const origem = tree.byId.get(wire.from);
      if (origem !== undefined && origem.kind === "sequencer") {
        erros.push(
          `"${wire.from}" é um sequencer e a aresta "${wire.from}.${wire.port}" ` +
            `carrega dado — um sequencer emite decisão, nunca carga. ` +
            `Ou marque a aresta com line: "control" e um toPort, ou o objeto ` +
            `não é um sequencer.`,
        );
      }
    }
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run packages/depth-core/src/validate.test.ts`
Expected: PASS

- [ ] **Step 5: Teste de mutação (obrigatório, invariante central)**

Comente o bloco inteiro do Step 3, rode `pnpm vitest run packages/depth-core/src/validate.test.ts`
e confirme que o primeiro teste **falha**. Descomente e confirme que volta a passar.
Não commite o código comentado.

- [ ] **Step 6: Commit**

```bash
git add packages/depth-core/src/validate.ts packages/depth-core/src/validate.test.ts
git commit -m "feat(motor): sequencer que emite carga é recusado na construção do mundo"
```

---

### Task 3: a unidade de controle do RISC-V passa a ser `sequencer`

Família nova que só um mundo usa é um `kind` disfarçado. O RISC-V já tem a dívida escrita
no topo do arquivo; ela sai agora.

**Files:**
- Modify: `packages/cpu-domain/src/datapath.ts`
- Test: `packages/cpu-domain/src/datapath.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Em `packages/cpu-domain/src/datapath.test.ts`:

```ts
it("a unidade de controle é um sequencer, e não um router", () => {
  const mundo = new World(cpuWorld(imagem("addi x1, x0, 7")));
  expect(mundo.tree.byId.get("controle")?.kind).toBe("sequencer");
});
```

`imagem()` já existe no topo daquele arquivo — ela chama `assemble` e desembrulha o Result.
Use os imports que já estão lá.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run packages/cpu-domain/src/datapath.test.ts -t sequencer`
Expected: FAIL — recebeu `"router"`.

- [ ] **Step 3: Implementar**

Em `packages/cpu-domain/src/datapath.ts`, no objeto de id `"controle"`, trocar
`kind: "router"` por `kind: "sequencer"`. E no comentário do topo do arquivo, substituir o
parágrafo do compromisso declarado por:

```
 * A unidade de controle é `sequencer` — família `controller`. Ela era `router`
 * enquanto o catálogo não tinha um `kind` dessa família; o `micro` precisou de
 * uma UC com estado e o `kind` nasceu lá. Aqui ela não guarda estado (num
 * caminho de ciclo único não há o que guardar), mas a família está certa: ela
 * decide e não está no caminho da carga.
```

- [ ] **Step 4: Rodar a suíte inteira do domínio**

Run: `pnpm vitest run packages/cpu-domain`
Expected: PASS. Se algum teste de view ou de família quebrar, ele estava afirmando
`processor` sobre a UC — corrija a expectativa, não o modelo.

- [ ] **Step 5: Commit**

```bash
git add packages/cpu-domain/src/datapath.ts packages/cpu-domain/src/datapath.test.ts
git commit -m "refactor(cpu): a unidade de controle do RISC-V vira sequencer"
```

---

## Bloco B — a máquina genérica

### Task 4: a ISA do genérico

**Files:**
- Create: `packages/cpu-domain/src/micro/isa.ts`
- Test: `packages/cpu-domain/src/micro/isa.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

`packages/cpu-domain/src/micro/isa.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { FORMATO, OPCODES, decodificar, tamanhoEmBytes } from "./isa.js";
import type { Mnemonico } from "./isa.js";

describe("a tabela de opcodes", () => {
  it("traz os três códigos do deck, com o significado do deck", () => {
    expect(OPCODES.load).toBe(0x86);
    expect(OPCODES.add).toBe(0x8b);
    expect(OPCODES.store).toBe(0xb7);
  });

  it("nenhum código se repete — dois mnemônicos no mesmo byte é execução errada calada", () => {
    const codigos = Object.values(OPCODES);
    expect(new Set(codigos).size).toBe(codigos.length);
  });

  it("todo mnemônico tem formato, e só existem os dois formatos do slide 15", () => {
    for (const m of Object.keys(OPCODES) as Mnemonico[]) {
      expect([1, 2]).toContain(FORMATO[m]);
    }
  });

  it("formato 1 ocupa 2 bytes e formato 2 ocupa 3", () => {
    expect(tamanhoEmBytes("load")).toBe(2);
    expect(tamanhoEmBytes("store")).toBe(3);
  });

  it("decodificar é a volta de OPCODES", () => {
    for (const [m, byte] of Object.entries(OPCODES)) {
      expect(decodificar(byte)).toBe(m);
    }
  });

  it("byte que não é instrução decodifica como indefinido, e não como a primeira da tabela", () => {
    expect(decodificar(0x00)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run packages/cpu-domain/src/micro/isa.test.ts`
Expected: FAIL — `Cannot find module './isa.js'`

- [ ] **Step 3: Implementar**

`packages/cpu-domain/src/micro/isa.ts`:

```ts
/**
 * O conjunto de instruções do microprocessador genérico.
 *
 * Genérico é literal: os códigos `86`, `8B` e `B7` são os do deck de Prof.
 * Filippo Valiante Filho, e foram escolhidos por ele **sem** corresponder a
 * nenhum chip. O 8085 real aparece só no último artigo, como ponte. Manter a
 * separação é o que faz a máquina poder ser mínima.
 *
 * Este arquivo é o único lugar que sabe qual byte é qual instrução. O montador
 * escreve por aqui e o caminho de dados lê por aqui — com duas tabelas, um erro
 * de codificação apareceria como erro de execução, no lugar errado.
 */

/** Os três do deck, mais os três que o deck não tem e sem os quais não há laço. */
export type Mnemonico =
  | "load"      // AC <- valor            (deck)
  | "add"       // AC <- AC + valor       (deck)
  | "store"     // (end) <- AC            (deck)
  | "loadm"     // AC <- (end)            extensão
  | "jmp"       // PC <- end              extensão
  | "jz";       // PC <- end, se Z        extensão

/**
 * Os dois formatos do slide 15, e nenhum terceiro.
 *
 * - **1**, valores: opcode + valor. Dois bytes.
 * - **2**, endereços: opcode + parte alta + parte baixa. Três bytes.
 */
export type Formato = 1 | 2;

export const OPCODES: Readonly<Record<Mnemonico, number>> = {
  load: 0x86,
  add: 0x8b,
  store: 0xb7,
  // Livres, e arbitrários como os do deck. A única regra é não colidir, e há
  // teste cobrando a tabela inteira por injetividade.
  loadm: 0xa6,
  jmp: 0xc3,
  jz: 0xcb,
};

export const FORMATO: Readonly<Record<Mnemonico, Formato>> = {
  load: 1,
  add: 1,
  store: 2,
  loadm: 2,
  jmp: 2,
  jz: 2,
};

export const tamanhoEmBytes = (m: Mnemonico): number => (FORMATO[m] === 1 ? 2 : 3);

const PORBYTE: ReadonlyMap<number, Mnemonico> = new Map(
  (Object.entries(OPCODES) as readonly [Mnemonico, number][]).map(([m, b]) => [b, m]),
);

/** O byte de volta. Indefinido quando o byte não é instrução — e é assim que a
 *  máquina para em vez de executar lixo como se fosse programa. */
export const decodificar = (byte: number): Mnemonico | undefined => PORBYTE.get(byte);

/** O endereço onde o programa começa e onde os dados começam, como no deck. */
export const INICIO_PROGRAMA = 0x0000;
export const INICIO_DADOS = 0x2000;
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run packages/cpu-domain/src/micro/isa.test.ts`
Expected: PASS (6 testes)

- [ ] **Step 5: Commit**

```bash
git add packages/cpu-domain/src/micro/isa.ts packages/cpu-domain/src/micro/isa.test.ts
git commit -m "feat(micro): a tabela de opcodes do microprocessador genérico"
```

---

### Task 5: o montador

**Files:**
- Create: `packages/cpu-domain/src/micro/assembler.ts`
- Test: `packages/cpu-domain/src/micro/assembler.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

`packages/cpu-domain/src/micro/assembler.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { montarMicro } from "./assembler.js";
import { bytesDe } from "./assembler.test-helper.js";

const erros = (fonte: string): readonly string[] => {
  const r = montarMicro(fonte);
  if (r.ok) throw new Error("esperava erro e o montador aceitou");
  return r.errors.map((e) => e.message);
};

describe("o montador do genérico", () => {
  it("monta o programa do slide 16, byte por byte", () => {
    expect([...bytesDe(`
      LOAD  0A
      ADD   05
      ADD   12
      STORE 2000
    `)]).toEqual([0x86, 0x0a, 0x8b, 0x05, 0x8b, 0x12, 0xb7, 0x20, 0x00]);
  });

  it("quebra o endereço em parte alta e parte baixa, nessa ordem", () => {
    expect([...bytesDe("JMP 1234")]).toEqual([0xc3, 0x12, 0x34]);
  });

  it("ignora comentário depois de ; e linha em branco", () => {
    expect([...bytesDe("; nada\n\nLOAD 01 ; carrega\n")]).toEqual([0x86, 0x01]);
  });

  it("recusa valor que não cabe em um byte, dizendo o que fazer", () => {
    expect(erros("LOAD 100").join(" ")).toMatch(/um byte/);
  });

  it("recusa endereço que não cabe em dois bytes", () => {
    expect(erros("JMP 10000").join(" ")).toMatch(/dois bytes/);
  });

  it("recusa mnemônico que não existe, listando os que existem", () => {
    expect(erros("MOV 01").join(" ")).toMatch(/LOAD/);
  });

  it("o erro diz a linha, porque quem escreve o programa é o leitor do lab", () => {
    const r = montarMicro("LOAD 01\nMOV 02");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.linha).toBe(2);
  });

  it("junta os erros em vez de parar no primeiro", () => {
    expect(erros("MOV 01\nXYZ 02")).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run packages/cpu-domain/src/micro/assembler.test.ts`
Expected: FAIL — `Cannot find module './assembler.js'`

- [ ] **Step 3: Implementar**

`packages/cpu-domain/src/micro/assembler.ts`:

```ts
/**
 * Texto → bytes. Uma linha, uma instrução, hexadecimal sem prefixo — que é
 * como o deck escreve.
 *
 * O montador não inventa: ele lê a tabela de `isa.ts`. Erro dele diz ao autor
 * o que fazer, porque quem escreve o programa é o leitor do lab.
 */
import { FORMATO, OPCODES } from "./isa.js";
import type { Mnemonico } from "./isa.js";

const MNEMONICOS = Object.keys(OPCODES) as readonly Mnemonico[];

const nomes = (): string => MNEMONICOS.map((m) => m.toUpperCase()).join(", ");

export interface ErroDeMontagem {
  readonly linha: number;
  readonly message: string;
}

/**
 * Result, e não exceção — a mesma forma do `assemble` do RISC-V, e pelo mesmo
 * motivo: quem escreve o programa é o leitor do lab, e um erro dele é resposta
 * a mostrar na tela, não uma exceção a estourar.
 *
 * Junta os erros em vez de parar no primeiro: quem digitou três linhas erradas
 * quer ver as três.
 */
export type ResultadoDaMontagem =
  | { readonly ok: true; readonly bytes: Uint8Array }
  | { readonly ok: false; readonly errors: readonly ErroDeMontagem[] };

export function montarMicro(fonte: string): ResultadoDaMontagem {
  const bytes: number[] = [];
  const errors: ErroDeMontagem[] = [];

  fonte.split("\n").forEach((bruta, i) => {
    const numero = i + 1;
    const linha = bruta.split(";")[0]?.trim() ?? "";
    if (linha === "") return;

    const [nome, operando] = linha.split(/\s+/);
    const m = nome?.toLowerCase() as Mnemonico | undefined;

    if (m === undefined || !MNEMONICOS.includes(m)) {
      errors.push({
        linha: numero,
        message: `"${nome ?? ""}" não é instrução desta máquina. As que existem: ${nomes()}.`,
      });
      return;
    }
    if (operando === undefined) {
      errors.push({
        linha: numero,
        message: `${nome} precisa de um operando, em hexadecimal e sem prefixo.`,
      });
      return;
    }

    const valor = Number.parseInt(operando, 16);
    if (Number.isNaN(valor)) {
      errors.push({
        linha: numero,
        message: `"${operando}" não é hexadecimal. Escreva 0A, e não 10 nem 0x0A.`,
      });
      return;
    }

    if (FORMATO[m] === 1) {
      if (valor < 0 || valor > 0xff) {
        errors.push({
          linha: numero,
          message:
            `${nome} ${operando}: o operando é um valor e precisa caber em um byte ` +
            `(00 a FF). Para trabalhar com endereço, use STORE, LOADM, JMP ou JZ.`,
        });
        return;
      }
      bytes.push(OPCODES[m], valor);
    } else {
      if (valor < 0 || valor > 0xffff) {
        errors.push({
          linha: numero,
          message:
            `${nome} ${operando}: o operando é um endereço e precisa caber em ` +
            `dois bytes (0000 a FFFF).`,
        });
        return;
      }
      // Parte alta primeiro: é a ordem em que a máquina lê, e é a do slide 17.
      bytes.push(OPCODES[m], (valor >> 8) & 0xff, valor & 0xff);
    }
  });

  return errors.length > 0 ? { ok: false, errors } : { ok: true, bytes: Uint8Array.from(bytes) };
}
```

- [ ] **Step 4: Criar o helper que os outros testes usam**

`packages/cpu-domain/src/micro/assembler.test-helper.ts`:

```ts
/**
 * Montar e desembrulhar, para os testes que não estão testando o montador.
 *
 * Existe para que um programa mal escrito num teste de caminho de dados falhe
 * dizendo o que está errado, em vez de silenciosamente montar bytes vazios e
 * fazer o teste falhar num lugar que não tem nada a ver.
 */
import { montarMicro } from "./assembler.js";

export const bytesDe = (fonte: string): Uint8Array => {
  const r = montarMicro(fonte);
  if (!r.ok) throw new Error(r.errors.map((e) => `linha ${e.linha}: ${e.message}`).join(" | "));
  return r.bytes;
};
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm vitest run packages/cpu-domain/src/micro/assembler.test.ts`
Expected: PASS (8 testes)

- [ ] **Step 6: Commit**

```bash
git add packages/cpu-domain/src/micro/assembler.ts packages/cpu-domain/src/micro/assembler.test-helper.ts packages/cpu-domain/src/micro/assembler.test.ts
git commit -m "feat(micro): o montador do genérico, com erro que diz a linha"
```

---

### Task 6: a máquina de fases

O coração da rodada, e o único lugar onde "o ciclo de instrução" existe como tempo. Fica
puro e sem motor de propósito: dá para testar a sequência inteira sem construir mundo
nenhum, e é o arquivo que um professor lê para conferir.

**Nota sobre a contagem:** o deck desenha 22 quadros para o programa exemplo; esta máquina
faz 29 micro-passos. Não é divergência — os quadros são escolha de desenho dele (ele funde
passos que cabem no mesmo slide). O que o oráculo cobra é a **tabela** (Task 10), que tem
11 linhas nos dois. Não "conserte" isto para 22.

**Files:**
- Create: `packages/cpu-domain/src/micro/fases.ts`
- Test: `packages/cpu-domain/src/micro/fases.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

`packages/cpu-domain/src/micro/fases.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PRIMEIRA_FASE, ordensDe, proximaFase } from "./fases.js";
import type { Fase } from "./fases.js";
import type { Mnemonico } from "./isa.js";

/** Roda a máquina de fases até ela voltar ao começo. Devolve a sequência. */
const cicloDe = (m: Mnemonico, zero = false): readonly Fase[] => {
  const seq: Fase[] = [PRIMEIRA_FASE];
  let f = PRIMEIRA_FASE;
  for (let i = 0; i < 50; i++) {
    f = proximaFase(f, m, zero);
    if (f === PRIMEIRA_FASE) return seq;
    seq.push(f);
  }
  throw new Error("a máquina de fases não fechou o ciclo em 50 passos");
};

describe("a máquina de fases", () => {
  it("busca é igual para toda instrução — é o que faz dela um ciclo", () => {
    for (const m of ["load", "add", "store", "loadm", "jmp", "jz"] as Mnemonico[]) {
      expect(cicloDe(m).slice(0, 3)).toEqual([
        "end-instrucao", "busca-instrucao", "decodifica",
      ]);
    }
  });

  it("formato 1 fecha em seis micro-passos", () => {
    expect(cicloDe("load")).toHaveLength(6);
    expect(cicloDe("add")).toHaveLength(6);
  });

  it("STORE fecha em onze — dois bytes de endereço custam tempo, e é isso que o formato quer dizer", () => {
    expect(cicloDe("store")).toHaveLength(11);
  });

  it("JMP não acessa a memória de dados: ele para no desvio", () => {
    expect(cicloDe("jmp")).toEqual([
      "end-instrucao", "busca-instrucao", "decodifica",
      "end-alto", "busca-alto", "guarda-alto",
      "end-baixo", "busca-baixo", "guarda-baixo",
      "desvia",
    ]);
  });

  it("JZ percorre as mesmas fases com Z ligado ou desligado — o que muda é a ordem emitida, não o tempo", () => {
    expect(cicloDe("jz", true)).toEqual(cicloDe("jz", false));
    expect(ordensDe("desvia", "jz", true)).toContain("pc<-hl");
    expect(ordensDe("desvia", "jz", false)).not.toContain("pc<-hl");
  });

  it("o operando do ADD passa pelo temporário antes de a ULA agir — é o que o slide 43 mostra", () => {
    const ordens = ordensDe("executa-valor", "add", false);
    expect(ordens).toContain("mbr->t");
    expect(ordens).toContain("somar");
    expect(ordens).not.toContain("mbr->ac");
  });

  it("o LOAD imediato vai direto ao acumulador, sem passar pelo temporário", () => {
    const ordens = ordensDe("executa-valor", "load", false);
    expect(ordens).toContain("mbr->ac");
    expect(ordens).not.toContain("mbr->t");
  });

  it("toda fase de busca liga a leitura, e nenhuma liga leitura e escrita juntas", () => {
    const fases: Fase[] = [
      "end-instrucao", "busca-instrucao", "decodifica",
      "end-operando", "busca-operando", "executa-valor",
      "end-alto", "busca-alto", "guarda-alto",
      "end-baixo", "busca-baixo", "guarda-baixo",
      "end-dado", "acesso-dado", "desvia",
    ];
    for (const f of fases) {
      for (const m of ["load", "add", "store", "loadm", "jmp", "jz"] as Mnemonico[]) {
        const o = ordensDe(f, m, false);
        expect(o.includes("ler") && o.includes("escrever")).toBe(false);
      }
    }
  });

  it("o PC anda uma vez por byte lido do programa, e nenhuma vez a mais", () => {
    const passos = (m: Mnemonico): number =>
      cicloDe(m).filter((f) => ordensDe(f, m, false).includes("pc++")).length;
    expect(passos("load")).toBe(2);   // opcode + valor
    expect(passos("store")).toBe(3);  // opcode + alto + baixo
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run packages/cpu-domain/src/micro/fases.test.ts`
Expected: FAIL — `Cannot find module './fases.js'`

- [ ] **Step 3: Implementar**

`packages/cpu-domain/src/micro/fases.ts`:

```ts
/**
 * O ciclo de instrução, como tempo.
 *
 * É o que o caminho de dados de ciclo único do RISC-V **não** tem: lá uma
 * instrução inteira cabe num tick, e busca, decodificação e execução existem só
 * como profundidade da acomodação. Aqui cada micro-passo é um instante, e é por
 * isso que a figura anda.
 *
 * Puro e sem motor de propósito. Dá para conferir a sequência inteira sem
 * construir mundo nenhum — o que é o que um professor faz ao ler.
 *
 * As fases seguem o slide 19: cálculo de endereço de instrução, busca de
 * instrução, decodificação, cálculo de endereço do operando, busca do operando,
 * execução, cálculo de endereço do resultado, armazenamento. Nem toda instrução
 * passa por todas — e não passar é justamente o que distingue os formatos.
 */
import type { Mnemonico } from "./isa.js";
import { FORMATO } from "./isa.js";

export type Fase =
  // comum a toda instrução: o ciclo de busca
  | "end-instrucao"    // MAR <- PC
  | "busca-instrucao"  // READ
  | "decodifica"       // IR <- MBR, PC++
  // formato 1: o operando é o valor
  | "end-operando"
  | "busca-operando"
  | "executa-valor"
  // formato 2: dois bytes de endereço
  | "end-alto"
  | "busca-alto"
  | "guarda-alto"
  | "end-baixo"
  | "busca-baixo"
  | "guarda-baixo"
  // formato 2, execução: ou acessa a memória de dados, ou desvia
  | "end-dado"
  | "acesso-dado"
  | "desvia";

/**
 * Uma ordem é uma linha de controle acionada.
 *
 * Estão escritas como transferência (`origem -> destino`) porque é isso que uma
 * linha de controle faz numa máquina multiciclo: ela abre um caminho por um
 * instante. Metade do diagrama do slide 9 é vermelha, e esta lista é ela.
 */
export type Ordem =
  | "mar<-pc"
  | "ler"
  | "escrever"
  | "mbr->ir"
  | "pc++"
  | "mbr->ac"
  | "mbr->t"
  | "somar"
  | "mbr->h"
  | "mbr->l"
  | "mar<-hl"
  | "mbr<-ac"
  | "pc<-hl";

export const PRIMEIRA_FASE: Fase = "end-instrucao";

/**
 * A próxima fase.
 *
 * `m` é a instrução que está **no IR** — indefinida até `decodifica` acontecer,
 * e é por isso que só as fases depois dela a consultam. Uma máquina que
 * escolhesse o caminho antes de decodificar estaria adivinhando.
 */
export function proximaFase(fase: Fase, m: Mnemonico | undefined, _zero: boolean): Fase {
  switch (fase) {
    case "end-instrucao":
      return "busca-instrucao";
    case "busca-instrucao":
      return "decodifica";
    case "decodifica":
      if (m === undefined) return "end-instrucao";
      return FORMATO[m] === 1 ? "end-operando" : "end-alto";

    case "end-operando":
      return "busca-operando";
    case "busca-operando":
      return "executa-valor";
    case "executa-valor":
      return "end-instrucao";

    case "end-alto":
      return "busca-alto";
    case "busca-alto":
      return "guarda-alto";
    case "guarda-alto":
      return "end-baixo";
    case "end-baixo":
      return "busca-baixo";
    case "busca-baixo":
      return "guarda-baixo";
    case "guarda-baixo":
      // O desvio não toca a memória de dados: ele já tem o endereço, e o
      // endereço **é** o resultado. Store e loadm ainda precisam de uma
      // transação de barramento.
      return m === "jmp" || m === "jz" ? "desvia" : "end-dado";

    case "end-dado":
      return "acesso-dado";
    case "acesso-dado":
    case "desvia":
      return "end-instrucao";
  }
}

/**
 * O que está aceso nesta fase.
 *
 * `zero` é o bit Z do registrador de status, e ele entra em um lugar só: o
 * desvio condicional. Um desvio que não se toma **gasta o mesmo tempo** — as
 * fases são as mesmas —, e é o que a máquina de verdade faz.
 */
export function ordensDe(
  fase: Fase,
  m: Mnemonico | undefined,
  zero: boolean,
): readonly Ordem[] {
  switch (fase) {
    case "end-instrucao":
    case "end-operando":
    case "end-alto":
    case "end-baixo":
      return ["mar<-pc"];

    case "busca-instrucao":
    case "busca-operando":
    case "busca-alto":
    case "busca-baixo":
      return ["ler"];

    case "decodifica":
      return ["mbr->ir", "pc++"];

    case "executa-valor":
      // A diferença entre carregar e somar cabe em duas linhas de controle, e
      // é exatamente o que o slide 43 mostra: LOAD leva o byte ao acumulador,
      // ADD o deposita no temporário e manda a ULA agir.
      return m === "add" ? ["mbr->t", "somar", "pc++"] : ["mbr->ac", "pc++"];

    case "guarda-alto":
      return ["mbr->h", "pc++"];
    case "guarda-baixo":
      return ["mbr->l", "pc++"];

    case "end-dado":
      return ["mar<-hl"];

    case "acesso-dado":
      return m === "store" ? ["mbr<-ac", "escrever"] : ["ler", "mbr->ac"];

    case "desvia":
      // Tomar ou não tomar é a única coisa que o bit Z decide nesta máquina.
      if (m === "jmp") return ["pc<-hl"];
      return zero ? ["pc<-hl"] : [];
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run packages/cpu-domain/src/micro/fases.test.ts`
Expected: PASS (9 testes)

- [ ] **Step 5: Commit**

```bash
git add packages/cpu-domain/src/micro/fases.ts packages/cpu-domain/src/micro/fases.test.ts
git commit -m "feat(micro): o ciclo de instrução como tempo — a máquina de fases"
```

---

### Task 7: o mundo — registradores, latches, barramentos, memória

**Files:**
- Create: `packages/cpu-domain/src/micro/datapath.ts`
- Test: `packages/cpu-domain/src/micro/datapath.test.ts`

A forma segue `packages/cpu-domain/src/datapath.ts`: cada objeto é uma `const` com
`behavior`, e uma função `microWorld(programa: Uint8Array, seed?: number): WorldSpec` monta
a árvore e a fiação no fim.

Os objetos e seus `kind`:

| id | kind | o que é |
| --- | --- | --- |
| `relogio` | `source` | o pulso, como no RISC-V |
| `uc` | `sequencer` | a máquina de fases; **só emite por linha de controle** |
| `pc` | `buffer` | contador de programa, 16 bits |
| `ir` | `buffer` | registrador de instrução, 8 bits |
| `mar` | `buffer` | latch de endereços, A0:15 |
| `mbr` | `buffer` | latch de dados, D0:7 |
| `ac` | `buffer` | acumulador |
| `t` | `buffer` | temporário |
| `h`, `l` | `buffer` | registrador de endereços, alto e baixo |
| `sp` | `buffer` | ponteiro de pilha — **existe e nada o move**, como no deck |
| `status` | `buffer` | Z e C |
| `ula` | `composite` | complementador/deslocador + somador (Task 12) |
| `barramento-endereco` | `channel` | 16 vias |
| `barramento-dado` | `channel` | 8 vias |
| `memoria` | `store` | programa em `0000`, dados em `2000`, um mapa só |
| `processador`, `cpu`, `sistema` | `composite` | as molduras |

- [ ] **Step 1: Escrever o teste que falha**

`packages/cpu-domain/src/micro/datapath.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { World, indexTree } from "@ovh/depth-core";
import type { WorldSpec, WorldState } from "@ovh/depth-core";
import { bytesDe } from "./assembler.test-helper.js";
import { estadoDe, microWorld } from "./datapath.js";

const rodar = (spec: WorldSpec, ticks: number): readonly WorldState[] => {
  const mundo = new World(spec);
  const estados: WorldState[] = [mundo.state];
  for (let i = 0; i < ticks; i += 1) {
    mundo.advance(1);
    estados.push(mundo.state);
  }
  return estados;
};

const PROGRAMA_DO_SLIDE_16 = `
  LOAD  0A
  ADD   05
  ADD   12
  STORE 2000
`;

describe("o mundo do genérico", () => {
  it("é um mundo válido — o construtor do World é quem valida", () => {
    expect(() => new World(microWorld(bytesDe(PROGRAMA_DO_SLIDE_16)))).not.toThrow();
  });

  it("a unidade de controle é um sequencer e não emite nenhuma aresta de dado", () => {
    const mundo = microWorld(bytesDe(PROGRAMA_DO_SLIDE_16));
    expect(indexTree(mundo).byId.get("uc")?.kind).toBe("sequencer");
    for (const w of mundo.wires) {
      if (w.from === "uc") expect(w.line).toBe("control");
    }
  });

  it("o ponteiro de pilha existe e nenhuma instrução o move — como no deck", () => {
    const mundo = microWorld(bytesDe(PROGRAMA_DO_SLIDE_16));
    expect(indexTree(mundo).byId.get("sp")).toBeDefined();
    const estados = rodar(mundo, 40).map((s) => estadoDe(s).sp);
    expect(new Set(estados).size).toBe(1);
  });

  it("roda o programa do slide 16 e guarda 21h em 2000h", () => {
    const mundo = microWorld(bytesDe(PROGRAMA_DO_SLIDE_16));
    const fim = rodar(mundo, 40).at(-1);
    const e = estadoDe(fim!);
    expect(e.ac).toBe(0x21);
    expect(e.memoria.get(0x2000)).toBe(0x21);
  });

  it("uma instrução leva mais de um tick — é o que multiciclo quer dizer", () => {
    const estados = rodar(microWorld(bytesDe("LOAD 0A")), 10);
    const primeiroComAc = estados.findIndex((s) => estadoDe(s).ac === 0x0a);
    expect(primeiroComAc).toBeGreaterThan(1);
  });

  it("a máquina para quando o byte não é instrução, em vez de executar lixo", () => {
    const estados = rodar(microWorld(bytesDe("LOAD 0A")), 60);
    const pcs = estados.slice(-10).map((s) => estadoDe(s).pc);
    expect(new Set(pcs).size).toBe(1);
  });
});
```

Compare com `packages/cpu-domain/src/datapath.test.ts` antes de escrever: aquele arquivo é o
teste do mesmo tipo de coisa, e o idioma tem que ser o mesmo. Não invente um segundo jeito
de rodar um mundo.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run packages/cpu-domain/src/micro/datapath.test.ts`
Expected: FAIL — `Cannot find module './datapath.js'`

- [ ] **Step 3: Implementar**

Escreva `packages/cpu-domain/src/micro/datapath.ts` seguindo o desenho abaixo. O
comportamento de cada registrador é o mesmo padrão: **ele age quando a ordem que lhe diz
respeito está acesa**, e a ordem chega por `ctx.signals`.

```ts
/**
 * O caminho de dados do microprocessador genérico.
 *
 * A diferença que dá nome à rodada está aqui: **um tick é um micro-passo**, e
 * não uma instrução. A unidade de controle guarda a fase entre ticks e acende
 * as linhas que aquela fase pede; os registradores fazem o que a linha manda.
 *
 * Duas fases do motor, como sempre:
 *
 * - **acomodação** — a UC lê a fase e acende as ordens; quem foi chamado
 *   calcula. Combinacional, e o estado devolvido aqui é descartado.
 * - **confronto** — os registradores e a memória guardam.
 *
 * A memória é **uma só**, com o programa em 0000 e os dados em 2000, como no
 * deck. Não é Harvard: esta máquina tem um barramento de endereços e um de
 * dados, e é justamente por isso que buscar e executar não cabem no mesmo
 * instante. É a razão física do ciclo, e o modelo tem que mostrá-la.
 */
```

O estado do mundo, exposto por uma função só para os testes e para a tabela de tempo
lerem sem cavar em `state.nodes`:

```ts
export interface EstadoMicro {
  readonly pc: number;
  readonly ir: number;
  readonly ac: number;
  readonly t: number;
  readonly h: number;
  readonly l: number;
  readonly sp: number;
  readonly mar: number;
  readonly mbr: number;
  readonly zero: boolean;
  readonly fase: Fase;
  readonly memoria: ReadonlyMap<number, number>;
}

export function estadoDe(s: WorldState): EstadoMicro { /* lê s.nodes por id */ }
```

Regras de fiação, todas obrigatórias:

1. **Toda aresta que sai de `uc` leva `line: "control"` e `toPort`.** A Task 2 recusa o
   contrário na construção do mundo — se você errar, o erro aparece antes do teste.
2. As arestas de dado entre registradores são `timing: "clocked"`: elas atravessam a borda
   de relógio, e é isso que faz o micro-passo custar um tick.
3. `barramento-endereco` tem `width: 16` e `barramento-dado` tem `width: 8`. É marca de
   desenho e não conta nada — há teste em `depth-core` cobrando isso.
4. `mar → barramento-endereco → memoria` e `memoria ↔ barramento-dado ↔ mbr`. **Nada fala
   com a memória sem passar pelos barramentos**: se falasse, o desenho estaria mentindo
   sobre o que um barramento é, e a máquina poderia buscar e executar no mesmo instante.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run packages/cpu-domain/src/micro/datapath.test.ts`
Expected: PASS (6 testes)

- [ ] **Step 5: Rodar tudo**

Run: `pnpm test && pnpm typecheck && pnpm boundaries`
Expected: PASS nos três. `boundaries` é o que garante que `depth-core` não ganhou nenhuma
palavra como "acumulador", "MAR" ou "fase de busca".

- [ ] **Step 6: Commit**

```bash
git add packages/cpu-domain/src/micro/datapath.ts packages/cpu-domain/src/micro/datapath.test.ts
git commit -m "feat(micro): o caminho de dados do genérico — um tick é um micro-passo"
```

---

### Task 8: a tabela de tempo, derivada do livro-caixa

**Files:**
- Create: `packages/cpu-domain/src/micro/tempo.ts`
- Test: `packages/cpu-domain/src/micro/tempo.test.ts`

A tabela é a granularidade **mais grossa**: uma linha por transação de barramento, não por
tick. Ela é projeção do mesmo run — derivada dos `WorldState` —, nunca uma segunda
contabilidade. Uma tabela que a máquina "também" preenchesse enquanto executa é o defeito
da mentira silenciosa em forma de vista.

- [ ] **Step 1: Escrever os testes que falham**

`packages/cpu-domain/src/micro/tempo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { World } from "@ovh/depth-core";
import type { WorldSpec, WorldState } from "@ovh/depth-core";
import { bytesDe } from "./assembler.test-helper.js";
import { estadoDe, microWorld } from "./datapath.js";
import { tabelaDeTempo } from "./tempo.js";

const rodar = (spec: WorldSpec, ticks: number): readonly WorldState[] => {
  const mundo = new World(spec);
  const estados: WorldState[] = [mundo.state];
  for (let i = 0; i < ticks; i += 1) {
    mundo.advance(1);
    estados.push(mundo.state);
  }
  return estados;
};

const rodar = (fonte: string, ticks = 40) =>
  tabelaDeTempo(rodar(microWorld(bytesDe(fonte)), ticks));

describe("a tabela de tempo", () => {
  it("abre com a linha de inicialização, e ela traz PC zerado", () => {
    const t = rodar("LOAD 0A");
    expect(t[0]).toMatchObject({ acesso: "init", pc: 0x0000 });
  });

  it("uma linha por transação de barramento, e não por tick", () => {
    // LOAD tem duas transações (o opcode e o valor) e seis micro-passos.
    const t = rodar("LOAD 0A");
    expect(t.filter((l) => l.acesso !== "init")).toHaveLength(2);
  });

  it("(⊆) não inventa: todo endereço da tabela foi endereço de verdade no run", () => {
    const estados = rodar(microWorld(bytesDe("LOAD 0A\nADD 05")), 40);
    const marsDoRun = new Set(estados.map((s) => estadoDe(s).mar));
    for (const linha of tabelaDeTempo(estados)) {
      if (linha.acesso === "init") continue;
      expect(marsDoRun.has(linha.endereco!)).toBe(true);
    }
  });

  it("(⊇) não omite: toda escrita que mudou a memória tem linha", () => {
    const estados = rodar(microWorld(bytesDe("LOAD 07\nSTORE 2000")), 40);
    const escritas = tabelaDeTempo(estados).filter((l) => l.acesso === "write");
    expect(escritas).toHaveLength(1);
    expect(escritas[0]).toMatchObject({ endereco: 0x2000, dado: 0x07 });
  });

  it("(⊇) nenhum registrador muda de valor sem aparecer em alguma linha", () => {
    const estados = rodar(microWorld(bytesDe("LOAD 0A\nADD 05")), 40);
    const linhas = tabelaDeTempo(estados);
    const acsNaTabela = new Set(linhas.map((l) => l.ac).filter((v) => v !== undefined));
    const acsDoRun = new Set(estados.map((s) => estadoDe(s).ac));
    acsDoRun.delete(0); // o valor inicial não é mudança
    for (const v of acsDoRun) expect(acsNaTabela.has(v)).toBe(true);
  });

  it("a coluna de instrução marca onde cada instrução começa, e só ali", () => {
    const t = rodar("LOAD 0A\nADD 05");
    const marcadas = t.filter((l) => l.instrucao !== undefined);
    expect(marcadas.map((l) => l.instrucao)).toEqual(["LOAD 0A", "ADD 05"]);
  });
});
```

Acrescente `estadoDe` ao `import` de `./datapath.js` no topo do arquivo de teste.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run packages/cpu-domain/src/micro/tempo.test.ts`
Expected: FAIL — `Cannot find module './tempo.js'`

- [ ] **Step 3: Implementar**

`packages/cpu-domain/src/micro/tempo.ts`:

```ts
/**
 * A tabela de tempo — o slide 43 como vista.
 *
 * Ela é a segunda projeção do mesmo run, e a razão de existir é essa: o deck
 * tem duas granularidades (os quadros da animação e a tabela do resumo) e nós
 * temos que ter as duas **a partir de um livro-caixa só**. Se a tabela tivesse
 * contabilidade própria, provaríamos o contrário do que o projeto afirma.
 *
 * Uma linha por transação de barramento. O que aparece numa linha é o que
 * mudou por causa daquela transação: o byte que veio, e o registrador que o
 * recebeu.
 *
 * Coluna que não mudou fica **vazia**, como no deck. Repetir o valor anterior
 * encheria a tabela de números que não aconteceram naquele instante.
 */
import type { WorldState } from "@ovh/depth-core";
import { estadoDe } from "./datapath.js";
import { decodificar } from "./isa.js";

export type Acesso = "init" | "read" | "write";

export interface LinhaDeTempo {
  readonly acesso: Acesso;
  readonly endereco?: number;
  readonly dado?: number;
  readonly pc?: number;
  readonly ir?: number;
  readonly ac?: number;
  readonly t?: number;
  readonly h?: number;
  readonly l?: number;
  /** Preenchida só na linha em que uma instrução começa. */
  readonly instrucao?: string;
}

/** Só entra na linha o que mudou. Coluna que não mudou fica vazia, como no deck. */
const seMudou = (antes: number, depois: number): number | undefined =>
  antes === depois ? undefined : depois;

export function tabelaDeTempo(estados: readonly WorldState[]): readonly LinhaDeTempo[] {
  if (estados.length === 0) return [];

  const linhas: LinhaDeTempo[] = [{ acesso: "init", pc: estadoDe(estados[0]!).pc }];

  // Uma transação vai da fase que acende `ler`/`escrever` até o último
  // micro-passo antes da próxima fase de endereçamento. O que a linha mostra é
  // a diferença entre as duas pontas desse intervalo — que é a mesma coisa que
  // o palco usa para animar, lida numa granularidade mais grossa.
  let inicio: number | undefined;

  const fechar = (fim: number): void => {
    if (inicio === undefined) return;
    const a = estadoDe(estados[inicio]!);
    const b = estadoDe(estados[fim]!);
    const escrita = a.fase === "acesso-dado" && decodificar(a.ir) === "store";

    linhas.push({
      acesso: escrita ? "write" : "read",
      endereco: a.mar,
      dado: escrita ? a.ac : b.mbr,
      pc: seMudou(a.pc, b.pc),
      ir: seMudou(a.ir, b.ir),
      ac: seMudou(a.ac, b.ac),
      t: seMudou(a.t, b.t),
      h: seMudou(a.h, b.h),
      l: seMudou(a.l, b.l),
    });
    inicio = undefined;
  };

  for (let i = 1; i < estados.length; i += 1) {
    const fase = estadoDe(estados[i]!).fase;
    const acessa = fase.startsWith("busca-") || fase === "acesso-dado";
    if (acessa && inicio === undefined) inicio = i;
    else if (!acessa && inicio !== undefined) fechar(i);
  }
  fechar(estados.length - 1);

  return comInstrucoes(linhas, estados);
}

/**
 * A coluna da direita: onde cada instrução começa.
 *
 * O texto sai de `decodificar(ir)` mais os bytes de operando que as linhas
 * seguintes trouxeram — e é por isso que ele **não** é uma segunda lista
 * escrita à mão. Uma lista à mão diverge; esta não tem como.
 */
function comInstrucoes(
  linhas: readonly LinhaDeTempo[],
  _estados: readonly WorldState[],
): readonly LinhaDeTempo[] {
  return linhas.map((linha, i) => {
    if (linha.ir === undefined) return linha;
    const m = decodificar(linha.ir);
    if (m === undefined) return linha;
    const bytes = (FORMATO[m] === 1 ? [linhas[i + 1]] : [linhas[i + 1], linhas[i + 2]])
      .map((l) => l?.dado)
      .filter((d): d is number => d !== undefined);
    const hex = (n: number, casas: number): string =>
      n.toString(16).toUpperCase().padStart(casas, "0");
    const operando =
      FORMATO[m] === 1
        ? hex(bytes[0] ?? 0, 2)
        : hex(((bytes[0] ?? 0) << 8) | (bytes[1] ?? 0), 4);
    return { ...linha, instrucao: `${m.toUpperCase()} ${operando}` };
  });
}
```

Acrescente `FORMATO` ao import de `./isa.js`. Duas coisas para conferir ao implementar
`estadoDe` na Task 7, porque este arquivo depende delas: `EstadoMicro.fase` tem que ser a
fase **daquele** tick, e `mar`/`mbr` têm que refletir o latch depois do confronto do tick.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run packages/cpu-domain/src/micro/tempo.test.ts`
Expected: PASS (6 testes)

- [ ] **Step 5: Commit**

```bash
git add packages/cpu-domain/src/micro/tempo.ts packages/cpu-domain/src/micro/tempo.test.ts
git commit -m "feat(micro): a tabela de tempo como projeção do mesmo livro-caixa"
```

---

### Task 9: o oráculo do slide 43

A tarefa que dá nome à rodada. A tabela do professor é um documento que não controlamos, e
ela vira teste.

**Files:**
- Create: `packages/cpu-domain/src/micro/oraculo-slide43.ts`
- Test: `packages/cpu-domain/src/micro/oraculo-slide43.test.ts`

- [ ] **Step 1: Transcrever a tabela**

`packages/cpu-domain/src/micro/oraculo-slide43.ts`:

```ts
/**
 * O slide 43 do deck de Prof. Filippo Valiante Filho, transcrito.
 *
 * Este arquivo **não é derivado de nada nosso**. É a leitura de um documento
 * que não controlamos, e é essa a virtude dele: qualquer coisa que a nossa
 * máquina faça diferente daqui é ou defeito nosso, ou divergência deliberada —
 * e deliberada tem que estar escrita ao lado da célula, com o motivo.
 *
 * Convenção da tabela original, mantida: **coluna que não mudou fica vazia.**
 * O PC aparece já incrementado, no fim da transação que o incrementou. Na
 * escrita final ele não muda, porque escrever não avança o programa.
 *
 * Programa (slide 16):
 *   LOAD  0A
 *   ADD   05
 *   ADD   12
 *   STORE 2000
 */
import type { LinhaDeTempo } from "./tempo.js";

export const PROGRAMA_DO_SLIDE_16 = `
  LOAD  0A
  ADD   05
  ADD   12
  STORE 2000
`;

export const ORACULO_SLIDE_43: readonly LinhaDeTempo[] = [
  { acesso: "init", pc: 0x0000 },
  { acesso: "read", endereco: 0x0000, dado: 0x86, ir: 0x86, pc: 0x0001, instrucao: "LOAD 0A" },
  { acesso: "read", endereco: 0x0001, dado: 0x0a, ac: 0x0a, pc: 0x0002 },
  { acesso: "read", endereco: 0x0002, dado: 0x8b, ir: 0x8b, pc: 0x0003, instrucao: "ADD 05" },
  { acesso: "read", endereco: 0x0003, dado: 0x05, t: 0x05, ac: 0x0f, pc: 0x0004 },
  { acesso: "read", endereco: 0x0004, dado: 0x8b, ir: 0x8b, pc: 0x0005, instrucao: "ADD 12" },
  { acesso: "read", endereco: 0x0005, dado: 0x12, t: 0x12, ac: 0x21, pc: 0x0006 },
  { acesso: "read", endereco: 0x0006, dado: 0xb7, ir: 0xb7, pc: 0x0007, instrucao: "STORE 2000" },
  { acesso: "read", endereco: 0x0007, dado: 0x20, h: 0x20, pc: 0x0008 },
  { acesso: "read", endereco: 0x0008, dado: 0x00, l: 0x00, pc: 0x0009 },
  { acesso: "write", endereco: 0x2000, dado: 0x21 },
];
```

- [ ] **Step 2: Escrever o teste**

`packages/cpu-domain/src/micro/oraculo-slide43.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { World } from "@ovh/depth-core";
import type { WorldSpec, WorldState } from "@ovh/depth-core";
import { bytesDe } from "./assembler.test-helper.js";
import { microWorld } from "./datapath.js";
import { tabelaDeTempo } from "./tempo.js";
import { ORACULO_SLIDE_43, PROGRAMA_DO_SLIDE_16 } from "./oraculo-slide43.js";

const rodar = (spec: WorldSpec, ticks: number): readonly WorldState[] => {
  const mundo = new World(spec);
  const estados: WorldState[] = [mundo.state];
  for (let i = 0; i < ticks; i += 1) {
    mundo.advance(1);
    estados.push(mundo.state);
  }
  return estados;
};

describe("o oráculo do slide 43", () => {
  const nossa = tabelaDeTempo(rodar(microWorld(bytesDe(PROGRAMA_DO_SLIDE_16)), 60));

  it("tem o mesmo número de linhas", () => {
    expect(nossa).toHaveLength(ORACULO_SLIDE_43.length);
  });

  ORACULO_SLIDE_43.forEach((esperada, i) => {
    it(`linha ${i}: ${esperada.acesso} ${esperada.endereco?.toString(16) ?? ""}`, () => {
      expect(nossa[i]).toEqual(esperada);
    });
  });
});
```

Uma linha, um teste. Assim uma divergência diz **qual célula** divergiu, em vez de despejar
onze linhas de diff.

- [ ] **Step 3: Rodar**

Run: `pnpm vitest run packages/cpu-domain/src/micro/oraculo-slide43.test.ts`
Expected: PASS (12 testes). Se falhar, o defeito é quase certamente nosso — releia a fase
correspondente em `fases.ts` antes de mexer no oráculo. **Não edite o oráculo para fazer o
teste passar**: se a divergência for legítima, escreva o motivo ao lado da célula e
documente-a no arquivo.

- [ ] **Step 4: Commit**

```bash
git add packages/cpu-domain/src/micro/oraculo-slide43.ts packages/cpu-domain/src/micro/oraculo-slide43.test.ts
git commit -m "test(micro): o slide 43 vira oráculo, célula por célula"
```

---

### Task 10: o laço — o que as três instruções do deck não permitem

**Files:**
- Test: `packages/cpu-domain/src/micro/laco.test.ts`

- [ ] **Step 1: Escrever o teste**

`packages/cpu-domain/src/micro/laco.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { World } from "@ovh/depth-core";
import type { WorldSpec, WorldState } from "@ovh/depth-core";
import { bytesDe } from "./assembler.test-helper.js";
import { estadoDe, microWorld } from "./datapath.js";

const rodar = (spec: WorldSpec, ticks: number): readonly WorldState[] => {
  const mundo = new World(spec);
  const estados: WorldState[] = [mundo.state];
  for (let i = 0; i < ticks; i += 1) {
    mundo.advance(1);
    estados.push(mundo.state);
  }
  return estados;
};

/**
 * Soma 3 + 2 + 1 com um laço de verdade: um contador na memória, decrementado
 * por `ADD FF` (que é somar -1 em complemento de dois — o deck desenha o
 * complementador na ULA e é dele que estamos falando), e `JZ` saindo quando
 * ele zera.
 *
 * Sem `LOADM`, `JMP` e `JZ` este programa não existe, e é essa a justificativa
 * da extensão. Com as três instruções do deck só dá para escrever contas de
 * tamanho fixo.
 */
const SOMA_ATE_TRES = `
  LOAD  03      ; o contador começa em 3
  STORE 2000
  LOAD  00      ; o total começa em 0
  STORE 2001
; laço:
  LOADM 2001    ; total
  ADD   00      ; (o valor do contador entra aqui pelo caminho longo)
  STORE 2001
  LOADM 2000
  ADD   FF      ; contador - 1
  STORE 2000
  JZ    001C    ; fim
  JMP   000A    ; volta ao laço
; fim:
`;

describe("o laço", () => {
  it("JZ não desvia enquanto o acumulador não zera", () => {
    const estados = rodar(microWorld(bytesDe("LOAD 02\nJZ 0000\nLOAD 07")), 40);
    expect(estadoDe(estados.at(-1)!).ac).toBe(0x07);
  });

  it("JZ desvia quando o acumulador zera", () => {
    // ADD FF em 01 dá 00 e liga Z; o desvio pula o LOAD 07.
    const estados = rodar(microWorld(bytesDe("LOAD 01\nADD FF\nJZ 0009\nLOAD 07")), 60);
    expect(estadoDe(estados.at(-1)!).ac).toBe(0x00);
  });

  it("JMP volta e o programa passa duas vezes pelo mesmo endereço", () => {
    const estados = rodar(microWorld(bytesDe("LOAD 01\nJMP 0000")), 40);
    const pcs = estados.map((s) => estadoDe(s).pc);
    expect(pcs.filter((p) => p === 0x0000).length).toBeGreaterThan(1);
  });

  it("LOADM lê da memória de dados o que STORE guardou", () => {
    const estados = rodar(microWorld(bytesDe("LOAD 2A\nSTORE 2000\nLOAD 00\nLOADM 2000")), 80);
    expect(estadoDe(estados.at(-1)!).ac).toBe(0x2a);
  });

  it("um laço completo roda e o total bate", () => {
    const estados = rodar(microWorld(bytesDe(SOMA_ATE_TRES)), 600);
    expect(estadoDe(estados.at(-1)!).memoria.get(0x2000)).toBe(0x00);
  });
});
```

**Ajuste os endereços de `JZ` e `JMP` do `SOMA_ATE_TRES` contando os bytes** do programa
montado antes de rodar: cada instrução de formato 1 ocupa 2 bytes e cada uma de formato 2
ocupa 3. Rode `bytesDe(SOMA_ATE_TRES).length` primeiro e confira. Se o programa não couber
na forma acima com as seis instruções disponíveis, simplifique-o — o que o teste tem que
provar é que **existe** um laço, não que este laço específico existe.

- [ ] **Step 2: Rodar e ajustar até passar**

Run: `pnpm vitest run packages/cpu-domain/src/micro/laco.test.ts`
Expected: PASS (5 testes)

- [ ] **Step 3: Commit**

```bash
git add packages/cpu-domain/src/micro/laco.test.ts
git commit -m "test(micro): o laço que as três instruções do deck não permitem"
```

---

### Task 11: a profundidade continua onde o slide para

O deck desenha a ULA como duas caixas e não pode abrir mais. Aqui ela abre até o
transistor, **reusando** `gates.ts` e `transistors.ts`. Hoje `alu.ts` tem `LARGURA = 32`
como constante de módulo, cravada em `somador()` e em `ula()`: o primeiro passo é
parametrizar.

**Files:**
- Modify: `packages/cpu-domain/src/alu.ts`
- Modify: `packages/cpu-domain/src/micro/datapath.ts`
- Test: `packages/cpu-domain/src/micro/profundidade.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

`packages/cpu-domain/src/micro/profundidade.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { indexTree } from "@ovh/depth-core";
import { bytesDe } from "./assembler.test-helper.js";
import { microWorld } from "./datapath.js";

const caminhoAte = (id: string, mundo = microWorld(bytesDe("ADD 05"))): readonly string[] => {
  const tree = indexTree(mundo);
  const caminho: string[] = [];
  let atual: string | undefined = id;
  while (atual !== undefined) {
    caminho.unshift(atual);
    atual = tree.parent.get(atual);
  }
  return caminho;
};

describe("a profundidade do genérico", () => {
  it("a ULA tem oito bits, e são oito somadores completos de verdade", () => {
    const tree = indexTree(microWorld(bytesDe("ADD 05")));
    const somador = tree.byId.get("somador");
    expect(somador?.replicas).toBe(8);
    expect(somador?.children).toHaveLength(8);
  });

  it("do sistema até um transistor há sete níveis", () => {
    // sistema > cpu > processador > ula > somador > bit0 > porta > transistor
    const caminho = caminhoAte("bit0-xor1-nand1-nmos1");
    expect(caminho.length).toBeGreaterThanOrEqual(7);
    expect(caminho[0]).toBe("sistema");
  });

  it("o nível da porta e o do transistor vêm do que já existe, sem código de domínio novo", async () => {
    // Se este import falhar, alguém escreveu um segundo somador em vez de reusar.
    const gates = await import("../gates.js");
    const transistors = await import("../transistors.js");
    expect(typeof gates.somadorCompleto).toBe("function");
    expect(typeof transistors.portasCmosDe).toBe("function");
  });
});
```

Confira o esquema de ids que `somadorCompleto` e `portasCmosDe` geram, em
`packages/cpu-domain/src/gates.ts` e `transistors.ts`, e use um id que exista de verdade no
lugar de `bit0-xor1-nand1-nmos1`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run packages/cpu-domain/src/micro/profundidade.test.ts`
Expected: FAIL — o somador tem 32 réplicas.

- [ ] **Step 3: Parametrizar a largura em `alu.ts`**

Em `packages/cpu-domain/src/alu.ts`:

```ts
/**
 * A largura da ULA passa a ser argumento.
 *
 * Era constante de módulo enquanto havia uma máquina só. O genérico tem oito
 * bits e o RISC-V tem trinta e dois, e a prova da rodada é que a mesma
 * composição serve às duas — se ela não generalizasse, o defeito seria dela.
 *
 * `LARGURA` fica como padrão para não mudar nenhuma chamada existente.
 */
export const LARGURA = 32;

function somador(largura: number, comTransistores: boolean): { objeto: AnyObject; wires: readonly Wire[] } {
  // ... o mesmo corpo, com `largura` no lugar de `LARGURA` em todos os pontos:
  //     o Array.from, os dois laços, o teste de último bit e o `replicas`.
}

export function ula(
  comAtalho: boolean,
  comTransistores = false,
  largura: number = LARGURA,
): { objeto: AnyObject; wires: readonly Wire[] } {
  // ... `largura` no lugar de `LARGURA`, inclusive no Array.from dos pesos.
}
```

Confira também `dispersor`, `coletor`, `unidadeLogica` e `peso(i)`: se algum deles fechar
sobre `LARGURA`, ele também precisa receber a largura. **Grep antes de rodar:**
`grep -n LARGURA packages/cpu-domain/src/*.ts`

- [ ] **Step 4: Provar que o RISC-V não mudou**

Run: `pnpm vitest run packages/cpu-domain`
Expected: PASS — inclusive `differential.test.ts` e `refinamento.test.ts`. Se o
`shortcutDisagreement` da ULA falhar, o atalho fechou sobre a largura velha e também precisa
recebê-la.

- [ ] **Step 5: Usar a ULA de 8 bits no `micro`**

Em `packages/cpu-domain/src/micro/datapath.ts`, montar a ULA com
`ula(false, true, 8)` — aberta e com transistores, como o lab das portas.

- [ ] **Step 6: Rodar e ver passar**

Run: `pnpm vitest run packages/cpu-domain/src/micro`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/cpu-domain/src/alu.ts packages/cpu-domain/src/micro/
git commit -m "feat(micro): a ULA de oito bits, pela mesma composição que serve a trinta e dois"
```

---

## Bloco C — a tela

### Task 12: os rótulos e as descrições do genérico

Regra do projeto: **todo texto que o leitor vê mora em `labels.ts`**, num arquivo só, para
que a versão pt-BR para as aulas seja a troca de um arquivo. Há teste bidirecional travando
`ROTULOS` contra `DESCRICOES` — nenhum órfão dos dois lados.

**Files:**
- Modify: `packages/cpu-domain/src/labels.ts`
- Modify: `packages/cpu-domain/src/labels.test.ts`

- [ ] **Step 1: Acrescentar a seção `micro` em `ROTULOS`**

```ts
  // o microprocessador genérico
  uc: "control unit",
  mar: "address latch",
  mbr: "data latch",
  ac: "accumulator",
  temporario: "temporary register",
  regH: "H",
  regL: "L",
  sp: "stack pointer",
  ir: "IR",
  status: "status register",
  barramentoEndereco: "address bus",
  barramentoDado: "data bus",
  memoriaUnica: "memory",
```

- [ ] **Step 2: Acrescentar as descrições correspondentes em `DESCRICOES`**

A descrição diz **o que a peça é no domínio**, nunca o `kind` do motor. É a lição da Ficha:
o leitor clica em `MAR` e tem que descobrir que ali fica o endereço que está no barramento
neste instante, não que aquilo é um `buffer` de capacidade um.

```ts
  mar: "Holds the address the CPU is putting on the address bus right now. " +
       "The CPU cannot name a memory cell any other way.",
  mbr: "Holds the byte in transit between the CPU and memory — the one just " +
       "read, or the one about to be written.",
  ac: "Where arithmetic happens. Almost every instruction of this machine " +
      "either fills it or changes it.",
  temporario: "Where the second operand waits while the ALU adds. It is why " +
              "ADD takes one more instant than LOAD.",
  sp: "Declared and unused: this machine has no instruction that moves it. " +
      "The reference model lists it among the registers and never uses it, " +
      "and so do we.",
  uc: "Keeps the phase of the instruction cycle and lights the control lines " +
      "that phase calls for. It decides; it never carries a value.",
```

Escreva uma para cada rótulo novo — o teste bidirecional falha se faltar uma.

- [ ] **Step 3: Rodar**

Run: `pnpm vitest run packages/cpu-domain/src/labels.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/cpu-domain/src/labels.ts packages/cpu-domain/src/labels.test.ts
git commit -m "feat(micro): os rótulos e as descrições do genérico, no arquivo de sempre"
```

---

### Task 13: as views e a página do lab

**Files:**
- Create: `packages/cpu-domain/src/micro/views.ts`
- Create: `apps/site/src/components/MicroLab.tsx`
- Create: `apps/site/src/components/MicroLab.css`
- Create: `apps/site/src/pages/labs/micro.astro`
- Test: `apps/site/tests/micro-lab.spec.ts`

Siga `packages/cpu-domain/src/views.ts`, `apps/site/src/components/CpuLab.tsx` e
`apps/site/src/pages/labs/cpu.astro` — mesma estrutura, mesmos imports de `stage.css`.

**Regra de cor, não negociável:** nenhuma cor ou forma escrita aqui. Tudo sai do catálogo
de `depth-ui` por **nome de sentido**, e `pnpm catalogo` reprova tinta escrita fora. Os
níveis 1 a 3 declaram `View.registro` de blocos (preta é dado, vermelha é controle); do
somador para baixo, o registro do esquemático.

As views:

| id | foco | o que enquadra |
| --- | --- | --- |
| `micro-sistema` | `sistema` | o slide 9: memória à esquerda, CPU à direita, os três barramentos |
| `micro-cpu` | `cpu` | UC em cima, processador embaixo |
| `micro-processador` | `processador` | AC, T, H/L, MAR, MBR, ULA, barramento interno |

- [ ] **Step 1: Escrever o e2e que falha**

`apps/site/tests/micro-lab.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("o lab do genérico carrega e mostra o ciclo de instrução", async ({ page }) => {
  await page.goto("/labs/micro");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("[data-no='ac']")).toBeVisible();
  await expect(page.locator("[data-no='mar']")).toBeVisible();
  await expect(page.locator("[data-no='uc']")).toBeVisible();
});

test("a fase muda de um tick para o outro — é o que o RISC-V não mostra", async ({ page }) => {
  await page.goto("/labs/micro");
  const fase = page.locator("[data-fase]");
  const antes = await fase.getAttribute("data-fase");
  await page.getByRole("button", { name: /step|next tick/i }).click();
  await expect(fase).not.toHaveAttribute("data-fase", antes!);
});

test("dá para descer do somador até um transistor", async ({ page }) => {
  await page.goto("/labs/micro");
  await page.locator("[data-no='ula']").dblclick();
  await page.locator("[data-no='somador']").dblclick();
  await expect(page.locator("[data-no^='bit0']")).toBeVisible();
});
```

Confira os seletores reais que `Stage` emite (`data-no`, `data-alto`, o nome do botão de
avançar) em `apps/site/tests/cpu-lab.spec.ts` e use os mesmos. **Não invente atributo
novo** — se a fase não estiver exposta em nenhum atributo, acrescente `data-fase` no
componente do palco do lab, não no motor.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @ovh/site exec playwright test tests/micro-lab.spec.ts`
Expected: FAIL — 404 em `/labs/micro`

- [ ] **Step 3: Implementar views, componente e página**

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @ovh/site exec playwright test tests/micro-lab.spec.ts`
Expected: PASS (3 testes)

- [ ] **Step 5: O catálogo e o build**

Run: `pnpm catalogo && pnpm build`
Expected: PASS nos dois.

- [ ] **Step 6: Olhar o desenho**

Abra `/labs/micro` no navegador e olhe. Defeito que só a tela pega existe — separar trilhos
por `source` contra `sink` já passou em typecheck, fronteira, catálogo e 149 e2e pintando os
dois de vermelho. Confira: as linhas da UC estão vermelhas, as de dado pretas, e a legenda
do palco diz a convenção do nível em que você está.

- [ ] **Step 7: Commit**

```bash
git add packages/cpu-domain/src/micro/views.ts apps/site/src/components/MicroLab.tsx apps/site/src/components/MicroLab.css apps/site/src/pages/labs/micro.astro apps/site/tests/micro-lab.spec.ts
git commit -m "feat(micro): o lab do genérico, com o ciclo de instrução acontecendo em tempo"
```

---

### Task 14: a tabela de tempo na tela

**Files:**
- Create: `apps/site/src/components/TabelaDeTempo.tsx`
- Modify: `apps/site/src/components/MicroLab.tsx`
- Test: `apps/site/tests/tabela-de-tempo.spec.ts`

- [ ] **Step 1: Escrever o e2e que falha**

`apps/site/tests/tabela-de-tempo.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("a tabela de tempo cresce conforme o programa roda", async ({ page }) => {
  await page.goto("/labs/micro");
  const linhas = page.locator("[data-linha-de-tempo]");
  const antes = await linhas.count();
  for (let i = 0; i < 12; i++) {
    await page.getByRole("button", { name: /step|next tick/i }).click();
  }
  expect(await linhas.count()).toBeGreaterThan(antes);
});

test("coluna que não mudou fica vazia, como na tabela original", async ({ page }) => {
  await page.goto("/labs/micro");
  for (let i = 0; i < 6; i++) {
    await page.getByRole("button", { name: /step|next tick/i }).click();
  }
  // A segunda transação carrega o acumulador e não toca o IR.
  const linha = page.locator("[data-linha-de-tempo]").nth(2);
  await expect(linha.locator("[data-coluna='ir']")).toHaveText("");
});

test("a tabela e o palco contam a mesma história: o AC da última linha é o AC do palco", async ({ page }) => {
  await page.goto("/labs/micro");
  for (let i = 0; i < 12; i++) {
    await page.getByRole("button", { name: /step|next tick/i }).click();
  }
  const naTabela = await page
    .locator("[data-linha-de-tempo] [data-coluna='ac']:not(:empty)")
    .last()
    .textContent();
  const noPalco = await page.locator("[data-no='ac'] [data-valor]").textContent();
  expect(naTabela?.trim()).toBe(noPalco?.trim());
});

test("a tabela é a projeção mais grossa: menos linhas do que ticks", async ({ page }) => {
  await page.goto("/labs/micro");
  for (let i = 0; i < 12; i++) {
    await page.getByRole("button", { name: /step|next tick/i }).click();
  }
  expect(await page.locator("[data-linha-de-tempo]").count()).toBeLessThan(12);
});
```

O terceiro teste é o que importa: ele cobra que as duas vistas **não podem divergir**, que é
a tese do projeto num caso que veio de fora.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @ovh/site exec playwright test tests/tabela-de-tempo.spec.ts`
Expected: FAIL — não existe `[data-linha-de-tempo]`

- [ ] **Step 3: Implementar**

`TabelaDeTempo.tsx` recebe `readonly LinhaDeTempo[]` de `tabelaDeTempo(estados)` e desenha.
Ele **não recebe o mundo** e não calcula nada: se calculasse, seria a segunda contabilidade.
Colunas na ordem do slide 43: Controle (READ/WRITE) | Barramentos (End., Dados) |
Registradores (PC, IR, AC, T, H, L) | Instrução. Célula vazia quando o campo é `undefined`.
Cor e forma pelo catálogo.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @ovh/site exec playwright test tests/tabela-de-tempo.spec.ts`
Expected: PASS (4 testes)

- [ ] **Step 5: Commit**

```bash
git add apps/site/src/components/TabelaDeTempo.tsx apps/site/src/components/MicroLab.tsx apps/site/tests/tabela-de-tempo.spec.ts
git commit -m "feat(micro): a tabela de tempo na tela, e ela não pode divergir do palco"
```

---

### Task 15: o espaguete do lab novo

**Files:**
- Modify: `apps/site/tests/espaguete.spec.ts`

- [ ] **Step 1: Acrescentar o lab ao teste, com teto e sem folga**

Siga exatamente a forma dos labs que já estão lá. Regras que valem: **sobreposição cega é
zero** — dois fios sem ponta em comum na mesma reta —, o T ganha pontinho de junção e o X
não, e a ponta do fio mira a outra ponta (a saída mira o destino, a entrada mira a origem).

- [ ] **Step 2: Rodar, medir, apertar o teto**

Run: `pnpm --filter @ovh/site exec playwright test tests/espaguete.spec.ts`

Anote o número medido e ponha o teto **nele**, não acima. Teto com folga é teto que não
cobra nada. Se o número for alto, o conserto é o roteamento — não o teto.

- [ ] **Step 3: Commit**

```bash
git add apps/site/tests/espaguete.spec.ts
git commit -m "test(micro): o espaguete do lab do genérico, medido e travado"
```

---

## Bloco D — o handbook

### Task 16: o handbook passa a se chamar `cpu`

**Files:**
- Modify: `apps/site/src/data/handbooks.ts`
- Rename: `apps/site/src/data/roadmap-riscv.ts` → `roadmap-cpu.ts`
- Modify: `apps/site/src/pages/handbooks/[id].astro` e tudo que aponte para `handbooks/riscv`
- Test: `apps/site/tests/handbooks.spec.ts` (ou o arquivo e2e que já cobre o catálogo)

- [ ] **Step 1: Achar todas as ocorrências**

```bash
grep -rn "riscv" apps/site/src packages --include=*.ts --include=*.tsx --include=*.astro | grep -v node_modules
```

- [ ] **Step 2: Escrever o teste que falha**

```ts
test("o handbook da CPU se chama pelo que ele é", async ({ page }) => {
  await page.goto("/handbooks/cpu");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("CPU");
});
```

- [ ] **Step 3: Renomear**

`id: "riscv"` → `id: "cpu"`; `name: "RISC-V Visual Handbook"` → `"CPU Visual Handbook"`;
`subject: "the CPU"` fica. O `blurb` passa a falar das **duas** máquinas:

```ts
  blurb:
    "Two machines, one engine. A generic accumulator microprocessor that " +
    "spells the instruction cycle out instant by instant, and a single-cycle " +
    "RV32I datapath that does the whole thing in one. Both modelled down to " +
    "the transistor. You write the assembly; the model runs it.",
```

Chave de progresso do mapa: `"ovh:progress:riscv:v1"` → `"ovh:progress:cpu:v2"`. **`v2` não
é enfeite:** sem trocar, o progresso guardado no navegador de um leitor apontaria para nós
que mudaram de fase, e ele veria marcado o que não fez.

- [ ] **Step 4: Rodar tudo**

Run: `pnpm test && pnpm typecheck && pnpm build && pnpm --filter @ovh/site exec playwright test`
Expected: PASS. Qualquer link morto aparece aqui.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(handbook): RISC-V Visual Handbook vira CPU Visual Handbook"
```

---

### Task 17: o mapa reordenado

**Files:**
- Modify: `apps/site/src/data/roadmap-cpu.ts`
- Modify: `apps/site/src/data/handbooks.ts`

Nenhum placeholder novo nasce; um morre. O vazio `control-lines` da fase 5 é preenchido
pelo lab do genérico, porque a UC multiciclo **é** as linhas de controle de um opcode, em
tempo.

- [ ] **Step 1: Escrever o teste que falha**

O projeto já tem três testes travando "fonte única": item pronto tem link, item não escrito
não tem, e mapa e lista contam a mesma história. Acrescente ao mesmo arquivo:

```ts
test("o lab do genérico vem antes do RISC-V no mapa", async ({ page }) => {
  await page.goto("/handbooks/cpu");
  const labs = await page.locator("[data-lab-id]").allTextContents();
  const iMicro = labs.findIndex((t) => /instruction cycle/i.test(t));
  const iRiscv = labs.findIndex((t) => /all at once/i.test(t));
  expect(iMicro).toBeGreaterThanOrEqual(0);
  expect(iMicro).toBeLessThan(iRiscv);
});

test("nenhum placeholder novo: o vazio das linhas de controle sumiu", async ({ page }) => {
  await page.goto("/handbooks/cpu");
  await expect(page.getByText("The control lines of one opcode")).toHaveCount(0);
});
```

- [ ] **Step 2: Reordenar**

Em `roadmap-cpu.ts`:

```ts
const phases: readonly RoadmapPhase[] = [
  { number: 1, title: "Signals", y: 40 },
  { number: 2, title: "Gates", y: 150 },
  { number: 3, title: "Registers and the ALU", y: 260 },
  { number: 4, title: "The instruction cycle", y: 370 },
  { number: 5, title: "The datapath, all at once", y: 480 },
  { number: 6, title: "Assembly", y: 590 },
];
```

Nos labs: `control-lines` sai; entra

```ts
  // A máquina genérica do deck de referência. Ela ocupa o lugar que o vazio
  // "control lines of one opcode" ocupava, e não é substituição arbitrária: uma
  // unidade de controle multiciclo **é** as linhas de controle de um opcode,
  // desenroladas no tempo.
  { id: "instruction-cycle", title: "One instruction, instant by instant", href: "labs/micro", status: "available", side: "left", y: 422, phase: 4 },
```

e `single-cycle-datapath` muda para `phase: 5`, `y: 532`, `side: "right"`, título
`"The whole cycle in one tick"`.

Anexo novo:

```ts
  { id: "generic-isa", title: "The generic ISA", y: 422, afterLab: "instruction-cycle" },
```

Espelhe as mesmas mudanças na lista `labs` de `handbooks.ts` — ou, melhor, confira se a
lista já é derivada do mapa (é a regra "uma fonte só por fato", e ela foi instituída
exatamente por causa de duas listas escritas à mão que divergiram). Se ainda houver lista à
mão, **derive-a do mapa nesta tarefa**.

- [ ] **Step 3: Rodar**

Run: `pnpm --filter @ovh/site exec playwright test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/site/src/data/
git commit -m "feat(handbook): o mapa da CPU reordenado — o ciclo antes do ciclo único"
```

---

### Task 18: os artigos e o crédito

Os oito artigos da §D9 da spec são um trabalho de escrita que não cabe honestamente neste
plano. Aqui entram **os dois sem os quais o lab não se sustenta** — o que explica o ciclo e
o que faz a ponte para o 8085 — e os outros seis entram no catálogo como `coming`, que é o
que o site já sabe dizer sem mentir.

**Files:**
- Create: `apps/site/src/pages/handbooks/cpu/articles/the-instruction-cycle.mdx` (ou a
  extensão que os artigos existentes usam — confira em `apps/site/src/pages/handbooks/`)
- Create: `apps/site/src/pages/handbooks/cpu/articles/from-the-generic-machine-to-the-8085.mdx`
- Create: `apps/site/src/pages/handbooks/cpu/reference.mdx` (o crédito)
- Modify: `apps/site/src/data/handbooks.ts`

- [ ] **Step 1: Registrar os oito artigos no catálogo**

Na ordem da §D9, com `status: "available"` nos dois que serão escritos e `"coming"` nos
seis restantes, e `href` **só** nos disponíveis — a regra travada por teste é que item
pronto tem link e item não escrito não tem.

- [ ] **Step 2: Escrever "The instruction cycle"**

Cobre: por que buscar e executar não cabem no mesmo instante (uma memória, um barramento de
endereços, um de dados); as fases do slide 19; e a leitura da tabela de tempo do lab. Em
inglês. **Toda afirmação técnica se sustenta sozinha** — o deck dá a ordem e o modelo, nunca
a prosa.

- [ ] **Step 3: Escrever "From the generic machine to the 8085"**

A mesma conta do programa exemplo escrita na ISA de um chip que existiu:

```
MVI  A,0Ah      ; A <- 0Ah
ADI  05h        ; A <- A + 05h
ADI  12h        ; A <- A + 12h
LXI  H,2000h    ; H <- 20h, L <- 00h
MOV  M,A        ; (H,L) <- A
```

e o código de máquina `3E 0A / C6 05 / C6 12 / 21 20 00 / 77`. O ponto do artigo é o que
muda e o que não muda: a máquina genérica não é uma simplificação mentirosa do 8085, é a
mesma ideia com outros números.

- [ ] **Step 4: A página de crédito**

Uma página curta no handbook, e uma nota no rodapé do lab:

> The reference model for this machine — its registers, its buses, its two instruction
> formats and its example program — comes from *Princípio de Funcionamento de um
> Microprocessador*, by Prof. Filippo Valiante Filho (prof.valiante.info), used with his
> permission. The text here is our own.

- [ ] **Step 5: Rodar**

Run: `pnpm build && pnpm --filter @ovh/site exec playwright test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/site/src/pages/handbooks/cpu apps/site/src/data/handbooks.ts
git commit -m "docs(handbook): o ciclo de instrução, a ponte para o 8085, e o crédito"
```

---

### Task 19: fechar a rodada

- [ ] **Step 1: A suíte inteira**

Run: `pnpm test && pnpm typecheck && pnpm boundaries && pnpm catalogo && pnpm build && pnpm --filter @ovh/site exec playwright test`
Expected: PASS em tudo. Anote os números (unit, e2e) — eles vão para o `PROGRESS.md`.

- [ ] **Step 2: Conferir os sete critérios da spec**

Percorra a §"Como saber se deu certo" do design e confirme um por um, com o comando que
prova cada um. Critério sem comando que o prove não está atendido.

- [ ] **Step 3: Atualizar `docs/PROGRESS.md` e `docs/roadmap.md`**

Convenção do projeto: atualizar ao fechar cada sessão. No roadmap, registre que a F6 ganhou
o mundo `micro` e que a família `controller` deixou de ser vazia.

- [ ] **Step 4: Commit**

```bash
git add docs/PROGRESS.md docs/roadmap.md
git commit -m "docs: registra o microprocessador genérico e o kind sequencer"
```

---

## Auto-revisão do plano

**Cobertura da spec:**

| Seção do design | Tarefa |
| --- | --- |
| D1 — segundo mundo | 7 |
| D2 — ISA fiel + extensão | 4, 5, 10 |
| D3 — tick = micro-passo | 6, 7 |
| D4 — `kind: "sequencer"` | 1, 2, 3 |
| D5 — profundidade até o transistor | 11 |
| D6 — tabela de tempo, vista e oráculo | 8, 9, 14 |
| D7 — handbook vira `cpu` | 16 |
| D8 — mapa reordenado | 17 |
| D9 — artigos | 18 (dois escritos, seis registrados como `coming`) |
| D10 — crédito | 18 |
| Fora de escopo (INT, pilha, SUB, ULA inteira em transistores) | nenhuma, e é assim que tem que ser |
| Critérios de sucesso 1–7 | 19 |

**Desvio declarado:** a §D9 pede oito artigos e o plano escreve dois. Os outros seis são um
plano de escrita à parte; registrá-los como `coming` é o que o site já sabe fazer sem
mentir. Se o Luigi quiser os oito nesta rodada, é uma tarefa 18b e não uma mudança de
desenho.
