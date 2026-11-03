import { film, type Box, type Film, type Tone } from "@ovh/motion";
import { NODES, nodeResources, type ClusterState, type Pod } from "./model.js";

/**
 * O cluster como cena: plano de controle, fila de Pending e os nós com os Pods
 * em cima deles. É a mesma `ClusterState` do lab, vista no espaço — e cada
 * passo do modelo vira um filme curto que mostra O QUE MUDOU: o Pod que nasce
 * na fila, o que voa até o nó quando é agendado, o que pisca ao reiniciar e o
 * que se apaga ao terminar.
 *
 * Nada aqui decide comportamento: posição, tom e reserva saem do estado. Dois
 * estados iguais dão um filme parado.
 */
export const LARGURA_DO_CLUSTER = 1280;
export const ALTURA_DO_CLUSTER = 720;

const POD = { w: 150, h: 64 };
const COLUNAS_NO_NO = 4;
const VAGA = { w: 186, h: 88 };

const PLANO = { x: 40, y: 50, w: 300, h: 620 };
const CONTROLADOR: Box = { x: 70, y: 100, w: 240, h: 72 };
const ESCALONADOR: Box = { x: 70, y: 220, w: 240, h: 72 };
const FILA: Box = { x: 60, y: 340, w: 260, h: 310 };

/** Onde um Pod criado e agendado no mesmo passo aparece: saindo do scheduler. */
const NASCE = { x: ESCALONADOR.x + ESCALONADOR.w + 10, y: ESCALONADOR.y + 4 };

const NOS: Record<string, Box> = {
  "worker-01": { x: 390, y: 50, w: 850, h: 290 },
  "worker-02": { x: 390, y: 380, w: 850, h: 290 },
};

/** O tom de um Pod é o estado dele, nesta ordem de gravidade. */
export function tomDoPod(p: Pod): Tone {
  if (p.deletionAt !== null) return "muted";
  if (p.phase === "Failed" || p.reason === "CrashLoopBackOff" || p.reason === "OOMKilled" || p.reason === "ImagePullBackOff") return "live";
  if (p.node === null) return "high";
  if (p.ready) return "conduit";
  return "processor";
}

function rotulo(p: Pod): string {
  return p.name.length > 14 ? `…${p.name.slice(-11)}` : p.name;
}

function situacao(p: Pod): string {
  const r = p.deletionAt !== null ? "Terminating" : p.ready ? "Ready" : p.reason;
  return p.restarts > 0 ? `${r} · ↻${p.restarts}` : r;
}

/** Onde cada Pod está num estado: vaga no nó, ou lugar na fila. */
export function lugares(state: Readonly<ClusterState>): Map<string, Box> {
  const out = new Map<string, Box>();
  const porNo = new Map<string, Pod[]>();
  const fila: Pod[] = [];
  for (const p of state.pods) {
    if (p.node === null) fila.push(p);
    else porNo.set(p.node, [...(porNo.get(p.node) ?? []), p]);
  }
  for (const [no, pods] of porNo) {
    const caixa = NOS[no];
    if (caixa === undefined) continue;
    pods.forEach((p, i) => {
      const k = Math.min(i, COLUNAS_NO_NO * 2 - 1);
      out.set(p.uid, {
        x: caixa.x + 40 + (k % COLUNAS_NO_NO) * VAGA.w,
        y: caixa.y + 44 + Math.floor(k / COLUNAS_NO_NO) * VAGA.h,
        w: POD.w,
        h: POD.h,
      });
    });
  }
  fila.forEach((p, i) => {
    const k = Math.min(i, 7);
    out.set(p.uid, { x: FILA.x + 20 + (k % 2) * 116, y: FILA.y + 40 + Math.floor(k / 2) * 66, w: 104, h: 52 });
  });
  return out;
}

