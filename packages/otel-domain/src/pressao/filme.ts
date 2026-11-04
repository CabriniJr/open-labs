import { arc, film, line, pt, through, type Box, type Director, type Film, type Tone } from "@ovh/motion";
import { ICONES_OTEL as I } from "../icones/icones.js";
import { backendNoAr, LIMITE_DO_LIMITER, MEMORIA_MAXIMA, OPCOES_DA_PRESSAO, QUEDA, rodarPressao, SPANS_POR_LOTE, TEMPO_MAXIMO_DE_RETRY, type EstadoDaPressao, type OpcoesDaPressao } from "./modelo.js";

/**
 * O filme do lab "Backpressure and drops", derivado de `rodarPressao`.
 *
 * Um lote por tick entra pelo `memory_limiter` e vai para a `sending_queue`, que
 * é uma coluna: no 3D, cada lote guardado é um andar, e a altura é a ocupação.
 * As marcas ao lado são os três limites — `queue_size`, o limiter e o teto da
 * memória — e o vermelho é o que passou de um deles. O backend cai em `QUEDA`;
 * os contadores dizem onde cada lote terminou.
 */
export interface DetalheDaPressao {
  readonly nivel: number;
  readonly linhas: readonly (readonly [string, string])[];
}

const B = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });

export const LARGURA_DA_PRESSAO = 1280;
export const ALTURA_DA_PRESSAO = 720;

const CONTADORES = [
  ["entregues", "delivered", "container"],
  ["recusados", "refused at the edge", "live"],
  ["filaCheia", "dropped: queue full", "live"],
  ["retryEsgotado", "dropped: retries exhausted", "live"],
  ["perdidosNoCrash", "lost in the crash", "live"],
] as const;

