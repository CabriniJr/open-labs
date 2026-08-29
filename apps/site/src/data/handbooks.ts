import { labs as otelLabs, phases as otelPhases } from "./roadmap.js";

/**
 * O catálogo do OpenLabs.
 *
 * O projeto deixou de ser um handbook e passou a ser a casa de vários: cada
 * handbook é um `.model` rodando no mesmo motor composicional. O que muda de
 * um para o outro é o domínio — o motor não sabe qual é.
 *
 * Todo handbook tem a mesma anatomia, e é ela que dá a página:
 * **roadmap** (a ordem em que os conceitos se sustentam), **artigos** (o texto
 * que explica) e **labs** (o modelo que roda). Um handbook sem as três não
 * está pronto, e a página diz isso em vez de esconder.
 */
export type ItemStatus = "available" | "draft" | "coming";

export const ITEM_STATUS_LABEL: Record<ItemStatus, string> = {
  available: "ready",
  draft: "draft",
  coming: "coming",
};

export interface HandbookPhase {
  readonly number: number;
  readonly title: string;
  readonly line: string;
}

export interface HandbookItem {
  readonly id: string;
  readonly title: string;
  readonly status: ItemStatus;
  /** Fase (HandbookPhase.number) a que pertence. */
  readonly phase: number;
  readonly href?: string | undefined;
}

export interface Handbook {
  readonly id: string;
  readonly name: string;
  /** O assunto, em uma palavra ou duas. Vai na etiqueta do cartão. */
  readonly subject: string;
  readonly tagline: string;
  readonly blurb: string;
  /** O `.model` que este handbook instancia no motor. */
  readonly model: string;
  readonly stage: "building" | "planned";
  /**
   * Se o roadmap já tem mapa interativo. Só o OTel tem: o mapa é desenho
   * posicionado à mão, e desenhar o do RISC-V antes de o modelo existir seria
   * prometer um caminho que ainda não foi andado.
   */
  readonly hasMap: boolean;
  readonly phases: readonly HandbookPhase[];
  readonly articles: readonly HandbookItem[];
  readonly labs: readonly HandbookItem[];
}

const OTEL_LABS: readonly HandbookItem[] = otelLabs.map((lab) => ({
  id: lab.id,
  title: lab.title,
  status: lab.status === "available" ? "available" : "coming",
  phase: lab.phase,
}));

const OTEL_PHASE_LINES: Record<number, string> = {
  1: "Why three signals with no thread between them leave you blind.",
  2: "Trace, span, context: the shape the data has before any vendor touches it.",
  3: "SDK, Collector, backend — and what each one is allowed to change.",
  4: "Getting the signal out of code you wrote and code you did not.",
  5: "Sampling, backpressure, and the rollout that does not page anyone.",
};

const OTEL: Handbook = {
  id: "otel",
  name: "OpenTelemetry Visual Handbook",
  subject: "OpenTelemetry",
  tagline: "Watch the telemetry move, then read the bytes that moved.",
  blurb:
    "Every concept as a model you can take apart: the service graph on top, " +
    "the OTLP payload underneath, and the same running state producing both.",
  model: "otel.model",
  stage: "building",
  hasMap: true,
  phases: otelPhases.map((phase) => ({
    number: phase.number,
    title: phase.title,
    line: OTEL_PHASE_LINES[phase.number] ?? "",
  })),
  articles: [
    { id: "what-a-signal-is", title: "What a signal is", status: "coming", phase: 1 },
    { id: "context-is-the-product", title: "Context is the product", status: "coming", phase: 2 },
    { id: "who-owns-the-pipeline", title: "Who owns the pipeline", status: "coming", phase: 3 },
    { id: "instrumenting-what-you-did-not-write", title: "Instrumenting what you did not write", status: "coming", phase: 4 },
    { id: "the-cost-of-keeping-everything", title: "The cost of keeping everything", status: "coming", phase: 5 },
  ],
  labs: OTEL_LABS,
};

const RISCV: Handbook = {
  id: "riscv",
  name: "RISC-V Visual Handbook",
  subject: "the CPU",
  tagline: "Type an instruction, watch the transistors settle.",
  blurb:
    "A single-cycle RV32I datapath modelled all the way down: from the block " +
    "diagram, through registers and the ALU, to the gates and the wire that " +
    "is either high or low. You write the assembly; the model runs it.",
  model: "cpu.model",
  stage: "building",
  hasMap: false,
  phases: [
    { number: 1, title: "Signals", line: "A wire carries one bit, and time is what it takes to settle." },
    { number: 2, title: "Gates", line: "Transistors into gates, gates into adders. Nothing is a black box." },
    { number: 3, title: "Registers and the ALU", line: "Where a number waits, and where it changes." },
    { number: 4, title: "The datapath", line: "Fetch, decode, execute — as one drawing that actually runs." },
    { number: 5, title: "Control", line: "The second kind of line: the one that carries a decision, not a value." },
    { number: 6, title: "Assembly", line: "Your program is the input. The CPU is the model that consumes it." },
  ],
  articles: [
    { id: "high-or-low", title: "High or low: what a bit costs", status: "coming", phase: 1 },
    { id: "from-transistor-to-adder", title: "From transistor to adder", status: "coming", phase: 2 },
    { id: "the-register-file", title: "The register file", status: "coming", phase: 3 },
    { id: "one-instruction-end-to-end", title: "One instruction, end to end", status: "coming", phase: 4 },
    { id: "control-is-not-data", title: "Control is not data", status: "coming", phase: 5 },
    { id: "writing-rv32i", title: "Writing RV32I by hand", status: "coming", phase: 6 },
  ],
  labs: [
    { id: "the-wire", title: "One wire, one tick", status: "coming", phase: 1 },
    { id: "the-adder", title: "Build a 4-bit adder", status: "coming", phase: 2 },
    { id: "register-write", title: "Writing a register", status: "coming", phase: 3 },
    {
      id: "single-cycle-datapath",
      title: "The single-cycle datapath",
      status: "available",
      href: "labs/cpu",
    phase: 4 },
    { id: "control-lines", title: "The control lines of one opcode", status: "coming", phase: 5 },
    { id: "assemble-and-run", title: "Assemble and run your own program", status: "coming", phase: 6 },
  ],
};

export const HANDBOOKS: readonly Handbook[] = [OTEL, RISCV];

export function handbookOf(id: string): Handbook | undefined {
  return HANDBOOKS.find((handbook) => handbook.id === id);
}

/** Quantos itens de uma trilha já dá para abrir. */
export function readyCount(items: readonly HandbookItem[]): number {
  return items.filter((item) => item.status === "available").length;
}
