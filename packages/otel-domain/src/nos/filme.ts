import { film, line, pt, type Box, type Film, type Point } from "@ovh/motion";
import { ICONES_OTEL as I } from "../icones/icones.js";
import { enriquecer, ipDoAgent, metricasDosNos, NOS, OPCOES_DOS_NOS, PODS_DO_CLUSTER, type OndeEnriquece } from "./modelo.js";

/**
 * O filme do lab "Host and Kubernetes signals", derivado de `enriquecer` e
 * `metricasDosNos`.
 *
 * Dois nós como plataformas (no 3D, os Pods e o agent ficam de pé sobre o nó:
 * a altura é a camada de implantação). O agent de cada nó colhe o host e o
 * kubelet; os spans saem dos Pods, passam pelo agent e pelo gateway. O
 * `k8sattributes` pergunta ao API server pelo IP que viu — e a resposta depende
 * de onde ele roda.
 */
export interface OpcoesDoFilmeDosNos {
  readonly onde: OndeEnriquece;
}

export interface DetalheDosNos {
  readonly nivel: number;
  readonly linhas: readonly (readonly [string, string])[];
}

const B = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });
const centro = (b: Box): Point => pt(b.x + b.w / 2, b.y + b.h / 2);

export const LARGURA_DOS_NOS = 1280;
export const ALTURA_DOS_NOS = 720;