export function filmeDaPressao(opcoes: OpcoesDaPressao = OPCOES_DA_PRESSAO): Film<DetalheDaPressao> {
  const corrida = rodarPressao(opcoes);
  const f = film<DetalheDaPressao>({ width: LARGURA_DA_PRESSAO, height: ALTURA_DA_PRESSAO, maxZoom: 1.9 });
  const celulas = Math.max(MEMORIA_MAXIMA, Math.min(opcoes.fila, MEMORIA_MAXIMA + 2));

  f.add({ type: "node", id: "relogio", box: B(40, 50, 210, 70), label: "tick 0", sublabel: "backend up", tone: "container" });
  f.add({ type: "node", id: "app", box: B(40, 300, 170, 90), label: "checkout", sublabel: `1 batch / tick · ${SPANS_POR_LOTE} spans`, tone: "processor", icon: I.service });
  f.add({ type: "node", id: "limiter", box: B(250, 300, 170, 90), label: opcoes.limiter ? "memory_limiter" : "no limiter", sublabel: opcoes.limiter ? `refuses above ${LIMITE_DO_LIMITER} batches` : "nothing watches memory", tone: opcoes.limiter ? "processor" : "muted", icon: I.limiter });
  const COLUNA = B(460, 110, 200, 560);
  f.add({ type: "region", id: "fila", box: COLUNA, label: `sending_queue · queue_size ${opcoes.fila}`, tone: "conduit" });
  const CEL = (k: number) => B(480, 620 - k * 54, 160, 46);
  for (let k = 0; k < celulas; k += 1) {
    const alem = k >= opcoes.fila;
    f.add({ type: "node", id: `cel:${k}`, box: CEL(k), label: "", sublabel: alem ? "beyond queue_size" : "", tone: "muted", elevation: k * 10, height: 9 });
  }
  const marca = (id: string, k: number, texto: string, tone: Tone) => f.add({ type: "note", id, at: pt(670, CEL(k).y + 2), label: texto, tone, align: "start" });
  if (opcoes.fila <= celulas) marca("m:fila", opcoes.fila, `— queue_size ${opcoes.fila}`, "conduit");
  if (opcoes.limiter) marca("m:limiter", LIMITE_DO_LIMITER, `— memory_limiter ${LIMITE_DO_LIMITER}`, "processor");
  marca("m:memoria", MEMORIA_MAXIMA, `— process memory ${MEMORIA_MAXIMA}`, "live");
  f.add({ type: "node", id: "exporter", box: B(860, 160, 170, 90), label: "exporter", sublabel: `retry 1, 2, 4… · gives up at ${TEMPO_MAXIMO_DE_RETRY} ticks`, tone: "conduit", icon: I.exporter });
  f.add({ type: "node", id: "backend", box: B(1080, 150, 170, 110), label: "backend", sublabel: "up", tone: "container", shape: "cylinder", icon: I.backend });
  CONTADORES.forEach(([chave, rotulo, tone], i) => f.add({ type: "node", id: `n:${chave}`, box: B(860, 300 + i * 78, 390, 64), label: "0", sublabel: rotulo, tone: tone === "live" ? "muted" : tone }));

  // Os baldes: cada descarte termina na boca do contador dele.
  const balde = (chave: (typeof CONTADORES)[number][0]) => pt(860, 300 + CONTADORES.findIndex(([c]) => c === chave) * 78 + 32);
  const boca = pt(560, CEL(Math.min(opcoes.fila, celulas) - 1).y - 6);

  // As fichas de cada tick: a chegada, as entregas e os descartes.
  corrida.forEach((e, i) => {
    const anterior = corrida[i - 1];
    f.add({ type: "token", id: `in:${i}`, path: line(pt(210, 345), pt(250, 345)), label: "BATCH", sublabel: `#${i + 1}`, tone: e.chegada === "aceito" ? "kind-1" : "live", hidden: true, size: 4.5 });
    if (e.chegada === "aceito" || e.chegada === "crash") f.add({ type: "token", id: `q:${i}`, path: line(pt(420, 345), pt(480, CEL(Math.max(0, e.fila.length - 1)).y + 23)), tone: e.chegada === "crash" ? "live" : "kind-1", hidden: true, size: 4 });
    if (e.entreguesAgora > 0) f.add({ type: "token", id: `out:${i}`, path: line(pt(640, 300), pt(1080, 205)), label: "EXPORT", sublabel: `${e.entreguesAgora} batch${e.entreguesAgora > 1 ? "es" : ""}`, tone: "container", hidden: true, size: 4.5, icon: I.bytes });
    // Recusado: o lote quica no limiter e volta para quem mandou — o único descarte que o remetente fica sabendo.
    if (e.chegada === "recusado") f.add({ type: "token", id: `rec:${i}`, path: arc(pt(250, 330), pt(210, 330), 0.9), label: "REFUSED", sublabel: "error back to the SDK", tone: "live", hidden: true, size: 4.5 });
    // Fila cheia: chega à boca da fila, não cabe, e cai no balde dele.
    if (e.chegada === "fila-cheia") f.add({ type: "token", id: `cheia:${i}`, path: through([pt(420, 345), boca, pt(boca.x + 160, boca.y + 40), balde("filaCheia")]), label: "DROPPED", sublabel: "queue full", tone: "live", hidden: true, size: 4.5, trail: 5 });
    // Retry esgotado: o mais antigo sai do fundo da coluna.
    for (let j = 0; j < e.esgotadosAgora; j += 1) {
      const fundo = CEL(j);
      f.add({ type: "token", id: `esg:${i}:${j}`, path: through([pt(640, fundo.y + 23), pt(740, fundo.y + 23), balde("retryEsgotado")]), label: "GAVE UP", sublabel: `after ${TEMPO_MAXIMO_DE_RETRY} ticks`, tone: "live", hidden: true, size: 4.5, trail: 5 });
    }
    // Crash: tudo que estava na coluna despenca junto.
    if (e.caiu) {
      const naFila = (anterior?.fila.length ?? 0) + 1;
      for (let k = 0; k < Math.min(naFila, celulas); k += 1) {
        const c = CEL(k);
        f.add({ type: "token", id: `perd:${i}:${k}`, path: through([pt(560, c.y + 23), pt(700, Math.max(c.y + 23, 560)), balde("perdidosNoCrash")]), label: k === 0 ? "LOST" : "", sublabel: k === 0 ? `${naFila} batches` : "", tone: "live", hidden: true, size: 4, trail: 3 });
      }
    }
  });
  f.add({ type: "note", id: "n:crash", at: pt(470, 90), label: "out of memory: the process restarts empty", tone: "live", align: "start", hidden: true });

  const tocar = (d: Director<DetalheDaPressao>, e: EstadoDaPressao, i: number, anterior: EstadoDaPressao | undefined) => {
    const t = e.t - 1;
    const noAr = backendNoAr(t);
    d.set("relogio", { label: `tick ${t}`, sublabel: noAr ? "backend up" : "backend DOWN", tone: noAr ? "container" : "live" });
    if ((anterior === undefined ? true : backendNoAr(anterior.t - 1)) !== noAr) d.set("backend", { tone: noAr ? "container" : "live", sublabel: noAr ? "up" : "down" }).ping("backend");
    d.send(`in:${i}`, { dur: 260 });
    if (e.chegada === "recusado") d.ping("limiter").send(`rec:${i}`, { dur: 520 }).ping("app");
    if (e.chegada === "fila-cheia") d.send(`cheia:${i}`, { dur: 760 }).ping("n:filaCheia");
    if (e.chegada === "aceito" || e.chegada === "crash") d.send(`q:${i}`, { dur: 220 });
    if (e.caiu) {
      // A coluna inteira acende antes de despencar: o leitor vê o que estava guardado.
      const naFila = Math.min((anterior?.fila.length ?? 0) + 1, celulas);
      for (let k = 0; k < naFila; k += 1) d.set(`cel:${k}`, { tone: "live", label: "lost", sublabel: "" });
      d.show("n:crash", { dur: 250 }).ping(["limiter", "fila"]).wait(250);
      d.together(...Array.from({ length: naFila }, (_, k) => (x: Director<DetalheDaPressao>) => x.send(`perd:${i}:${k}`, { dur: 700, delay: k * 50 })));
      d.ping("n:perdidosNoCrash");
    }
    // O lote que desiste sai do fundo antes de a coluna se redesenhar sem ele.
    if (e.esgotadosAgora > 0) d.together(...Array.from({ length: e.esgotadosAgora }, (_, j) => (x: Director<DetalheDaPressao>) => x.send(`esg:${i}:${j}`, { dur: 700 }))).ping("n:retryEsgotado");
    for (let k = 0; k < celulas; k += 1) {
      const cheia = k < e.fila.length;
      const acima = (opcoes.limiter && k >= LIMITE_DO_LIMITER) || k >= opcoes.fila;
      d.set(`cel:${k}`, { tone: cheia ? (acima ? "live" : "conduit") : "muted", label: cheia ? `#${e.fila[k]!.id}` : "", sublabel: cheia ? (e.fila[k]!.tentativas > 0 ? `retry ${e.fila[k]!.tentativas}` : "queued") : k >= opcoes.fila ? "beyond queue_size" : "" });
    }
    if (e.entreguesAgora > 0) d.send(`out:${i}`, { dur: 300 });
    if (!noAr && e.fila.some((l) => l.tentativas > 0)) d.ping("exporter");
    CONTADORES.forEach(([chave, , tone]) => {
      const v = e.contadores[chave];
      if (anterior === undefined || anterior.contadores[chave] !== v) d.set(`n:${chave}`, { label: String(v * SPANS_POR_LOTE) + " spans", tone: v > 0 ? tone : "muted" }).ping(`n:${chave}`);
    });
    d.wait(120);
  };

  const fases: { id: string; title: string; body: string; de: number; ate: number }[] = [];
  const crash = corrida.findIndex((e) => e.caiu);
  const primeiraRecusa = corrida.findIndex((e) => e.chegada === "recusado");
  const primeiraCheia = corrida.findIndex((e) => e.chegada === "fila-cheia");
  const viraEm = crash !== -1 ? crash : primeiraRecusa !== -1 ? primeiraRecusa : primeiraCheia !== -1 ? primeiraCheia : 10;
  fases.push({ id: "healthy", title: "Healthy: in and out", body: "One batch a tick arrives, goes into the queue and leaves on the next send. The queue stays at the bottom.", de: 0, ate: QUEDA[0] });
  fases.push({ id: "down", title: "The backend goes down", body: "Every send fails. The exporter puts each batch back in the queue and waits longer before the next try — 1, 2, 4 ticks. The queue starts to climb.", de: QUEDA[0], ate: Math.max(QUEDA[0] + 1, viraEm) });
  fases.push({
    id: "limit",
    title: crash !== -1 ? "No limiter: the process dies" : primeiraRecusa !== -1 ? "The limiter refuses at the edge" : "The queue is full",
    body:
      crash !== -1
        ? `Nothing watched memory, so the queue grew past what the process can hold. It crashed, and took every queued batch with it — ${corrida[crash]!.contadores.perdidosNoCrash * SPANS_POR_LOTE} spans.`
        : primeiraRecusa !== -1
          ? `The queue could hold more, but memory could not: the memory_limiter refuses new batches above ${LIMITE_DO_LIMITER}. The SDK gets an error and can retry or drop — the loss is visible at the edge.`
          : `queue_size ${opcoes.fila} is reached: new batches are dropped on arrival. Meanwhile the oldest batches give up after ${TEMPO_MAXIMO_DE_RETRY} ticks of retrying.`,
    de: Math.max(QUEDA[0] + 1, viraEm),
    ate: QUEDA[1],
  });
  fases.push({ id: "back", title: "The backend comes back", body: "Sends succeed again, but the exporter drains at its own pace: the queue comes down a few batches a tick, not all at once.", de: QUEDA[1], ate: corrida.length });
  for (const fase of fases) {
    const fim = corrida[Math.max(fase.de, fase.ate - 1)]!;
    f.chapter(
      { id: fase.id, title: fase.title, body: fase.body, detail: { nivel: 0, linhas: [["ticks", `${fase.de} – ${fase.ate - 1}`], ["queued", `${fim.fila.length} batches`], ["delivered", `${fim.contadores.entregues * SPANS_POR_LOTE} spans`]] } },
      (d) => {
        if (fase.id === "healthy") d.camera({ at: { zoom: 1 } }, { dur: 1 });
        for (let i = fase.de; i < fase.ate; i += 1) tocar(d, corrida[i]!, i, corrida[i - 1]);
        d.wait(400);
      },
    );
  }
  const c = corrida.at(-1)!.contadores;
  f.chapter(
    {
      id: "where",
      title: "Down: where every span went",
      body: "Every batch ends in exactly one place. Only the refusal at the edge is something the application can see; the rest happens inside the Collector, and only its own metrics count it.",
      detail: { nivel: 1, linhas: CONTADORES.map(([chave, rotulo]) => [rotulo, `${c[chave] * SPANS_POR_LOTE} spans`] as const) },
    },
    (d) => {
      d.camera({ box: B(840, 280, 430, 420) }, { dur: 1400 });
      d.glow(CONTADORES.map(([chave]) => `n:${chave}`), 1).wait(2200);
    },
  );
  return f.build();
}
