import { film, line, pt, type Box, type Director, type Film, type Tone } from "@ovh/motion";
import { ICONES_OTEL as I } from "../icones/icones.js";
import { baldeDe, INTERVALO_MS, lerNoBackend, OPCOES_DA_METRICA, ROTULOS_DOS_BALDES, roteiro, rodar, type Agregador, type OpcoesDaMetrica, type Passo, type PontoExportado } from "./modelo.js";

/**
 * O filme do lab "The shape of a metric", derivado da corrida do redutor.
 *
 * Cada ficha é um evento do roteiro passado por `rodar`: uma medição que entra,
 * uma coleta que puxa, um reinício que apaga. Os números nas caixas são o
 * agregador depois daquele evento, e as colunas de baixo são os pontos que de
 * fato saíram. Trocar a temporalidade ou ligar o reinício refaz tudo a partir
 * do modelo — o filme não sabe a resposta, ele lê.
 */
export interface DetalheDaMetrica {
  readonly nivel: number;
  readonly linhas: readonly (readonly [string, string])[];
}

const B = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });
const s = (ms: number) => `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)} s`;

export const LARGURA_DA_METRICA = 1280;
export const ALTURA_DA_METRICA = 720;

export function filmeDaMetrica(opcoes: OpcoesDaMetrica = OPCOES_DA_METRICA): Film<DetalheDaMetrica> {
  const corrida = rodar(roteiro(opcoes), opcoes.temporalidade);
  const ingenua = lerNoBackend(corrida.pontos, { respeitaInicio: false });
  const atenta = lerNoBackend(corrida.pontos, { respeitaInicio: true });
  const cumulativa = opcoes.temporalidade === "cumulative";
  const f = film<DetalheDaMetrica>({ width: LARGURA_DA_METRICA, height: ALTURA_DA_METRICA, maxZoom: 1.9 });

  // ── o processo ──
  const APP = B(40, 130, 160, 86);
  const AGG = B(260, 60, 440, 260);
  const READER = B(760, 136, 160, 80);
  const BACK = B(1010, 116, 210, 120);
  f.add({ type: "node", id: "app", box: APP, label: "checkout", sublabel: "records a latency", tone: "kind-1", icon: I.service });
  f.add({ type: "region", id: "agg", box: AGG, label: `SDK · aggregator · ${opcoes.temporalidade}`, tone: "processor" });
  const COUNT = B(280, 108, 128, 62);
  const SUM = B(280, 196, 128, 62);
  f.add({ type: "node", id: "agg:count", box: COUNT, label: "count 0", sublabel: "since 0 s", tone: "processor", icon: I.metric });
  f.add({ type: "node", id: "agg:sum", box: SUM, label: "sum 0 ms", sublabel: "", tone: "processor" });
  const BALDE = (i: number) => B(426 + i * 54, 108, 46, 150);
  ROTULOS_DOS_BALDES.forEach((r, i) => f.add({ type: "node", id: `agg:b${i}`, box: BALDE(i), label: "0", sublabel: r, tone: "kind-2", shape: "memory" }));
  f.add({ type: "node", id: "reader", box: READER, label: "PeriodicReader", sublabel: `every ${s(INTERVALO_MS)}`, tone: "controller", icon: I.exporter });
  f.add({ type: "node", id: "backend", box: BACK, label: "backend", sublabel: "metric store", tone: "container", shape: "cylinder", icon: I.backend });
  const puxa = line(pt(READER.x, READER.y + 30), pt(AGG.x + AGG.w, AGG.y + 120));
  f.add({ type: "link", id: "l:pull", path: puxa, tone: "controller", dashed: true, arrow: true, label: "collect()", hidden: true });
  const sai = line(pt(AGG.x + AGG.w, AGG.y + 150), pt(BACK.x, BACK.y + 80));
  f.add({ type: "link", id: "l:out", path: sai, tone: "container", arrow: true, hidden: true });
  f.add({ type: "note", id: "n:mem", at: pt(AGG.x + 20, AGG.y + AGG.h - 24), label: "nothing here has left the process", tone: "muted", align: "start", hidden: true });

  // ── o que saiu: a série e o histograma ──
  const SERIE = B(40, 380, 600, 320);
  const HIST = B(680, 380, 560, 320);
  f.add({ type: "region", id: "serie", box: SERIE, label: "what each point says", tone: "container" });
  f.add({ type: "region", id: "hist", box: HIST, label: "the histogram · bucket × interval", tone: "kind-2" });
  const BASE = SERIE.y + SERIE.h - 70;
  const maior = Math.max(1, ...corrida.pontos.map((p) => p.contagem));
  corrida.pontos.forEach((p, k) => {
    const h = Math.max(10, (p.contagem / maior) * 180);
    f.add({ type: "node", id: `col:${k}`, box: B(90 + k * 135, BASE - h, 90, h), label: String(p.contagem), sublabel: `since ${s(p.inicio)}`, tone: k > 0 && p.inicio !== corrida.pontos[k - 1]!.inicio ? "live" : "container", hidden: true, height: 6 + p.contagem * 3 });
    const lido = cumulativa ? ingenua[k]! : atenta[k]!;
    f.add({ type: "note", id: `ler:${k}`, at: pt(135 + k * 135, BASE + 22), label: `${lido >= 0 ? "+" : ""}${lido}${cumulativa && atenta[k] !== ingenua[k] ? `  (really +${atenta[k]})` : ""}`, tone: lido < 0 ? "live" : "ink", align: "middle", hidden: true });
    f.add({ type: "note", id: `t:${k}`, at: pt(135 + k * 135, BASE + 46), label: `t = ${s(p.fim)}`, tone: "muted", align: "middle", hidden: true });
    p.baldes.forEach((n, i) => {
      f.add({ type: "node", id: `h:${k}:${i}`, box: B(HIST.x + 90 + i * 92, HIST.y + 44 + k * 64, 80, 52), label: String(n), sublabel: ROTULOS_DOS_BALDES[i]!, tone: n === 0 ? "muted" : "kind-2", hidden: true, height: 2 + n * 6 });
    });
    f.add({ type: "note", id: `hr:${k}`, at: pt(HIST.x + 78, HIST.y + 70 + k * 64), label: `t = ${s(p.fim)}`, tone: "muted", align: "end", hidden: true });
  });

  // ── as fichas: uma por evento ──
  corrida.passos.forEach((p, i) => {
    if (p.evento.tipo === "medir") f.add({ type: "token", id: `ev:${i}`, path: line(pt(APP.x + APP.w, APP.y + 43), pt(AGG.x, AGG.y + 140)), label: `${p.evento.valor} ms`, tone: "kind-1", hidden: true, size: 4.5, trail: 3 });
    if (p.evento.tipo === "coletar") {
      f.add({ type: "token", id: `ev:${i}:pull`, path: puxa, label: "collect", tone: "controller", hidden: true, size: 4 });
      f.add({ type: "token", id: `ev:${i}`, path: sai, label: cumulativa ? "CUMULATIVE" : "DELTA", sublabel: `count ${p.ponto!.contagem} · since ${s(p.ponto!.inicio)}`, tone: "container", hidden: true, size: 5, icon: I.metric });
    }
    if (p.evento.tipo === "reiniciar") f.add({ type: "note", id: `ev:${i}`, at: pt(APP.x, APP.y + APP.h + 34), label: `process restarted\n${p.perdidas} measurements lost`, tone: "live", align: "start", hidden: true });
  });

  const escreverAgregador = (d: Director<DetalheDaMetrica>, a: Agregador) => {
    d.set("agg:count", { label: `count ${a.contagem}`, sublabel: `since ${s(a.desde)}` });
    d.set("agg:sum", { label: `sum ${a.soma} ms` });
    a.baldes.forEach((n, b) => d.set(`agg:b${b}`, { label: String(n) }));
  };
  let k = 0;
  const tocar = (d: Director<DetalheDaMetrica>, p: Passo, i: number, rapido: boolean) => {
    const e = p.evento;
    if (e.tipo === "medir") {
      d.send(`ev:${i}`, { dur: rapido ? 320 : 520 });
      escreverAgregador(d, p.agregador);
      d.ping(`agg:b${baldeDe(e.valor)}`);
      return;
    }
    if (e.tipo === "reiniciar") {
      d.glow(["app", "agg:count"], 1, { dur: 200 }).ping(["app", "agg:count"]);
      d.set("app", { tone: "live", sublabel: "restarting…" });
      d.show(`ev:${i}`, { dur: 300 });
      escreverAgregador(d, p.agregador);
      d.wait(700);
      d.set("app", { tone: "kind-1", sublabel: "records a latency" }).glow(["app", "agg:count"], 0);
      return;
    }
    const pt0 = p.ponto!;
    d.draw("l:pull", { dur: 300 }).send(`ev:${i}:pull`, { dur: 500 });
    d.glow("reader", 1).ping("reader");
    d.together(
      (x) => x.draw("l:out", { dur: 300 }),
      (x) => x.send(`ev:${i}`, { dur: rapido ? 700 : 1000 }),
    );
    d.packet({ tag: "OTLP", tone: "container", from: "reader", to: "backend", protocol: "OTLP/HTTP", payload: `Sum + Histogram · ${pt0.temporalidade} · count ${pt0.contagem} · start ${s(pt0.inicio)} → ${s(pt0.fim)}` });
    d.glow("reader", 0).ping("backend");
    escreverAgregador(d, p.agregador);
    d.show(`col:${k}`, { dur: 400 }).show([`t:${k}`, `hr:${k}`], { dur: 300 });
    d.stagger(pt0.baldes.map((_, b) => b), 60, (x, b) => {
      x.show(`h:${k}:${b}`, { dur: 260 });
    });
    k += 1;
  };

  const porIntervalo: { passo: Passo; i: number }[][] = [[]];
  corrida.passos.forEach((p, i) => {
    porIntervalo[porIntervalo.length - 1]!.push({ passo: p, i });
    if (p.evento.tipo === "coletar") porIntervalo.push([]);
  });
  const intervalos = porIntervalo.filter((x) => x.length > 0);
  const TOPO = B(20, 40, 1240, 300);

  const linhasDoPonto = (p: PontoExportado): (readonly [string, string])[] => [
    ["temporality", p.temporalidade],
    ["start → time", `${s(p.inicio)} → ${s(p.fim)}`],
    ["count", String(p.contagem)],
    ["sum", `${p.soma} ms`],
  ];
  f.chapter(
    {
      id: "measure",
      title: "Measurements stay in the process",
      body: "Every request records its latency. The SDK does not send a measurement: it folds it into the aggregator — one more in the count, the latency into the sum, and one more in the bucket it falls in.",
      detail: { nivel: 0, linhas: [["measured", String(corrida.reais[0])], ["exported", "nothing yet"]] },
    },
    (d) => {
      d.camera({ box: TOPO }, { dur: 1 });
      d.show("n:mem", { dur: 300 });
      intervalos[0]!.filter((x) => x.passo.evento.tipo === "medir").forEach(({ passo, i }) => tocar(d, passo, i, false));
      d.wait(500);
    },
  );
  f.chapter(
    {
      id: "collect",
      title: "The reader asks; one point leaves",
      body: cumulativa
        ? "Every 10 s the PeriodicReader pulls. Cumulative: the point says how many since the process started, and the aggregator keeps every number it had."
        : "Every 10 s the PeriodicReader pulls. Delta: the point says how many since the last collect, and the aggregator starts again from zero.",
      detail: { nivel: 1, linhas: linhasDoPonto(corrida.pontos[0]!) },
    },
    (d) => {
      d.hide("n:mem", { dur: 200 });
      d.camera({ at: { zoom: 1 } }, { dur: 1200 });
      intervalos[0]!.filter((x) => x.passo.evento.tipo === "coletar").forEach(({ passo, i }) => tocar(d, passo, i, false));
      d.wait(800);
    },
  );
  intervalos.slice(1).forEach((grupo, j) => {
    const n = j + 1;
    const ponto = corrida.pontos[n]!;
    const caiu = grupo.some((x) => x.passo.evento.tipo === "reiniciar");
    f.chapter(
      {
        id: `interval-${n + 1}`,
        title: caiu ? "The process restarts" : n === 1 ? "Ten seconds later, again" : "And again",
        body: caiu
          ? cumulativa
            ? `Mid-interval the process dies. ${corrida.perdidas} measurements were only in memory and are gone. The next point starts counting from the restart: a new start time, and a smaller number.`
            : `Mid-interval the process dies. ${corrida.perdidas} measurements were only in memory and are gone. The next delta point simply covers less — it still reads on its own.`
          : cumulativa
            ? "Same start time, a bigger number: the backend has to subtract the previous point to know what happened in these 10 s."
            : "A new start time on every point, and a number that is already the answer for these 10 s.",
        detail: { nivel: 1, linhas: linhasDoPonto(ponto) },
      },
      (d) => {
        grupo.forEach(({ passo, i }) => tocar(d, passo, i, true));
        d.wait(600);
      },
    );
  });
  f.chapter(
    {
      id: "backend",
      title: "Down: what the backend concludes",
      body: cumulativa
        ? opcoes.reinicio
          ? "To get requests per interval the backend subtracts consecutive points. Across the restart that gives a negative number — unless it notices the start time changed and treats the point as a reset."
          : "To get requests per interval the backend subtracts consecutive points. With one start time throughout, the subtraction is right every time."
        : "Each delta point is already the count for its interval. Nothing to subtract, nothing to get wrong across a restart — only what was lost in memory is missing.",
      detail: {
        nivel: 2,
        linhas: [
          ["really happened", corrida.reais.join(" · ")],
          ["backend reads", (cumulativa ? ingenua : atenta).join(" · ")],
          ...(cumulativa ? ([["honouring start time", atenta.join(" · ")]] as const) : []),
          ["lost in memory", String(corrida.perdidas)],
        ],
      },
    },
    (d) => {
      d.camera({ box: SERIE }, { dur: 1500 });
      d.stagger(corrida.pontos.map((_, k) => k), 300, (x, k) => {
        x.show(`ler:${k}`, { dur: 300 });
      });
      corrida.pontos.forEach((_, k) => {
        if ((cumulativa ? ingenua : atenta)[k]! < 0) d.glow(`col:${k}`, 1).ping(`col:${k}`);
      });
      d.wait(1800);
    },
  );
  f.chapter(
    {
      id: "histogram",
      title: "Down: the histogram, bucket by interval",
      body: cumulativa
        ? "A histogram point is a count per bucket, with the same temporality. Cumulative buckets only grow — until the restart. In the isometric view, height is the count."
        : "A histogram point is a count per bucket, with the same temporality. Delta buckets show each interval's own shape. In the isometric view, height is the count.",
      detail: { nivel: 3, linhas: [["buckets", ROTULOS_DOS_BALDES.join(" ")], ["points", String(corrida.pontos.length)]] },
    },
    (d) => {
      d.camera({ box: HIST }, { dur: 1500 });
      d.stagger(corrida.pontos.map((_, k) => k), 260, (x, k) => {
        x.ping(corrida.pontos[k]!.baldes.map((_, b) => `h:${k}:${b}`));
      });
      d.wait(2000);
    },
  );
  return f.build();
}

