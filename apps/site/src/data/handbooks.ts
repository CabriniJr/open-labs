import { carregarSubmissoes } from "@ovh/handbook-format";
import type { TemaCompleto } from "../lib/tema.js";
import { raizDoRepo } from "../lib/raiz.js";
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
  /**
   * A identidade visual, e ela mora aqui pelo mesmo motivo que o mapa mora:
   * **uma fonte por fato**. Enquanto ela era um arquivo CSS por domínio, um
   * handbook podia existir sem tema e ninguém descobria até abrir a página.
   *
   * O conjunto do que ela pinta é fechado — ver `lib/tema.ts`, que explica o
   * que fica de fora e por quê.
   */
  readonly tema: TemaCompleto;
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
  /**
   * O rastro é azul, e o azul é o que este handbook tem de mais reconhecível.
   * As espécies de carga saem do que o assunto move: span, métrica, registro e
   * o que já foi empacotado para sair.
   */
  tema: {
    claro: {
      acento: "#425cc7",
      fluxo: "#425cc7",
      descarte: "#b8442a",
      ok: "#3f7a52",
      mutacao: "#f5a800",
      processador: "#425cc7",
      conduite: "#3f7a52",
      especies: ["#7c5cd6", "#3f7a52", "#c2410c", "#0e7490"],
    },
    escuro: { acento: "#8fa2ee", processador: "#8fa2ee", especies: ["#a371f7", "#3fb950", "#f0883e", "#22d3ee"] },
  },
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
   * Nota sobre o frontmatter: dizia aqui que "nenhum artigo do OTel declara
   * `lab` ainda, porque nenhum lab do OTel está no ar". Envelheceu —
   * `who-owns-the-pipeline` aponta para `labs/providers` desde a entrega 4, e
   * cinco labs do OTel estão publicados. Quem declara `lab` ganha o
   * "open the lab →" na própria página.
   */
  articles: [
    {
      id: "what-a-signal-is",
      title: "What a signal is",
      status: "available",
      phase: 1,
      href: "handbooks/otel/articles/what-a-signal-is",
    },
    {
      id: "the-seam-between-signals",
      title: "The seam between the signals",
      status: "available",
      phase: 1,
      href: "handbooks/otel/articles/the-seam-between-signals",
    },

    {
      id: "a-trace-is-a-tree-nobody-owns",
      title: "A trace is a tree nobody owns",
      status: "available",
      phase: 2,
      href: "handbooks/otel/articles/a-trace-is-a-tree-nobody-owns",
    },
    {
      id: "context-is-the-product",
      title: "Context is the product",
      status: "available",
      phase: 2,
      href: "handbooks/otel/articles/context-is-the-product",
    },
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
      status: "available",
      href: "handbooks/otel/articles/agent-or-gateway-is-a-blast-radius",
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

    {
      id: "what-an-attribute-costs",
      title: "What an attribute costs",
      status: "available",
      phase: 5,
      href: "handbooks/otel/articles/what-an-attribute-costs",
    },
    { id: "the-cost-of-keeping-everything", title: "The cost of keeping everything", status: "coming", phase: 5 },
    {
      id: "sampling-is-a-statement-about-ignorance",
      title: "Sampling is a statement about what you will not know",
      status: "available",
      href: "handbooks/otel/articles/sampling-is-a-statement-about-ignorance",
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
  /**
   * O verde-azulado do silício. A tinta viva **não** entra aqui: seta vermelha
   * é controle em qualquer diagrama de blocos, e isso é convenção, não
   * identidade — o livro-texto manda nela.
   */
  tema: {
    claro: {
      acento: "#0f766e",
      fluxo: "#0f766e",
      descarte: "#b8442a",
      ok: "#3f7a52",
      mutacao: "#c2410c",
      processador: "#0f766e",
      conduite: "#3f7a52",
      especies: ["#7c3aed", "#0f766e", "#b45309", "#be185d"],
    },
    escuro: { acento: "#5eddd0", fluxo: "#5eddd0", mutacao: "#fb923c", processador: "#5eddd0", especies: ["#a371f7", "#5eddd0", "#e3b341", "#db61a2"] },
  },
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
 * Os handbooks submetidos, lidos do disco em `handbooks/<id>/handbook.yaml`.
 *
 * Esta é a porta do caminho dourado (`docs/handbooks.md`): quem quer publicar
 * um handbook escreve **um diretório**, com dono declarado no próprio
 * manifesto, e não toca em TypeScript nenhum. O catálogo deixou de ser uma
 * lista de objetos escritos à mão e passou a ser o que existe mais o que foi
 * submetido.
 *
 * Os dois de cima — OTel e CPU — continuam em TypeScript, e isso não é
 * provisório nem dívida: eles trazem `map`, que é um desenho com coordenadas, e
 * o contrato em arquivo não descreve desenho. O caminho dourado diz o limite em
 * vez de escondê-lo, e `versoes.ts` chama o legado pelo nome — é a **versão
 * anterior** do contrato, suportada com exemplar e teste, não "o jeito antigo".
 *
 * O `algorithms` foi o primeiro a migrar porque é o que não usa nada do que
 * falta: sem mapa, sem referência externa. A prova de que a migração não mudou
 * nada está em `handbooks.test.ts`, que compara o carregado com o objeto que
 * estava escrito aqui, campo por campo.
 */
const SUBMETIDOS: readonly Handbook[] = carregarSubmissoes(raizDoRepo(), {
  raizDosArtigos: `${raizDoRepo()}/apps/site/src/content/articles`,
});

export const HANDBOOKS: readonly Handbook[] = [OTEL, CPU, ...SUBMETIDOS];

export function handbookOf(id: string): Handbook | undefined {
  return HANDBOOKS.find((handbook) => handbook.id === id);
}

/** Quantos itens de uma trilha já dá para abrir. */
export function readyCount(items: readonly HandbookItem[]): number {
  return items.filter((item) => item.status === "available").length;
}
