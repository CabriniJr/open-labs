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
5. **Write the model and the page.** The model lives in a domain package —
   `packages/<domain>/src/<lab>/world.ts` — and the page is a React component in
   `apps/site/src/components/<Lab>.tsx`. See *Writing a model* below for the two
   ways to build the world.
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
- Parameters (a rate, a batch size) can live at L0. Composition — dragging a
  processor into a pipeline — lives at L1 or deeper. The surface stays calm.

## The shape of a lab page

1. The question
2. The model (the simulation)
3. Break it (armed failure scenarios)
4. Why it works this way (prose, with links to the spec)
5. Run it for real (`labs/<slug>/`)
6. Check yourself (2–3 questions, revealable answers)

## Writing a model

A lab is a `WorldSpec` — objects, wires, parameters — that `new World(spec)` runs
tick by tick. There are two ways to build one, and new labs should use the first.

### From a Mermaid skeleton (the default for new labs)

Decided on 2026-09-16 (`docs/superpowers/specs/2026-09-16-mermaid-como-esqueleto-design.md`):
the topology of a new lab is written in Mermaid, and no new scenario is written in
`.modelet.yaml`. The `.mmd` sits next to the behaviour that animates it —
`packages/otel-domain/src/anatomia/anatomy.mmd` is the worked example.

The skeleton carries **structure only**:

- a node per object, with its `kind` applied through `classDef`
  (`classDef servico family:processor,kind:router` + `gateway[gateway]:::servico`);
- an edge per channel, whose label is `port:message-kind` — `gateway -- "call:request" --> checkout`
  declares the port `call` and promises that what travels it is of kind `request`;
- a `subgraph` per composite;
- parameters, `seed` and `edgeTicks` in the YAML front matter.

Solid and dotted strokes are **visual emphasis**, not semantics: a control line is
declared by the `control:` prefix in the label, never by the stroke.

Behaviour stays in TypeScript. `compileSkeleton(skeleton, { overrides })` takes the
drawing and your `overrides` — `init`, `behavior`, `leaf` per node id — and returns
the `WorldSpec`. The compiler builds `source`, `buffer`, `sink` and `static` on its
own; every other `kind` needs an override, and it tells you so by name when it
refuses.

### Hand-written in TypeScript

The eight labs that predate the format build their `WorldSpec` directly. Nothing is
wrong with them and nothing forces a rewrite; a lab with heavy generated wiring
(the 32-bit adder declares hundreds of wires in a loop) is clearer this way.

### What the engine guarantees, and what it does not

Three ways a lab can be wrong while the world stays valid, the run completes and no
error appears. Each has a guard, and a new lab is expected to be under them:

| What happens | What catches it |
|---|---|
| a behaviour emits on a port with no wire | `emissoesPerdidas` (`depth-core`), swept per domain in `sem-perda.test.ts` |
| a wire leaves a port nothing emits on | `conferirDesenho` (`mermaid-skeleton`) |
| an edge label names the wrong message kind | `conferirDesenho` (`mermaid-skeleton`) |

The third one only exists for skeletons: the compiler reads the message kind from
the label and drops it — `WorldSpec.wires` has no field for it, and what actually
travels is decided by `ctx.emit(kind, …)` in the behaviour. The declaration is
normative (§3 of the design) and nothing but that guard holds it to it.

`conferirDesenho` refuses a world that has a wire leaving a composite, and says so:
the ledger key belongs to the leaf inside, not to the composite, so every such wire
would read as carrying nothing. Measured: in the CPU lab, 67 of 68 wires a naive
count calls dead leave a composite and carry cargo normally.

### The step function

Whichever way the world is built, a behaviour is a pure function of state and inbox:

- `init()` builds the state at tick 0.
- `behavior(state, inbox, ctx)` returns the **next** state and what it emits. Never
  mutate `state`.
- Randomness comes from `ctx.random()`, never `Math.random()` — it arrives already
  bound to (seed, tick, node id), so a rewind lands on exactly the state that was
  there before. Pass the optional `salt` only when the same leaf draws more than
  once in one tick and the draws must differ by purpose.
- `ctx.phase` separates `settle` (combinational, inside the tick) from `commit`
  (what crosses into the next one), and the behaviour is called in **both**. Two
  things follow, and they are structural rather than conventional: only `commit`
  keeps the state it returns — what `settle` returns as state is never read, which
  is what separates combinational logic from a memory element; and emitting on a
  port whose regime does not match the phase is **refused by the scheduler**, by
  name, rather than delivering late. So read `ctx.phase` and act in the one that is
  yours.
- Changing an input restarts the simulation at tick 0. That is deliberate: it is how
  "with this processor, what comes out changes like this" reads.
- Declare only the levels the lab actually implements.

> **Note on `Engine` and `Scenario<S>`.** `depth-core` still exports an earlier API
> built around `Scenario<S>` with `initialState`/`step`, and this guide used to
> describe it as the way to write a lab. No lab uses it: all of them go through
> `World` and `WorldSpec`. It is kept as public surface, and whether it should be
> is an open question — not a path to start a new lab on.