export function filmeDosNos(opcoes: OpcoesDoFilmeDosNos = { onde: OPCOES_DOS_NOS.onde }): Film<DetalheDosNos> {
  const spans = enriquecer({ onde: opcoes.onde, associacao: "conexao" });
  const metricas = metricasDosNos();
  const f = film<DetalheDosNos>({ width: LARGURA_DOS_NOS, height: ALTURA_DOS_NOS, maxZoom: 1.9 });

  const REGIAO: Record<string, Box> = { "node-a": B(30, 40, 640, 320), "node-b": B(30, 390, 640, 300) };
  const AGENT: Record<string, Box> = { "node-a": B(300, 150, 180, 100), "node-b": B(300, 480, 180, 100) };
  const KUBELET: Record<string, Box> = { "node-a": B(510, 80, 140, 70), "node-b": B(510, 420, 140, 70) };
  const HOST: Record<string, Box> = { "node-a": B(510, 260, 140, 70), "node-b": B(510, 600, 140, 70) };
  for (const n of NOS) {
    const r = REGIAO[n.nome]!;
    f.add({ type: "node", id: `plat:${n.nome}`, box: r, label: "", tone: "container", material: "pcb", height: 6 });
    f.add({ type: "note", id: `rot:${n.nome}`, at: pt(r.x + 16, r.y + 18), label: `${n.nome} · ${n.ip}`, tone: "muted", align: "start" });
    f.add({ type: "node", id: `agent:${n.nome}`, box: AGENT[n.nome]!, label: "agent", sublabel: opcoes.onde === "agent" ? "otlp · hostmetrics · kubeletstats · k8sattributes" : "otlp · hostmetrics · kubeletstats", tone: "conduit", icon: I.agent, elevation: 6, shape: "stack" });
    f.add({ type: "node", id: `kubelet:${n.nome}`, box: KUBELET[n.nome]!, label: "kubelet", sublabel: "pod stats", tone: "controller", elevation: 6, icon: I.pod });
    f.add({ type: "node", id: `host:${n.nome}`, box: HOST[n.nome]!, label: "host", sublabel: "/proc, /sys", tone: "controller", elevation: 6, icon: I.host });
  }
  const POD: Record<string, Box> = {};
  PODS_DO_CLUSTER.forEach((p) => {
    const naRegiao = PODS_DO_CLUSTER.filter((x) => x.no === p.no).indexOf(p);
    const r = REGIAO[p.no]!;
    POD[p.nome] = B(60, r.y + 60 + naRegiao * 130, 190, 90);
    f.add({ type: "node", id: `pod:${p.nome}`, box: POD[p.nome]!, label: p.nome, sublabel: `${p.ip} · ${p.servico} + SDK`, tone: "kind-1", shape: "pill", elevation: 6, height: 18, icon: I.pod });
  });
  const API = B(730, 40, 210, 90);
  const GW = B(730, 320, 210, 110);
  const BACK = B(1060, 320, 190, 110);
  f.add({ type: "node", id: "api", box: API, label: "kube-apiserver", sublabel: "who has this IP?", tone: "controller", icon: I.host });
  f.add({ type: "node", id: "gw", box: GW, label: "gateway", sublabel: opcoes.onde === "gateway" ? "k8sattributes" : "forwards", tone: "conduit", shape: "stack", icon: I.gateway });
  f.add({ type: "node", id: "backend", box: BACK, label: "backend", sublabel: "traces + metrics", tone: "container", shape: "cylinder", icon: I.backend });

  // As fichas.
  const enriquecedor = (no: string) => (opcoes.onde === "agent" ? AGENT[no]! : GW);
  spans.forEach((s, i) => {
    const p = s.pod;
    const a = AGENT[p.no]!;
    f.add({ type: "token", id: `s:pod:${i}`, path: line(pt(POD[p.nome]!.x + 190, POD[p.nome]!.y + 45), pt(a.x, a.y + 50)), label: "OTLP", sublabel: `from ${p.ip}`, tone: "kind-1", hidden: true, size: 4.5 });
    f.add({ type: "token", id: `s:gw:${i}`, path: line(pt(a.x + a.w, a.y + 50), pt(GW.x, GW.y + 55)), label: "OTLP", sublabel: `from ${ipDoAgent(p.no)}`, tone: "kind-1", hidden: true, size: 4.5 });
    if (s.ipPerguntado !== null) {
      const e = enriquecedor(p.no);
      f.add({ type: "token", id: `q:${i}`, path: line(centro(e), centro(API)), label: "WHO IS", sublabel: s.ipPerguntado, tone: "controller", hidden: true, size: 4 });
      f.add({ type: "token", id: `r:${i}`, path: line(centro(API), centro(e)), label: s.casou ? "POD" : "NOBODY", sublabel: s.casou ? s.recurso["k8s.pod.name"]! : "no pod has this IP", tone: s.casou ? "kind-1" : "live", hidden: true, size: 4 });
    }
    f.add({ type: "token", id: `s:out:${i}`, path: line(pt(GW.x + GW.w, GW.y + 55), pt(BACK.x, BACK.y + 55)), label: "SPAN", sublabel: s.recurso["k8s.pod.name"] ?? "no k8s.pod.name", tone: s.casou ? "kind-1" : "live", hidden: true, size: 4.5 });
    f.add({ type: "node", id: `card:${i}`, box: B(960, 470 + i * 76, 300, 66), label: `${p.servico} span`, sublabel: s.recurso["k8s.pod.name"] === undefined ? "service.name only" : `${s.recurso["k8s.pod.name"]} · ${s.recurso["k8s.node.name"]}`, tone: s.casou ? "kind-1" : "live", hidden: true, icon: I.trace });
  });
  NOS.forEach((n) => {
    f.add({ type: "token", id: `hm:${n.nome}`, path: line(centro(HOST[n.nome]!), centro(AGENT[n.nome]!)), label: "hostmetrics", sublabel: `host.name ${n.nome}`, tone: "controller", hidden: true, size: 4 });
    f.add({ type: "token", id: `ks:${n.nome}`, path: line(centro(KUBELET[n.nome]!), centro(AGENT[n.nome]!)), label: "kubeletstats", sublabel: `${PODS_DO_CLUSTER.filter((p) => p.no === n.nome).length} pods`, tone: "controller", hidden: true, size: 4 });
  });

  const casados = spans.filter((s) => s.casou).length;
  f.chapter(
    {
      id: "agents",
      title: "An agent on every node",
      body: "A DaemonSet puts one Collector on each node. Two of its receivers need no help from anyone: hostmetrics reads the host itself, and kubeletstats asks the node's kubelet about the Pods it runs. Their metrics arrive already named.",
      detail: { nivel: 0, linhas: [["hostmetrics", `${metricas.filter((m) => m.receiver === "hostmetrics").length} hosts`], ["kubeletstats", `${metricas.filter((m) => m.receiver === "kubeletstats").length} pods`]] },
    },
    (d) => {
      d.camera({ at: { zoom: 1 } }, { dur: 1 });
      d.together(...NOS.map((n) => (x: typeof d) => x.send(`hm:${n.nome}`, { dur: 700 })));
      d.together(...NOS.map((n) => (x: typeof d) => x.send(`ks:${n.nome}`, { dur: 700 })));
      d.ping(NOS.map((n) => `agent:${n.nome}`)).wait(500);
    },
  );
  f.chapter(
    {
      id: "spans",
      title: "Spans arrive from an IP",
      body: "Each app's SDK sends its spans to the agent on its node, and the agents forward to a gateway. At each hop, the Collector knows one thing about the sender: the IP of the connection. The agent sees the Pod's IP; the gateway sees the agent's.",
      detail: { nivel: 1, linhas: spans.map((s) => [s.pod.nome, `agent sees ${s.pod.ip} · gateway sees ${ipDoAgent(s.pod.no)}`] as const) },
    },
    (d) => {
      d.stagger(spans.map((_, i) => i), 260, (x, i) => {
        x.send(`s:pod:${i}`, { dur: 600 });
      });
      d.stagger(spans.map((_, i) => i), 260, (x, i) => {
        x.send(`s:gw:${i}`, { dur: 600 });
      });
      d.ping("gw").wait(400);
    },
  );
  f.chapter(
    {
      id: "lookup",
      title: opcoes.onde === "nenhum" ? "Nobody asks" : opcoes.onde === "agent" ? "The agent asks: who is this Pod?" : "The gateway asks — about the agent",
      body:
        opcoes.onde === "nenhum"
          ? "Without k8sattributes, nothing looks the sender up. The span keeps only what the SDK put on it."
          : opcoes.onde === "agent"
            ? "k8sattributes in the agent takes the connection's IP — the Pod's — and asks the API server. It gets the Pod's name, namespace, deployment and node, and adds them to the span's resource."
            : "k8sattributes in the gateway takes the connection's IP too — but that is the agent's, the node's own address. No Pod has it, so nothing is added.",
      detail: { nivel: 2, linhas: spans.map((s) => [s.pod.nome, s.ipPerguntado === null ? "not asked" : `asked ${s.ipPerguntado} → ${s.casou ? s.recurso["k8s.pod.name"] : "nobody"}`] as const) },
    },
    (d) => {
      if (opcoes.onde === "nenhum") {
        d.wait(1500);
        return;
      }
      d.camera({ box: B(280, 20, 680, 600) }, { dur: 1200 });
      spans.forEach((s, i) => {
        d.send(`q:${i}`, { dur: 500 }).ping("api");
        d.send(`r:${i}`, { dur: 500 });
      });
      d.wait(500);
    },
  );
  f.chapter(
    {
      id: "backend",
      title: "Down: what the backend can group by",
      body:
        casados === spans.length
          ? "Every span carries k8s.pod.name and k8s.node.name, so traces can be grouped by Pod and joined to the kubeletstats metrics of the same Pod."
          : "The spans arrive with service.name only. The Pod metrics from kubeletstats have pod names, the traces do not — the two can no longer be joined by Pod.",
      detail: { nivel: 3, linhas: [["spans with pod name", `${casados} / ${spans.length}`], ["pod metrics with pod name", `${metricas.filter((m) => m.receiver === "kubeletstats").length} / ${PODS_DO_CLUSTER.length}`]] },
    },
    (d) => {
      d.camera({ at: { zoom: 1 } }, { dur: 1200 });
      d.stagger(spans.map((_, i) => i), 200, (x, i) => {
        x.send(`s:out:${i}`, { dur: 600 });
        x.show(`card:${i}`, { dur: 300 });
      });
      d.ping("backend").wait(1800);
    },
  );
  return f.build();
}
