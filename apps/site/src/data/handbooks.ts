import { MAPA_OTEL, type RoadmapMap } from "./roadmap.js";
import { MAPA_CPU } from "./roadmap-cpu.js";
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

/**
 * O modelo de referência de onde a máquina do handbook veio, quando ela veio de
 * fora.
 *
 * Mora no catálogo, e não escrito na página, porque crédito enterrado numa
 * página que ninguém abre é crédito que não foi dado: estando aqui, a página do
 * handbook o imprime sozinha, e quem escrever o próximo handbook a partir de
 * material de terceiro encontra o campo antes de precisar inventar um lugar.
 */
export interface HandbookReference {
  readonly title: string;
  readonly author: string;
  readonly where: string;
  /** A página do handbook que conta a história inteira. */
  readonly href: string;
  /** A frase que a página imprime, curta, sem abrir a página do crédito. */
  readonly line: string;
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
   * O mapa interativo do roadmap, quando já há caminho para desenhar.
   *
   * Era um booleano e o mapa só sabia desenhar o do OTel. O RISC-V ficou sem o
   * dele porque desenhar o caminho antes de o modelo existir seria prometer o
   * que não foi andado — razão que caiu em 29/08/2026, quando o modelo passou a
   * executar RV32I e a abrir até o transistor.
   */
  readonly map?: RoadmapMap;
  readonly phases: readonly HandbookPhase[];
  readonly articles: readonly HandbookItem[];
  readonly labs: readonly HandbookItem[];
  /** De onde veio o modelo, quando ele não é nosso. */
  readonly reference?: HandbookReference;
}

/**
 * O mesmo mapeamento do lado da CPU, e pelo mesmo motivo: os labs saem do mapa,
 * fonte única.
 *
 * O `href` faltava aqui. Enquanto todo lab do OTel estava `coming`, ninguém
 * percebia — o teste de "item pronto tem para onde levar" só tem o que cobrar
 * quando existe um item pronto. O primeiro lab publicado achou o buraco, que é o
 * jeito ruim de achar: a lista prometia um lab e não levava a lugar nenhum.
 */
const OTEL_LABS: readonly HandbookItem[] = otelLabs.map((lab) => ({
  id: lab.id,
  title: lab.title,
  status: lab.status === "available" ? "available" : "coming",
  phase: lab.phase,
  ...(lab.href === "#" ? {} : { href: lab.href }),
}));

const OTEL_PHASE_LINES: Record<number, string> = {
  1: "Why three signals with no thread between them leave you blind.",
  2: "Trace, metric, log: the shape each one has before any vendor touches it.",
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
  map: MAPA_OTEL,
  phases: otelPhases.map((phase) => ({
    number: phase.number,
    title: phase.title,
    line: OTEL_PHASE_LINES[phase.number] ?? "",
  })),
  /**
   * A teoria do handbook, na ordem das cinco fases.
   *
   * Eram cinco títulos, um por fase, todos `coming` — o que é o mesmo que dizer
   * que a teoria não existia. Uma fase tem mais de um conceito que se sustenta
   * sozinho, e enfiar todos num artigo produz o texto que ninguém termina.
   *
   * A regra de pareamento: **um artigo é a teoria de um lab, ou é o degrau que
   * dois labs pisam.** Artigo sem nenhuma das duas coisas é ensaio solto, e não
   * entra.
   *
   * Item pronto tem link; item por escrever **não tem** — `href` para página que
   * ninguém escreveu é link morto em produção, e o leitor só descobre clicando.
   * Há teste dos dois lados.
   *
   * Nota sobre o frontmatter: nenhum artigo do OTel declara `lab` ainda, porque
   * nenhum lab do OTel está no ar e a página do artigo renderiza o campo como
   * "open the lab →". O primeiro lab publicado leva o campo consigo.
   */
  articles: [
    {
      id: "what-a-signal-is",
      title: "What a signal is",
      status: "available",
      phase: 1,
      href: "handbooks/otel/articles/what-a-signal-is",
    },
    { id: "the-seam-between-signals", title: "The seam between the signals", status: "coming", phase: 1 },

    { id: "a-trace-is-a-tree-nobody-owns", title: "A trace is a tree nobody owns", status: "coming", phase: 2 },
    { id: "context-is-the-product", title: "Context is the product", status: "coming", phase: 2 },
    { id: "what-a-metric-remembers", title: "What a metric remembers", status: "coming", phase: 2 },
    {
      id: "the-envelope-is-the-object-graph",
      title: "The envelope is the object graph",
      status: "available",
      phase: 2,
      href: "handbooks/otel/articles/the-envelope-is-the-object-graph",
    },

    {
      id: "who-owns-the-pipeline",
      title: "Who owns the pipeline",
      status: "available",
      phase: 3,
      href: "handbooks/otel/articles/who-owns-the-pipeline",
    },
    {
      id: "agent-or-gateway-is-a-blast-radius",
      title: "Agent or gateway is a blast-radius question",
      status: "coming",
      phase: 3,
    },

    {
      id: "instrumenting-what-you-did-not-write",
      title: "Instrumenting what you did not write",
      status: "coming",
      phase: 4,
    },
    { id: "a-library-depends-on-the-api-only", title: "A library depends on the API only", status: "coming", phase: 4 },
    {
      id: "context-does-not-cross-a-queue",
      title: "Context does not cross a queue by itself",
      status: "coming",
      phase: 4,
    },

    { id: "the-cost-of-keeping-everything", title: "The cost of keeping everything", status: "coming", phase: 5 },
    {
      id: "sampling-is-a-statement-about-ignorance",
      title: "Sampling is a statement about what you will not know",
      status: "coming",
      phase: 5,
    },
    { id: "the-rollout-nobody-noticed", title: "The rollout nobody noticed", status: "coming", phase: 5 },
  ],
  labs: OTEL_LABS,
};

