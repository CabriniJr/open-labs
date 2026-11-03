/**
 * Onde o Collector mora, e o que isso muda.
 *
 * Seis Pods de aplicação em dois nós, duas requisições atravessando três
 * serviços cada. Quatro implantações: o SDK exporta direto; um agent por nó
 * (DaemonSet); um gateway (Deployment com duas réplicas atrás de um Service);
 * ou agent na frente de gateway.
 *
 * O fato que o lab existe para mostrar: atrás de um Service, gRPC balanceia
 * por CONEXÃO. Cada exportador fica preso a uma réplica, e os spans de um mesmo
 * trace — vindos de Pods diferentes — caem em réplicas diferentes. Nenhuma vê o
 * trace inteiro, e um tail sampler numa réplica decide sobre metade de uma
 * história. O `loadbalancing` exporter no agent roteia por trace ID e devolve
 * cada trace inteiro a uma réplica.
 *
 * Determinístico: o "hash" do trace é a posição dele, para o exemplo não
 * depender de sorte de distribuição.
 * Refs: https://opentelemetry.io/docs/collector/deployment/ ·
 * https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/exporter/loadbalancingexporter
 */
export type Modo = "direct" | "agent" | "gateway" | "agent-gateway";

export const MODOS: readonly { readonly id: Modo; readonly nome: string }[] = [
  { id: "direct", nome: "SDK → backend" },
  { id: "agent", nome: "Agent per node" },
  { id: "gateway", nome: "Gateway" },
  { id: "agent-gateway", nome: "Agent + gateway" },
];

export interface OpcoesDeImplantacao {
  readonly modo: Modo;
  /** `loadbalancing` exporter no agent, com routing_key traceID. Só vale em agent + gateway. */
  readonly rotearPorTrace: boolean;
}

export const NOS_DO_CLUSTER = ["node-1", "node-2"] as const;
export type No = (typeof NOS_DO_CLUSTER)[number];

export interface PodDeApp {
  readonly id: string;
  readonly servico: "frontend" | "cart" | "payment";
  readonly no: No;
}

/** Três serviços, uma réplica de cada em cada nó. */
export const PODS: readonly PodDeApp[] = [
  { id: "frontend-1", servico: "frontend", no: "node-1" },
  { id: "cart-1", servico: "cart", no: "node-1" },
  { id: "payment-1", servico: "payment", no: "node-1" },
  { id: "frontend-2", servico: "frontend", no: "node-2" },
  { id: "cart-2", servico: "cart", no: "node-2" },
  { id: "payment-2", servico: "payment", no: "node-2" },
];

export const REPLICAS = ["gateway-a", "gateway-b"] as const;

export interface SpanDoTrace {
  readonly id: string;
  readonly trace: "T1" | "T2";
  readonly pod: string;
}

/** Cada requisição atravessa os dois nós: é o que espalha os spans. */
export const SPANS: readonly SpanDoTrace[] = [
  { id: "T1-frontend", trace: "T1", pod: "frontend-1" },
  { id: "T1-cart", trace: "T1", pod: "cart-2" },
  { id: "T1-payment", trace: "T1", pod: "payment-1" },
  { id: "T2-frontend", trace: "T2", pod: "frontend-2" },
  { id: "T2-cart", trace: "T2", pod: "cart-1" },
  { id: "T2-payment", trace: "T2", pod: "payment-2" },
];

export interface Salto {
  readonly de: string;
  readonly para: string;
}

export interface Entrega {
  readonly opcoes: OpcoesDeImplantacao;
  /** O caminho de cada span, salto a salto, até o backend. */
  readonly caminhos: ReadonlyMap<string, readonly Salto[]>;
  /** Os coletores que exportam para o backend: é neles que um tail sampler decide. */
  readonly decisores: readonly string[];
  /** Que spans de que trace cada decisor recebe. */
  readonly visto: ReadonlyMap<string, ReadonlyMap<"T1" | "T2", number>>;
  /** Cada trace está inteiro em um único decisor? */
  readonly traceInteiro: Readonly<Record<"T1" | "T2", boolean>>;
  readonly conexoesComBackend: number;
  /** Onde o endpoint e a credencial do backend precisam estar configurados. */
  readonly credenciais: string;
  /** Onde o `k8sattributes` vê o IP do Pod de origem. */
  readonly enriquecimento: string;
  /** Onde os spans esperam se o backend cair. */
  readonly fila: string;
}

