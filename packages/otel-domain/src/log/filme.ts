import { film, line, pt, type Box, type Film, type Tone } from "@ovh/motion";
import { ICONES_OTEL as I } from "../icones/icones.js";
import { contextoAtivo, juntar, OPCOES_DO_LOG, rodarLog, type EstadoDoLog, type OpcoesDoLog, type PassoDoLog } from "./modelo.js";

/**
 * O filme do lab "A log that knows its trace", derivado de `rodarLog`.
 *
 * Em cima, o processo: cada thread com o contexto ativo escrito nela, o logger
 * que o desenvolvedor chama e a ponte (ou o stdout, sem ela). Embaixo, o
 * backend: os spans que chegaram e cada log, ligado ao span **só se** o
 * registro tem o campo. Ponte e propagação são escolhas do leitor, e refazem
 * o filme a partir do modelo.
 */
export interface DetalheDoLog {
  readonly nivel: number;
  readonly linhas: readonly (readonly [string, string])[];
}

const B = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });
const curto = (id: string) => `${id.slice(0, 4)}…`;
const ctxTexto = (e: EstadoDoLog, thread: string) => {
  const c = contextoAtivo(e, thread);
  return c === null ? "active context: none" : `active: span ${curto(c.spanId)}`;
};

export const LARGURA_DO_LOG = 1280;
export const ALTURA_DO_LOG = 720;

