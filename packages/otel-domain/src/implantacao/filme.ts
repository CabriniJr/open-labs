import { arc, connect, film, type Box, type Film, type Path, type Tone } from "@ovh/motion";
import { entregar, NOS_DO_CLUSTER, PODS, REPLICAS, SPANS, type Entrega, type OpcoesDeImplantacao } from "./modelo.js";

/**
 * O filme da implantação: os spans saindo dos Pods e chegando ao backend pelo
 * caminho que `entregar()` decidiu. Nenhum caminho é escrito aqui — este
 * arquivo só sabe onde cada peça mora no desenho.
 */
export type LinhaDaTabela = "connections" | "credentials" | "enrichment" | "tail" | "queue";

export interface DetalheDaImplantacao {
  readonly destaque: LinhaDaTabela | null;
}

export const LARGURA_DA_IMPLANTACAO = 1280;
export const ALTURA_DA_IMPLANTACAO = 720;

const NO: Record<string, Box> = {
  "node-1": { x: 40, y: 50, w: 560, h: 290 },
  "node-2": { x: 40, y: 380, w: 560, h: 290 },
};
const GATEWAY: Box = { x: 690, y: 160, w: 250, h: 400 };
const BACKEND: Box = { x: 1045, y: 305, w: 195, h: 110 };

const TOM_DO_TRACE: Record<"T1" | "T2", Tone> = { T1: "kind-1", T2: "kind-3" };

function caixaDe(id: string): Box {
  if (id === "backend") return BACKEND;
  const i = REPLICAS.indexOf(id as (typeof REPLICAS)[number]);
  if (i !== -1) return { x: GATEWAY.x + 25, y: GATEWAY.y + 70 + i * 180, w: 200, h: 72 };
  if (id.startsWith("agent-")) {
    const no = NO[`node-${id.slice(-1)}`]!;
    return { x: no.x + 190, y: no.y + 190, w: 180, h: 66 };
  }
  const pod = PODS.find((p) => p.id === id)!;
  const no = NO[pod.no]!;
  const k = PODS.filter((p) => p.no === pod.no).indexOf(pod);
  return { x: no.x + 30 + k * 178, y: no.y + 52, w: 150, h: 62 };
}

/**
 * O fio de um salto. Do Pod para um coletor ele é uma curva leve: três Pods na
 * mesma linha mandando para o mesmo lado dariam fios retos colineares, e um fio
 * que passa por trás do vizinho se lê como "frontend → cart", que não existe.
 */
function fioDe(de: string, para: string): Path {
  if (de.startsWith("agent-") || de.startsWith("gateway-")) return connect(caixaDe(de), caixaDe(para), 8);
  // Sai pela BASE do Pod, que é o lado livre da fileira, e curva até a borda do
  // destino. Pela lateral, o fio roçava o Pod vizinho.
  const b = caixaDe(de);
  const saida = { x: b.x + b.w / 2, y: b.y + b.h + 4 };
  const chegada = connect({ ...saida, w: 0, h: 0 }, caixaDe(para), 8).segments[0]!.to;
  const pod = PODS.find((p) => p.id === de)!;
  const k = PODS.filter((p) => p.no === pod.no).indexOf(pod);
  return arc(saida, chegada, 0.22 - k * 0.05);
}

function bolinhas(n: number, total: number): string {
  return "●".repeat(n) + "○".repeat(Math.max(0, total - n));
}

