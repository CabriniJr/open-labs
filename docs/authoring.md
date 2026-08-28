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
5. **Write the scenario and the page.** The scenario is a `Scenario<S>` in
   `apps/site/src/labs/<slug>/scenario.ts`; the prose lives beside it.
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

## Writing a scenario

A scenario is a pure step function over a truth state:

- `initialState(inputs)` builds the state at tick 0.
- `step(state, ctx)` returns the **next** state. Never mutate `state`.
- Randomness comes from `ctx.random()`, never `Math.random()` — the engine
  reseeds per tick so a rewind lands on exactly the state that was there before.
- Changing an input restarts the simulation at tick 0. That is deliberate: it is
  how "with this processor, what comes out changes like this" reads.
- Declare only the levels the lab actually implements.