export function filmeDoLog(opcoes: OpcoesDoLog = OPCOES_DO_LOG): Film<DetalheDoLog> {
  const corrida = rodarLog(opcoes);
  const fimDoRun = corrida.at(-1)!.estado;
  const juncoes = juntar(fimDoRun);
  const f = film<DetalheDoLog>({ width: LARGURA_DO_LOG, height: ALTURA_DO_LOG, maxZoom: 1.9 });

  // ── o processo ──
  const PROC = B(30, 30, 860, 360);
  f.add({ type: "region", id: "proc", box: PROC, label: "checkout process", tone: "processor" });
  const THREAD: Record<string, Box> = { main: B(60, 90, 200, 70), worker: B(60, 260, 200, 70) };
  f.add({ type: "node", id: "th:main", box: THREAD.main!, label: "main thread", sublabel: "active context: none", tone: "processor", icon: I.context });
  f.add({ type: "node", id: "th:worker", box: THREAD.worker!, label: "worker thread", sublabel: "active context: none", tone: "processor", icon: I.context, hidden: true });
  const LOGGER = B(480, 170, 140, 76);
  const PONTE = B(680, 170, 170, 76);
  f.add({ type: "node", id: "logger", box: LOGGER, label: "logger", sublabel: "log.info(…)", tone: "kind-2", icon: I.log });
  f.add({ type: "node", id: "ponte", box: PONTE, label: opcoes.ponte ? "log bridge" : "stdout", sublabel: opcoes.ponte ? "reads the active context" : "plain text, no SDK", tone: opcoes.ponte ? "conduit" : "muted", icon: opcoes.ponte ? I.sdk : I.log });
  const BACK = B(960, 160, 220, 100);
  f.add({ type: "node", id: "backend", box: BACK, label: "backend", sublabel: "logs + traces", tone: "container", shape: "cylinder", icon: I.backend });
  f.add({ type: "link", id: "l:out", path: line(pt(PONTE.x + PONTE.w, PONTE.y + 38), pt(BACK.x, BACK.y + 50)), tone: "container", arrow: true });

  // Os spans, ao lado das threads, quando abrem.
  const spans = fimDoRun.spans;
  spans.forEach((s, i) => {
    f.add({ type: "node", id: `sp:${s.spanId}`, box: B(290, 70 + i * 66, 160, 52), label: s.nome, sublabel: `span ${curto(s.spanId)}`, tone: "kind-1", shape: "pill", hidden: true, icon: I.trace });
  });

  // ── o backend: os spans de cima, os logs embaixo, e as ligações por campo ──
  const BK = B(30, 420, 1220, 280);
  f.add({ type: "region", id: "bk", box: BK, label: "backend · a log links to a span only through its fields", tone: "container" });
  spans.forEach((s, i) => f.add({ type: "node", id: `bs:${s.spanId}`, box: B(80 + i * 300, 460, 260, 50), label: s.nome, sublabel: `trace ${curto(s.traceId)} · span ${curto(s.spanId)}`, tone: "kind-1", shape: "pill", hidden: true, icon: I.trace }));
  const CARTAO = (n: number) => B(40 + (n - 1) * 302, 600, 290, 76);
  juncoes.forEach((j) => {
    const { log } = j;
    const campos = log.spanId === undefined ? "trace_id: —  span_id: —" : `trace_id ${curto(log.traceId!)}  span_id ${curto(log.spanId)}`;
    const tom: Tone = j.motivo === "joined" ? "kind-1" : "live";
    const corpo = log.corpo.length > 34 ? `${log.corpo.slice(0, 33)}…` : log.corpo;
    f.add({ type: "node", id: `card:${log.n}`, box: CARTAO(log.n), label: corpo, sublabel: campos, tone: tom, hidden: true, icon: I.log });
    if (j.motivo === "joined") {
      const i = spans.findIndex((s) => s.spanId === j.span.spanId);
      const c = CARTAO(log.n);
      f.add({ type: "link", id: `join:${log.n}`, path: line(pt(c.x + c.w / 2, c.y), pt(80 + i * 300 + 130, 510)), tone: "kind-1", arrow: true, hidden: true });
    } else {
      f.add({ type: "note", id: `why:${log.n}`, at: pt(CARTAO(log.n).x + 145, 580), label: j.motivo === "text-only" ? "id only in the text — nothing to join on" : "no active context when it logged", tone: "live", align: "middle", hidden: true });
    }
  });

  // ── as fichas: o log da thread ao logger, e o registro do logger ao backend ──
  const logs = corrida.filter((x) => x.passo.tipo === "logar");
  logs.forEach(({ passo, estado }) => {
    const p = passo as Extract<PassoDoLog, { tipo: "logar" }>;
    const log = estado.logs.at(-1)!;
    const th = THREAD[p.thread]!;
    f.add({ type: "token", id: `call:${log.n}`, path: line(pt(th.x + th.w, th.y + 35), pt(LOGGER.x, LOGGER.y + 38)), label: "log.info", sublabel: p.mensagem, tone: "kind-2", hidden: true, size: 4.5 });
    f.add({
      type: "token",
      id: `rec:${log.n}`,
      path: line(pt(LOGGER.x + LOGGER.w, LOGGER.y + 38), pt(BACK.x, BACK.y + 50)),
      label: "LogRecord",
      sublabel: log.spanId === undefined ? (log.corpo.includes("trace_id=") ? "id in the text only" : "no trace fields") : `span_id ${curto(log.spanId)}`,
      tone: log.spanId === undefined ? "live" : "kind-1",
      hidden: true,
      size: 5,
      icon: I.log,
    });
  });

  // ── os capítulos: cada um é um trecho do roteiro ──
  const trechos: { id: string; title: string; body: string; ate: number }[] = [
    {
      id: "active",
      title: "A span is active on this thread",
      body: opcoes.ponte
        ? "The handler starts a span, and it becomes the thread's active context. The code calls the logger as it always did; the bridge reads the active context and writes trace_id and span_id as fields of the record."
        : "The handler starts a span. Without the bridge, the logger writes plain text — so the developer pastes the trace id into the message, which looks like it should work.",
      ate: 2,
    },
    { id: "innermost", title: "The innermost span wins", body: "A child span opens and becomes the active context. The log inside it carries the child's span id, not the root's — the bridge reads whatever is on top, at the moment of the call.", ate: 5 },
    {
      id: "thread",
      title: "A new thread starts empty",
      body: opcoes.propagar
        ? "The receipt email goes to a worker thread, and the code hands it the current context. The worker's log carries the same span — context crossed the thread because someone carried it."
        : "The receipt email goes to a worker thread, and nobody hands it the context. The worker has no active span, so its log carries no trace fields. Nothing errors.",
      ate: 7,
    },
    { id: "after", title: "After the span ends", body: "The request span ends, and then the handler logs once more. There is no active context now, so the record has no trace fields — correct, and the reason some logs never link.", ate: 9 },
  ];
  let i0 = 0;
  for (const tr of trechos) {
    const base = i0;
    const fatia = corrida.slice(base, tr.ate);
    const estado = corrida[tr.ate - 1]!.estado;
    const ligados = juntar(estado).filter((j) => j.motivo === "joined").length;
    f.chapter(
      {
        id: tr.id,
        title: tr.title,
        body: tr.body,
        detail: { nivel: 0, linhas: [["main", ctxTexto(estado, "main")], ...(estado.threads["worker"] === undefined ? [] : [["worker", ctxTexto(estado, "worker")] as const]), ["logs so far", String(estado.logs.length)], ["with trace fields", String(estado.logs.filter((l) => l.spanId !== undefined).length)], ["joinable", String(ligados)]] },
      },
      (d) => {
        if (tr.id === "active") d.camera({ box: PROC }, { dur: 1 });
        fatia.forEach(({ passo, estado: e }, k) => {
          const antes = corrida[base + k - 1]?.estado ?? e;
          if (passo.tipo === "abrir") {
            const s = e.spans.at(-1)!;
            d.show(`sp:${s.spanId}`, { dur: 350 }).ping(`sp:${s.spanId}`);
            d.set(`th:${passo.thread}`, { sublabel: ctxTexto(e, passo.thread) }).glow(`th:${passo.thread}`, 1).ping(`th:${passo.thread}`);
            d.wait(400);
            d.glow(`th:${passo.thread}`, 0);
          } else if (passo.tipo === "fechar") {
            // O span que fechou neste passo: aberto antes, fechado agora.
            const s = e.spans.find((x, k) => !x.aberto && antes.spans[k]?.aberto === true);
            if (s !== undefined) d.set(`sp:${s.spanId}`, { tone: "muted", sublabel: "ended" });
            d.set(`th:${passo.thread}`, { sublabel: ctxTexto(e, passo.thread) }).ping(`th:${passo.thread}`);
            d.wait(500);
          } else if (passo.tipo === "thread") {
            d.show(`th:${passo.nova}`, { dur: 400 }).set(`th:${passo.nova}`, { sublabel: ctxTexto(e, passo.nova), tone: contextoAtivo(e, passo.nova) === null ? "live" : "processor" }).ping(`th:${passo.nova}`);
            d.wait(700);
          } else {
            const log = e.logs.at(-1)!;
            d.send(`call:${log.n}`, { dur: 650 });
            d.glow("logger", 1).ping("logger");
            d.glow("ponte", 1).send(`rec:${log.n}`, { dur: 950 });
            d.glow(["logger", "ponte"], 0).ping("backend");
            d.packet({ tag: "LOG", tone: log.spanId === undefined ? "live" : "kind-1", from: passo.thread, to: "backend", protocol: opcoes.ponte ? "OTLP logs" : "stdout → filelog", payload: log.spanId === undefined ? `body "${log.corpo}" · no trace fields` : `body "${log.corpo}" · trace_id ${log.traceId} · span_id ${log.spanId}` });
            d.wait(200);
          }
        });
        d.wait(600);
      },
    );
    i0 = tr.ate;
  }
  const ligados = juncoes.filter((j) => j.motivo === "joined").length;
  f.chapter(
    {
      id: "join",
      title: "Down: the backend joins on fields",
      body:
        ligados === juncoes.length
          ? "Every record names its span in a field, so every log opens its trace."
          : opcoes.ponte
            ? `${ligados} of ${juncoes.length} logs name a span in a field and link to it. The rest had no active context when they were written — the backend cannot invent one.`
            : "Not one log links. The ids are there, in the text — but the backend joins on the trace_id and span_id fields of the record, and those are empty.",
      detail: { nivel: 1, linhas: [["logs", String(juncoes.length)], ["linked to a span", String(ligados)], ["id only in text", String(juncoes.filter((j) => j.motivo === "text-only").length)], ["no context", String(juncoes.filter((j) => j.motivo === "no-context").length)]] },
    },
    (d) => {
      d.camera({ box: BK }, { dur: 1500 });
      d.stagger(spans, 160, (x, s) => {
        x.show(`bs:${s.spanId}`, { dur: 300 });
      });
      d.stagger(juncoes, 260, (x, j) => {
        x.show(`card:${j.log.n}`, { dur: 300 });
        if (j.motivo === "joined") x.draw(`join:${j.log.n}`, { dur: 500 });
        else x.show(`why:${j.log.n}`, { dur: 300 });
      });
      d.wait(2200);
    },
  );
  return f.build();
}