/**
 * Os labs da CPU saem do mapa, e não de uma segunda lista.
 *
 * Eram duas listas escritas à mão, e elas divergiram: a página do handbook
 * anunciava como "coming" um lab que já estava no ar. Ninguém mentiu de
 * propósito — é o que duas fontes para o mesmo fato fazem sozinhas.
 */
const CPU_LABS: readonly HandbookItem[] = MAPA_CPU.labs.map((lab) => ({
  id: lab.id,
  title: lab.title,
  status: lab.status === "available" ? "available" : "coming",
  phase: lab.phase,
  ...(lab.href === "#" ? {} : { href: lab.href }),
}));

const CPU: Handbook = {
  id: "cpu",
  name: "CPU Visual Handbook",
  subject: "the CPU",
  tagline: "Type an instruction, watch the transistors settle.",
  blurb:
    "Two machines, one engine. A generic accumulator microprocessor that " +
    "spells the instruction cycle out instant by instant, and a single-cycle " +
    "RV32I datapath that does the whole thing in one. Both modelled down to " +
    "the transistor. You write the assembly; the model runs it.",
  model: "cpu.model",
  stage: "building",
  map: MAPA_CPU,
  phases: [
    { number: 1, title: "Signals", line: "A wire carries one bit, and time is what it takes to settle." },
    { number: 2, title: "Gates", line: "Transistors into gates, gates into adders. Nothing is a black box." },
    { number: 3, title: "Registers and the ALU", line: "Where a number waits, and where it changes." },
    { number: 4, title: "The instruction cycle", line: "Fetch, decode, execute — spelled out as separate instants instead of drawn as one arrow." },
    { number: 5, title: "The datapath, all at once", line: "Fetch, decode, execute — as one drawing that actually runs." },
    { number: 6, title: "Assembly", line: "Your program is the input. The CPU is the model that consumes it." },
  ],
  articles: [
    {
      id: "high-or-low",
      title: "High or low: what a bit costs",
      status: "available",
      phase: 1,
      href: "handbooks/cpu/articles/high-or-low",
    },
    {
      id: "from-transistor-to-adder",
      title: "From transistor to adder",
      status: "available",
      phase: 2,
      href: "handbooks/cpu/articles/from-transistor-to-adder",
    },
    { id: "the-register-file", title: "The register file", status: "coming", phase: 3 },
    // Segue o lab que ela explica: "control is not data" é o conceito de uma
    // unidade de controle multiciclo, que agora mora na fase 4.
    { id: "control-is-not-data", title: "Control is not data", status: "coming", phase: 4 },
    // Idem: "uma instrução, do início ao fim" é o single-cycle datapath, que
    // agora mora na fase 5.
    { id: "one-instruction-end-to-end", title: "One instruction, end to end", status: "coming", phase: 5 },
    { id: "writing-rv32i", title: "Writing RV32I by hand", status: "coming", phase: 6 },

    // Os oito da máquina genérica, na ordem do modelo de referência. Dois estão
    // escritos — o que explica por que o ciclo existe e o que atravessa dele
    // para um chip que existiu — e seis são caminho declarado.
    //
    // Item pronto tem link, item por escrever **não tem**: um `href` para uma
    // página que ninguém escreveu é link morto em produção, e o leitor só
    // descobre clicando. Há teste dos dois lados.
    { id: "structure-of-a-computer", title: "Structure of a computer", status: "coming", phase: 1 },
    { id: "buses-and-the-clock", title: "Buses and the clock", status: "coming", phase: 1 },
    {
      id: "the-registers-a-computer-cannot-do-without",
      title: "The registers a computer cannot do without",
      status: "coming",
      phase: 3,
    },
    {
      id: "from-a-sum-to-bits",
      title: "From total = 10 + 5 + 18 to bits",
      status: "coming",
      phase: 6,
    },
    { id: "instruction-formats", title: "Instruction formats", status: "coming", phase: 4 },
    {
      id: "the-instruction-cycle",
      title: "The instruction cycle",
      status: "available",
      phase: 4,
      href: "handbooks/cpu/articles/the-instruction-cycle",
    },
    // O deck conta 23 instantes para este programa e a nossa máquina gasta 29:
    // o instante dele é o quadro da animação, o nosso é o micro-passo, e o
    // título traz o número que o leitor consegue conferir no contador de ticks
    // do lab. Prometer 23 seria mandá-lo procurar um número que não está lá.
    {
      id: "one-program-twenty-nine-instants",
      title: "One program, twenty-nine instants",
      status: "coming",
      phase: 4,
    },
    {
      id: "from-the-generic-machine-to-the-8085",
      title: "From the generic machine to the 8085",
      status: "available",
      phase: 6,
      href: "handbooks/cpu/articles/from-the-generic-machine-to-the-8085",
    },
  ],
  labs: CPU_LABS,
  reference: {
    title: "Princípio de Funcionamento de um Microprocessador",
    author: "Prof. Filippo Valiante Filho",
    where: "prof.valiante.info",
    href: "handbooks/cpu/reference",
    line:
      "The machine in the instruction-cycle lab — its registers, its buses, " +
      "its two instruction formats and its example program — is reconstructed " +
      "from a lecture deck by Prof. Filippo Valiante Filho, used with his " +
      "permission. The text here is our own.",
  },
};