const agentDe = (no: No) => `agent-${no.slice(-1)}`;
const podDe = (id: string) => PODS.find((p) => p.id === id)!;

/**
 * A réplica em que o Service fixou a conexão de cada cliente.
 *
 * Escrita à mão, e não por ordem: com "posição módulo dois", o T1 caía inteiro
 * na mesma réplica por coincidência — e o lab ensinaria que o gateway sozinho
 * resolve, que é o contrário do que acontece com qualquer número real de Pods.
 * Este arranjo é um dos que o kube-proxy pode produzir, e nele nenhum trace
 * está inteiro por acaso.
 */
const CONEXAO: Readonly<Record<string, (typeof REPLICAS)[number]>> = {
  "frontend-1": "gateway-a",
  "cart-1": "gateway-a",
  "payment-1": "gateway-b",
  "frontend-2": "gateway-b",
  "cart-2": "gateway-b",
  "payment-2": "gateway-a",
  "agent-1": "gateway-a",
  "agent-2": "gateway-b",
};

function replicaDaConexao(cliente: string): string {
  return CONEXAO[cliente]!;
}

export function entregar(opcoes: OpcoesDeImplantacao): Entrega {
  const { modo } = opcoes;
  const agentes = NOS_DO_CLUSTER.map(agentDe);
  const caminhos = new Map<string, Salto[]>();
  for (const span of SPANS) {
    const pod = podDe(span.pod);
    const agente = agentDe(pod.no);
    const saltos: Salto[] = [];
    if (modo === "direct") saltos.push({ de: pod.id, para: "backend" });
    else if (modo === "agent") saltos.push({ de: pod.id, para: agente }, { de: agente, para: "backend" });
    else if (modo === "gateway") {
      const r = replicaDaConexao(pod.id);
      saltos.push({ de: pod.id, para: r }, { de: r, para: "backend" });
    } else {
      const r = opcoes.rotearPorTrace ? REPLICAS[span.trace === "T1" ? 0 : 1]! : replicaDaConexao(agente);
      saltos.push({ de: pod.id, para: agente }, { de: agente, para: r }, { de: r, para: "backend" });
    }
    caminhos.set(span.id, saltos);
  }

  const decisores = modo === "direct" ? [] : modo === "agent" ? agentes : [...REPLICAS];
  const visto = new Map<string, Map<"T1" | "T2", number>>();
  for (const d of decisores) visto.set(d, new Map());
  for (const span of SPANS) {
    const ultimo = caminhos.get(span.id)!.at(-1)!.de;
    const conta = visto.get(ultimo);
    if (conta !== undefined) conta.set(span.trace, (conta.get(span.trace) ?? 0) + 1);
  }
  const inteiro = (t: "T1" | "T2") => decisores.some((d) => visto.get(d)!.get(t) === SPANS.filter((s) => s.trace === t).length);

  return {
    opcoes,
    caminhos,
    decisores,
    visto,
    traceInteiro: { T1: inteiro("T1"), T2: inteiro("T2") },
    conexoesComBackend: modo === "direct" ? PODS.length : 2,
    credenciais: modo === "direct" ? "every app Pod (6)" : modo === "agent" ? "the agent DaemonSet (2 copies)" : "the gateway Deployment",
    enriquecimento:
      modo === "direct" ? "nowhere: only the SDK's own resource" : modo === "gateway" ? "gateway (it sees the Pod IP)" : "agent (a gateway behind it would see the agent's IP)",
    fila: modo === "direct" ? "in each app's memory" : modo === "agent" ? "in each node's agent" : "in the gateway",
  };
}