export function filmeDaImplantacao(opcoes: OpcoesDeImplantacao): { filme: Film<DetalheDaImplantacao>; entrega: Entrega } {
  const e = entregar(opcoes);
  const { modo } = opcoes;
  const temAgent = modo === "agent" || modo === "agent-gateway";
  const temGateway = modo === "gateway" || modo === "agent-gateway";
  const f = film<DetalheDaImplantacao>({ width: LARGURA_DA_IMPLANTACAO, height: ALTURA_DA_IMPLANTACAO, gap: 400, maxZoom: 1.6 });

  for (const no of NOS_DO_CLUSTER) f.add({ type: "region", id: `regiao:${no}`, box: NO[no]!, label: no, tone: "container" });
  for (const pod of PODS) f.add({ type: "node", id: `pod:${pod.id}`, box: caixaDe(pod.id), label: pod.id, sublabel: "app + SDK", tone: "processor", shape: "pill" });
  if (temAgent) for (const no of NOS_DO_CLUSTER) f.add({ type: "node", id: `col:agent-${no.slice(-1)}`, box: caixaDe(`agent-${no.slice(-1)}`), label: `agent-${no.slice(-1)}`, sublabel: "Collector · DaemonSet", tone: "conduit", shape: "stack" });
  if (temGateway) {
    f.add({ type: "region", id: "regiao:gateway", box: GATEWAY, label: "gateway · Deployment", tone: "conduit" });
    for (const r of REPLICAS) f.add({ type: "node", id: `col:${r}`, box: caixaDe(r), label: r, sublabel: "Collector", tone: "conduit", shape: "stack" });
  }
  f.add({ type: "node", id: "col:backend", box: BACKEND, label: "backend", sublabel: `${e.conexoesComBackend} connections`, tone: "container", shape: "cylinder" });

  const idDe = (x: string) => (x.startsWith("agent-") || x.startsWith("gateway-") || x === "backend" ? `col:${x}` : `pod:${x}`);

  // Os fios e as fichas de cada salto.
  const pares = new Set<string>();
  const niveis = Math.max(...[...e.caminhos.values()].map((c) => c.length));
  for (const span of SPANS) {
    e.caminhos.get(span.id)!.forEach((s, k) => {
      const par = `${s.de}>${s.para}`;
      if (!pares.has(par)) {
        pares.add(par);
        // Por baixo das peças: um fio que cruza um Pod some atrás dele em vez de riscá-lo.
        f.add({ type: "link", id: `fio:${par}`, path: fioDe(s.de, s.para), dashed: true, tone: "muted", hidden: true, arrow: true, layer: -1 });
      }
      f.add({ type: "token", id: `ficha:${span.id}:${k}`, path: fioDe(s.de, s.para), tone: TOM_DO_TRACE[span.trace], hidden: true, layer: 4, size: 5.5, label: "OTLP", sublabel: `${span.trace} · ${span.id.split("-")[1]}` });
    });
  }

  // As notas dos decisores: quanto de cada trace chegou a cada um.
  const total = (t: "T1" | "T2") => SPANS.filter((s) => s.trace === t).length;
  for (const d of e.decisores) {
    const v = e.visto.get(d)!;
    const inteiro = (["T1", "T2"] as const).some((t) => v.get(t) === total(t));
    const b = caixaDe(d);
    f.add({
      type: "note",
      id: `nota:${d}`,
      at: { x: b.x + b.w / 2, y: b.y + b.h + 22 },
      label: `T1 ${bolinhas(v.get("T1") ?? 0, total("T1"))}  T2 ${bolinhas(v.get("T2") ?? 0, total("T2"))}`,
      sublabel: inteiro ? "holds a whole trace" : "only fragments",
      tone: inteiro ? "conduit" : "live",
      hidden: true,
      layer: 5,
    });
  }

  f.chapter(
    {
      id: "born",
      title: "Two requests, six spans",
      body: "Each request crosses both nodes: frontend, cart and payment run wherever the scheduler put them. Every Pod's SDK ends its span locally — and now has to send it somewhere.",
      detail: { destaque: null },
    },
    (d) => {
      d.stagger(SPANS, 180, (x, span) => {
        x.set(`pod:${span.pod}`, { tone: TOM_DO_TRACE[span.trace], sublabel: `${span.trace} span` });
        x.glow(`pod:${span.pod}`, 1, { dur: 200 }).ping(`pod:${span.pod}`);
      });
      d.wait(900);
      d.glow(PODS.map((p) => `pod:${p.id}`), 0, { dur: 300 });
    },
  );

  const titulo = (para: string): [string, string, LinhaDaTabela] => {
    if (para.startsWith("agent-"))
      return ["Hop 1: the agent on the same node", "Each SDK exports to the agent on its own node: no cross-node traffic, and the agent sees the Pod's IP, so k8sattributes can say which Pod sent it.", "enrichment"];
    if (para.startsWith("gateway-"))
      return opcoes.rotearPorTrace && modo === "agent-gateway"
        ? ["Routed by trace ID", "The agent's loadbalancing exporter hashes the trace ID and picks a replica. Every span of T1 goes to the same one, whichever node it came from.", "tail"]
        : ["Through the Service, to a replica", "A Kubernetes Service balances connections, not spans. gRPC keeps one long connection per exporter, so each sender is pinned to one replica — and spans of one trace land wherever their sender was pinned.", "tail"];
    return modo === "direct"
      ? ["Straight to the backend", "Six SDKs, six connections, six places that hold the backend's endpoint and credentials. Nothing in between can batch, retry, redact or enrich.", "connections"]
      : ["Export to the backend", "Only the last Collector layer talks to the backend: two connections and one place for credentials, whatever the number of Pods.", "connections"];
  };

  for (let k = 0; k < niveis; k += 1) {
    const destinos = new Set(SPANS.map((s) => e.caminhos.get(s.id)![k]?.para).filter(Boolean) as string[]);
    const um = [...destinos][0]!;
    const [title, body, destaque] = titulo(um);

    // Antes do último salto, a pergunta do tail sampling.
    if (k === niveis - 1 && e.decisores.length > 0) {
      f.chapter(
        {
          id: "whole",
          title: "Who holds a whole trace?",
          body: e.traceInteiro.T1 && e.traceInteiro.T2
            ? "Each replica holds every span of one trace. A tail sampling policy here sees the complete story — errors, latency, the whole tree — before deciding."
            : "No single Collector holds all three spans of a trace. A tail sampler would decide on fragments: keep the cart span of a failed checkout and drop its frontend span, or the other way round.",
          detail: { destaque: "tail" },
        },
        (d) => {
          d.show(e.decisores.map((x) => `nota:${x}`), { dur: 400 });
          for (const x of e.decisores) {
            const ok = (["T1", "T2"] as const).some((t) => e.visto.get(x)!.get(t) === total(t));
            d.set(`col:${x}`, { tone: ok ? "conduit" : "live" }).glow(`col:${x}`, 1, { dur: 300 }).ping(`col:${x}`);
          }
          d.wait(2600);
        },
      );
    }

    f.chapter({ id: `hop-${k}`, title, body, detail: { destaque } }, (d) => {
      if (k === niveis - 1) d.glow(e.decisores.map((x) => `col:${x}`), 0, { dur: 200, wait: false });
      const fios = [...new Set(SPANS.map((s) => e.caminhos.get(s.id)![k]).filter(Boolean).map((s) => `fio:${s!.de}>${s!.para}`))];
      d.draw(fios, { dur: 500 });
      d.stagger(SPANS, 160, (x, span) => {
        const s = e.caminhos.get(span.id)![k];
        if (s === undefined) return;
        x.packet({
          tag: "OTLP",
          tone: TOM_DO_TRACE[span.trace],
          from: s.de,
          to: s.para,
          protocol: s.para === "backend" ? "OTLP → backend" : "OTLP/gRPC",
          payload: `${span.trace} ${span.id.split("-")[1]} span${s.para.startsWith("gateway-") && !(opcoes.rotearPorTrace && modo === "agent-gateway") ? " · connection pinned by the Service" : s.para.startsWith("gateway-") ? " · routed by trace ID" : ""}`,
        });
        x.send(`ficha:${span.id}:${k}`, { dur: 900 });
        x.ping(idDe(s.para));
      });
      d.glow([...destinos].map(idDe), 1, { dur: 250 });
      d.wait(1000);
      d.glow([...destinos].map(idDe), 0, { dur: 250 });
    });
  }

  if (e.decisores.length === 0) {
    f.chapter(
      {
        id: "whole",
        title: "Who holds a whole trace?",
        body: "Nobody before the backend. With no Collector in the path, sampling can only be decided at the head, by each SDK, before anyone knows how the request ends.",
        detail: { destaque: "tail" },
      },
      (d) => {
        d.glow("col:backend", 1, { dur: 300 }).ping("col:backend");
        d.wait(2400);
      },
    );
  }

  return { filme: f.build(), entrega: e };
}
