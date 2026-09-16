import type { AnyObject, ObjectSpec, Wire, WorldSpec } from "@ovh/depth-core";
import { spanDoHeroi } from "./carga.js";
import type { SpanDoHeroi } from "./carga.js";
import { ATRIBUTO_DO_COLLECTOR, ROTULOS_HEROI, VALOR_DO_COLLECTOR } from "./labels.js";

/**
 * O mundo do herói da landing: `service → collector → backend`.
 *
 * A menor história inteira que o OTel tem, e de propósito **não é o lab de
 * ninguém**: `providers` mora dentro do processo, `anatomy-of-a-trace` mora
 * entre quatro processos, e este é o oleoduto visto de fora, com um span
 * seguido de ponta a ponta. É o trailer — cada uma das três caixas tem um lab
 * esperando atrás dela.
 *
 * Uma delas **abre**: o collector é composto, e duplo clique nele desce para
 * `receiver → processor → exporter`. A landing prometia isso em parágrafo e o
 * modelo não tinha o que entregar; agora tem. O critério de qual caixa abre está
 * no docblock do collector, e é o mesmo desta escolha: a que nenhum lab mostra.
 *
 * Sem parâmetro nenhum de propósito: controle é assunto de lab, e o herói que
 * pede configuração já pediu demais de quem chegou agora.
 *
 * Escala de tempo: um tick é um segundo, como nos outros mundos do `otel.model`.
 */

const spansDe = (data: Readonly<Record<string, unknown>>): readonly SpanDoHeroi[] =>
  Array.isArray(data["spans"]) ? (data["spans"] as readonly SpanDoHeroi[]) : [];

/** Quantos o backend guarda antes de a vitrine virar teste de memória. */
const TETO = 40;

const servico: ObjectSpec<{ readonly n: number }> = {
  id: "service",
  kind: "source",
  label: ROTULOS_HEROI.service,
  leaf: true,
  init: () => ({ n: 0 }),
  behavior: (state, _inbox, ctx) => {
    if (ctx.phase !== "commit") return { state, out: [] };
    const n = state.n + 1;
    return {
      state: { n },
      out: [{ port: "export", message: ctx.emit("span", 1, { spans: [spanDoHeroi(n)] }) }],
    };
  },
};

/**
 * O collector: ele **acrescenta** e repassa — e é a única das três caixas que
 * abre.
 *
 * Não cria coisa nova: o span que sai é o que entrou com um campo a mais. É o
 * fato inteiro que a trilha desenha, e é por isso que o `traceId` não pode
 * mudar aqui.
 *
 * **Por que esta caixa, e não as outras duas.** O interior do processo
 * instrumentado já é um lab (`providers`: provider → tracer → span → lote →
 * exportador) e o que acontece entre processos já é outro (`anatomy-of-a-trace`).
 * O collector é a única peça do herói cujo dentro **nenhum lab mostra hoje** —
 * é a caixa-preta do pipeline. Abrir o serviço competiria com um lab existente;
 * abrir o collector ensina o que ninguém ainda tem para ensinar.
 *
 * **Quem faz o quê, e por que é o processor que acrescenta.** Num Collector de
 * verdade a configuração tem três listas, e elas não são intercambiáveis: o
 * *receiver* aceita o que chega e traduz para a representação interna, o
 * *processor* é onde o dado é transformado — `resource`, `attributes`,
 * `resourcedetection` são todos processors —, e o *exporter* serializa e manda
 * embora. Carimbar `collector.name` no receiver ou no exporter desenharia uma
 * mentira: transporte que transforma esconde onde o dado mudou. Por isso os dois
 * das pontas são `channel` — família *conduit*, que carrega e nunca altera — e
 * o do meio é o único da família *processor* aqui dentro. A forma das três
 * caixas já diz onde o campo nasce, antes de qualquer rótulo ser lido.
 *
 * **O que isto custa, dito em voz alta.** Três peças são três saltos, e cada
 * salto custa `edgeTicks`: o span que chegava ao backend no tick 5 passa a
 * chegar no 9. É o preço honesto de a caixa deixar de ser um ponto — um
 * pipeline de verdade também não atravessa de graça —, e a trilha ganha as duas
 * paradas que faltavam, com o campo aparecendo entre o processor e o exporter.
 * Nada mais muda de fora: mesmo `traceId`, mesmo `spanId`, mesmo `n`, mesma
 * emissão chegando ao backend, e a mesma fileira de três caixas na abertura.
 */