/**
 * O terceiro handbook: algoritmos como sistemas de peças.
 *
 * Ele existe porque a pergunta que este motor responde não é sobre hardware. É
 * sobre **coisas que se movem entre peças** — e um algoritmo é isso, visto de
 * perto: uma pilha é uma caixa que guarda, uma fila é uma esteira com política,
 * uma ordenação é carga trocando de lugar. Modelar assim não é analogia: é o
 * mesmo motor, com outro domínio, e o desenho sai do que rodou.
 *
 * As fases sobem pela mesma escada de sempre — primeiro a estrutura que guarda,
 * depois o algoritmo que a usa, depois o algoritmo que decide.
 */
const ALGORITHMS: Handbook = {
  id: "algorithms",
  name: "Algorithms Visual Handbook",
  subject: "algorithms",
  tagline: "An algorithm is a system of parts. Watch the items move.",
  blurb:
    "A stack is a box with things in it; a queue is a belt with a policy; a " +
    "sort is a load changing places. Every model here runs, and the answer " +
    "comes out of parts moving — never out of a script.",
  model: "algo.model",
  stage: "building",
  phases: [
    { number: 1, title: "What holds the data", line: "Stack, queue, table: the boxes everything else is built on." },
    { number: 2, title: "One pass at a time", line: "Evaluation and traversal, as items travelling between parts." },
    { number: 3, title: "Sorting", line: "The same load, changing places — and what each swap costs." },
    { number: 4, title: "Greedy", line: "Deciding with what is in front of you, and when that is enough." },
    { number: 5, title: "Dynamic programming", line: "A table that remembers, so the same work is never done twice." },
  ],
  articles: [
    { id: "a-stack-is-a-box", title: "A stack is a box", status: "coming", phase: 1 },
    { id: "fifo-and-backpressure", title: "FIFO, and what happens when it is full", status: "coming", phase: 1 },
    { id: "postfix-needs-no-parentheses", title: "Postfix needs no parentheses", status: "coming", phase: 2 },
    { id: "what-a-swap-costs", title: "What a swap costs", status: "coming", phase: 3 },
    { id: "when-greedy-is-right", title: "When greedy is right", status: "coming", phase: 4 },
    { id: "the-table-that-remembers", title: "The table that remembers", status: "coming", phase: 5 },
  ],
  labs: [
    {
      id: "rpn",
      title: "A stack machine, running",
      status: "available",
      phase: 2,
      href: "labs/rpn",
    },
    { id: "fifo", title: "A queue, and what fills it", status: "coming", phase: 1 },
    { id: "sorting", title: "Sorting, swap by swap", status: "coming", phase: 3 },
    { id: "greedy", title: "Greedy, and the case it misses", status: "coming", phase: 4 },
    { id: "dynamic", title: "The table that remembers", status: "coming", phase: 5 },
  ],
};

export const HANDBOOKS: readonly Handbook[] = [OTEL, CPU, ALGORITHMS];

export function handbookOf(id: string): Handbook | undefined {
  return HANDBOOKS.find((handbook) => handbook.id === id);
}

/** Quantos itens de uma trilha já dá para abrir. */
export function readyCount(items: readonly HandbookItem[]): number {
  return items.filter((item) => item.status === "available").length;
}