function proporcao(state: Readonly<ClusterState> | null, no: string, recurso: "cpu" | "memory"): number {
  if (state === null) return 0;
  const n = nodeResources(state).find((x) => x.id === no);
  if (n === undefined) return 0;
  return recurso === "cpu" ? n.cpuReserved / n.cpu : n.memoryReserved / n.memory;
}

export function filmeDaTransicao(antes: Readonly<ClusterState> | null, depois: Readonly<ClusterState>, dur = 650): Film<null> {
  const f = film<null>({ width: LARGURA_DO_CLUSTER, height: ALTURA_DO_CLUSTER, gap: 0 });
  const aqui = lugares(depois);
  const la = antes === null ? new Map<string, Box>() : lugares(antes);
  const antesPorUid = new Map((antes?.pods ?? []).map((p) => [p.uid, p]));
  const depoisPorUid = new Map(depois.pods.map((p) => [p.uid, p]));

  f.add({ type: "region", id: "plano", box: PLANO, label: "control plane", tone: "controller" });
  f.add({ type: "node", id: "controlador", box: CONTROLADOR, label: depois.workload?.kind === "Pod" ? "no controller" : "ReplicaSet", sublabel: depois.workload === null ? "nothing applied" : `${depois.workload.name} · want ${depois.workload.replicas}`, tone: "controller" });
  f.add({ type: "node", id: "escalonador", box: ESCALONADOR, label: "scheduler", sublabel: "fits requests", tone: "processor" });
  f.add({ type: "region", id: "fila", box: FILA, label: "pending", tone: "high" });
  for (const no of NODES) {
    const caixa = NOS[no.id]!;
    f.add({ type: "region", id: `no:${no.id}`, box: caixa, label: `${no.id} · ${no.cpu}m · ${no.memory}Mi`, tone: "container" });
    const trilho = (y: number): Box => ({ x: caixa.x + 40, y, w: caixa.w - 80, h: 10 });
    // Trilho (o alocável) e barra (o reservado). A legenda vai ACIMA, com os
    // números: um rótulo em cima da própria barra não se lê.
    const r = nodeResources(depois).find((x) => x.id === no.id)!;
    const yCpu = caixa.y + caixa.h - 84;
    const yMem = caixa.y + caixa.h - 26;
    f.add({ type: "bar", id: `cpu-base:${no.id}`, box: trilho(yCpu), grow: "right", tone: "muted", layer: 0 });
    f.add({ type: "bar", id: `cpu:${no.id}`, box: trilho(yCpu), grow: "right", tone: "processor", layer: 1 });
    f.add({ type: "note", id: `cpu-n:${no.id}`, at: { x: caixa.x + 40, y: yCpu - 6 }, align: "start", label: `cpu requests ${r.cpuReserved} / ${r.cpu}m`, tone: "processor", layer: 2 });
    f.add({ type: "bar", id: `mem-base:${no.id}`, box: trilho(yMem), grow: "right", tone: "muted", layer: 0 });
    f.add({ type: "bar", id: `mem:${no.id}`, box: trilho(yMem), grow: "right", tone: "kind-2", layer: 1 });
    f.add({ type: "note", id: `mem-n:${no.id}`, at: { x: caixa.x + 40, y: yMem - 6 }, align: "start", label: `memory requests ${r.memoryReserved} / ${r.memory}Mi`, tone: "kind-2", layer: 2 });
  }

  // Todo Pod que existe em algum dos dois estados entra na cena, na posição de
  // depois (ou de antes, se ele está saindo).
  const uids = [...new Set([...(antes?.pods ?? []).map((p) => p.uid), ...depois.pods.map((p) => p.uid)])];
  for (const uid of uids) {
    const depoisP = depoisPorUid.get(uid);
    const antesP = antesPorUid.get(uid);
    const p = depoisP ?? antesP!;
    const box = aqui.get(uid) ?? la.get(uid)!;
    f.add({ type: "node", id: `pod:${uid}`, box, label: rotulo(p), sublabel: situacao(p), tone: tomDoPod(p), shape: "pill", hidden: antesP === undefined && antes !== null, layer: 3, title: `${p.name} (${p.uid})` });
  }

  f.chapter({ id: `t${depois.tick}`, title: `t = ${depois.tick}s`, body: depois.events.at(-1)?.detail ?? "" }, (d) => {
    // O quadro zero é o estado de antes.
    for (const no of NODES) {
      d.set(`cpu-base:${no.id}`, { dim: 0.7 });
      d.set(`mem-base:${no.id}`, { dim: 0.7 });
      d.set(`cpu:${no.id}`, { progress: proporcao(antes ?? depois, no.id, "cpu") });
      d.set(`mem:${no.id}`, { progress: proporcao(antes ?? depois, no.id, "memory") });
    }
    let agendou = false;
    let criou = false;
    for (const uid of uids) {
      const id = `pod:${uid}`;
      const a = antesPorUid.get(uid);
      const b = depoisPorUid.get(uid);
      if (a !== undefined && b !== undefined) {
        const de = la.get(uid);
        const para = aqui.get(uid);
        if (de !== undefined && para !== undefined && (de.x !== para.x || de.y !== para.y)) {
          d.set(id, { dx: de.x - para.x, dy: de.y - para.y });
          if (a.node === null && b.node !== null) agendou = true;
        }
        d.set(id, { tone: tomDoPod(a), sublabel: situacao(a), dim: a.deletionAt !== null ? 0.45 : 0 });
      }
      if (a === undefined && antes !== null && b !== undefined) {
        criou = true;
        // Criado e agendado no mesmo passo: o Pod nasce ao lado do scheduler e
        // anda até a vaga. É o que o passo fez, na ordem em que fez.
        const para = aqui.get(uid);
        if (b.node !== null && para !== undefined) {
          d.set(id, { dx: NASCE.x - para.x, dy: NASCE.y - para.y });
          agendou = true;
        }
      }
    }
    if (antes === null) return void d.wait(1);

    d.together(
      (x) => {
        for (const no of NODES) {
          x.to(`cpu:${no.id}`, { progress: proporcao(depois, no.id, "cpu") }, { dur, wait: false });
          x.to(`mem:${no.id}`, { progress: proporcao(depois, no.id, "memory") }, { dur, wait: false });
        }
        x.wait(dur);
      },
      (x) => {
        if (criou) x.glow("controlador", 1, { dur: 200 }).ping("controlador");
        if (agendou) x.glow("escalonador", 1, { dur: 200 }).ping("escalonador");
        for (const uid of uids) {
          const id = `pod:${uid}`;
          const a = antesPorUid.get(uid);
          const b = depoisPorUid.get(uid);
          if (a === undefined && b !== undefined) {
            x.show(id, { dur: dur * 0.4, wait: false });
            if (b.node !== null) x.to(id, { dx: 0, dy: 0 }, { dur, delay: dur * 0.25, ease: "inOut", wait: false });
          }
          else if (a !== undefined && b === undefined) x.hide(id, { dur: dur * 0.7, wait: false });
          else if (a !== undefined && b !== undefined) {
            x.to(id, { dx: 0, dy: 0 }, { dur, ease: "inOut", wait: false });
            if (tomDoPod(a) !== tomDoPod(b) || situacao(a) !== situacao(b)) {
              x.set(id, { tone: tomDoPod(b), sublabel: situacao(b) }, { delay: dur * 0.5 });
              if (b.restarts > a.restarts || (tomDoPod(b) === "live" && tomDoPod(a) !== "live")) x.ping(id, { delay: dur * 0.5 });
            }
            if (b.deletionAt !== null && a.deletionAt === null) x.dim(id, 0.45, { dur });
          }
        }
        x.wait(dur);
      },
    );
    d.glow(["controlador", "escalonador"], 0, { dur: 250 });
  });
  return f.build();
}