const receiver: ObjectSpec<{ readonly recebidos: number }> = {
  id: "receiver",
  kind: "channel",
  label: ROTULOS_HEROI.receiver,
  leaf: true,
  init: () => ({ recebidos: 0 }),
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit" || inbox.length === 0) return { state, out: [] };
    const spans = inbox.flatMap((m) => spansDe(m.data));
    if (spans.length === 0) return { state, out: [] };
    // Repassa **o mesmo objeto**, sem tocar em campo nenhum: o que o teste cobra
    // no fio daqui para o processor é exatamente esta ausência.
    return {
      state: { recebidos: state.recebidos + spans.length },
      out: [{ port: "out", message: ctx.emit("span", spans.length, { spans }) }],
    };
  },
};

const processor: ObjectSpec<{ readonly enriquecidos: number }> = {
  id: "processor",
  kind: "router",
  label: ROTULOS_HEROI.processor,
  leaf: true,
  init: () => ({ enriquecidos: 0 }),
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit" || inbox.length === 0) return { state, out: [] };
    const spans = inbox.flatMap((m) => spansDe(m.data));
    if (spans.length === 0) return { state, out: [] };
    // O único lugar do collector onde a carga muda — e ela muda por acréscimo:
    // mesmo `traceId`, mesmo `spanId`, mesmo `n`, um campo a mais no recurso.
    const enriquecidos = spans.map((span) => ({
      ...span,
      resource: { ...span.resource, [ATRIBUTO_DO_COLLECTOR]: VALOR_DO_COLLECTOR },
    }));
    return {
      state: { enriquecidos: state.enriquecidos + enriquecidos.length },
      out: [{ port: "out", message: ctx.emit("span", enriquecidos.length, { spans: enriquecidos }) }],
    };
  },
};

const exporter: ObjectSpec<{ readonly enviados: number }> = {
  id: "exporter",
  kind: "channel",
  label: ROTULOS_HEROI.exporter,
  leaf: true,
  init: () => ({ enviados: 0 }),
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit" || inbox.length === 0) return { state, out: [] };
    const spans = inbox.flatMap((m) => spansDe(m.data));
    if (spans.length === 0) return { state, out: [] };
    return {
      state: { enviados: state.enviados + spans.length },
      out: [{ port: "export", message: ctx.emit("span", spans.length, { spans }) }],
    };
  },
};

const collector: AnyObject = {
  id: "collector",
  kind: "composite",
  label: ROTULOS_HEROI.collector,
  entry: "receiver",
  exit: "exporter",
  children: [receiver, processor, exporter],
};

const backend: ObjectSpec<{ readonly recebidos: number; readonly spans: readonly SpanDoHeroi[] }> = {
  id: "backend",
  kind: "store",
  label: ROTULOS_HEROI.backend,
  leaf: true,
  init: () => ({ recebidos: 0, spans: [] }),
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit" || inbox.length === 0) return { state, out: [] };
    const chegando = inbox.flatMap((m) => spansDe(m.data));
    if (chegando.length === 0) return { state, out: [] };
    return {
      state: {
        recebidos: state.recebidos + chegando.length,
        spans: [...state.spans, ...chegando].slice(-TETO),
      },
      out: [],
    };
  },
};

export function heroiWorld(): WorldSpec {
  const root: AnyObject = {
    id: "pipeline",
    kind: "composite",
    label: ROTULOS_HEROI.sistema,
    entry: "service",
    exit: "backend",
    children: [servico, collector, backend],
  };

  /*
    Os fios ligam **folhas**, e não a moldura do collector, que é o mesmo idioma
    dos outros mundos da casa. Não é preciosismo de estilo: um fio declarado
    `to: "collector"` chega certo no motor — a entrada resolve para o receiver —,
    e some do desenho quando o leitor está DENTRO do collector, porque as duas
    pontas caem fora do enquadramento. Com as folhas nomeadas, a mesma linha é
    desenhada nas duas vistas: de fora ela liga as três caixas, de dentro ela
    entra pela margem e pousa no receiver.
  */
  const wires: Wire[] = [
    { from: "service", port: "export", to: "receiver" },
    { from: "receiver", port: "out", to: "processor" },
    { from: "processor", port: "out", to: "exporter" },
    { from: "exporter", port: "export", to: "backend" },
  ];

  return { id: "otel-hero", seed: 7, root, wires, params: {}, edgeTicks: 2 };
}
