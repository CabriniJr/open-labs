import type { AnyObject, Emission, ObjectSpec, Wire, WorldSpec } from "@ovh/depth-core";
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
 * O collector: ele **acrescenta** e repassa.
 *
 * Não cria coisa nova — o span que sai é o que entrou com um campo a mais. É o
 * fato inteiro que a trilha desenha, e é por isso que o `traceId` não pode
 * mudar aqui.
 */
const collector: ObjectSpec<{ readonly passaram: number }> = {
  id: "collector",
  kind: "router",
  label: ROTULOS_HEROI.collector,
  leaf: true,
  init: () => ({ passaram: 0 }),
  behavior: (state, inbox, ctx) => {
    if (ctx.phase !== "commit" || inbox.length === 0) return { state, out: [] };
    const spans = inbox.flatMap((m) => spansDe(m.data));
    if (spans.length === 0) return { state, out: [] };
    const enriquecidos = spans.map((span) => ({
      ...span,
      resource: { ...span.resource, [ATRIBUTO_DO_COLLECTOR]: VALOR_DO_COLLECTOR },
    }));
    const out: Emission[] = [
      { port: "export", message: ctx.emit("span", enriquecidos.length, { spans: enriquecidos }) },
    ];
    return { state: { passaram: state.passaram + spans.length }, out };
  },
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

  const wires: Wire[] = [
    { from: "service", port: "export", to: "collector" },
    { from: "collector", port: "export", to: "backend" },
  ];

  return { id: "otel-hero", seed: 7, root, wires, params: {}, edgeTicks: 2 };
}
