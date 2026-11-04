/**
 * Sinais do host e do Kubernetes: de onde vêm `k8s.pod.name` e as métricas do
 * nó, e quem os anexa.
 *
 * Um cluster mínimo, escrito aqui e não importado: os handbooks são
 * independentes, e este lab só precisa de nós, Pods e IPs. Em cada nó roda um
 * agent (DaemonSet) com três receivers — `otlp` para os spans dos Pods,
 * `hostmetrics` para o próprio host, `kubeletstats` para o que o kubelet sabe
 * dos Pods — e o processador `k8sattributes`, que pergunta ao API server de
 * quem é um IP e anexa nome, namespace, deployment e nó.
 *
 * A pergunta é "qual IP?". Por padrão, o da conexão que trouxe os dados. No
 * agent, é o IP do Pod. Num gateway que recebe dos agents, é o IP do **agent**:
 * nenhum Pod tem esse IP, e o span chega sem `k8s.pod.name`. O conserto é
 * associar pelo atributo de recurso `k8s.pod.ip`, que o SDK preenche pela
 * downward API — aí qualquer Collector acha o Pod.
 *
 * Fontes: [k8sattributes](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/k8sattributesprocessor),
 * [kubeletstats](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/receiver/kubeletstatsreceiver)
 * e [hostmetrics](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/receiver/hostmetricsreceiver).
 */

export interface NoDoCluster {
  readonly nome: string;
  readonly ip: string;
}

export interface PodDoCluster {
  readonly nome: string;
  readonly namespace: string;
  readonly deployment: string;
  readonly servico: string;
  readonly no: string;
  readonly ip: string;
}

export const NOS: readonly NoDoCluster[] = [
  { nome: "node-a", ip: "10.0.1.4" },
  { nome: "node-b", ip: "10.0.1.5" },
];

export const PODS_DO_CLUSTER: readonly PodDoCluster[] = [
  { nome: "checkout-7f9c", namespace: "shop", deployment: "checkout", servico: "checkout", no: "node-a", ip: "10.1.0.12" },
  { nome: "payments-5c2d", namespace: "shop", deployment: "payments", servico: "payments", no: "node-a", ip: "10.1.0.13" },
  { nome: "checkout-8a1e", namespace: "shop", deployment: "checkout", servico: "checkout", no: "node-b", ip: "10.1.1.7" },
];

/** O IP do agent de cada nó: hostNetwork, então o IP do próprio nó. */
export const ipDoAgent = (no: string) => NOS.find((n) => n.nome === no)!.ip;

export type OndeEnriquece = "agent" | "gateway" | "nenhum";
export type Associacao = "conexao" | "recurso";

export interface OpcoesDosNos {
  /** Onde o `k8sattributes` roda. */
  readonly onde: OndeEnriquece;
  /** Como ele acha o Pod: pelo IP da conexão, ou pelo atributo `k8s.pod.ip`. */
  readonly associacao: Associacao;
}

export const OPCOES_DOS_NOS: OpcoesDosNos = { onde: "agent", associacao: "conexao" };

export type Atributos = Readonly<Record<string, string>>;

export interface SpanEnriquecido {
  readonly pod: PodDoCluster;
  /** O IP que o `k8sattributes` usou para perguntar. */
  readonly ipPerguntado: string | null;
  readonly casou: boolean;
  readonly recurso: Atributos;
}

export interface MetricaDoNo {
  readonly receiver: "hostmetrics" | "kubeletstats";
  readonly nome: string;
  readonly recurso: Atributos;
}

/** O API server: de quem é este IP? */
export function podComIp(ip: string): PodDoCluster | null {
  return PODS_DO_CLUSTER.find((p) => p.ip === ip) ?? null;
}

export function enriquecer(opcoes: OpcoesDosNos = OPCOES_DOS_NOS): SpanEnriquecido[] {
  return PODS_DO_CLUSTER.map((pod) => {
    const doSdk: Record<string, string> = { "service.name": pod.servico, ...(opcoes.associacao === "recurso" ? { "k8s.pod.ip": pod.ip } : {}) };
    if (opcoes.onde === "nenhum") return { pod, ipPerguntado: null, casou: false, recurso: doSdk };
    // A conexão que chega ao gateway vem do agent; ao agent, do Pod.
    const ipDaConexao = opcoes.onde === "agent" ? pod.ip : ipDoAgent(pod.no);
    const ipPerguntado = opcoes.associacao === "recurso" ? doSdk["k8s.pod.ip"]! : ipDaConexao;
    const achado = podComIp(ipPerguntado);
    const recurso: Record<string, string> =
      achado === null ? doSdk : { ...doSdk, "k8s.pod.name": achado.nome, "k8s.namespace.name": achado.namespace, "k8s.deployment.name": achado.deployment, "k8s.node.name": achado.no };
    return { pod, ipPerguntado, casou: achado !== null, recurso };
  });
}

/** O que os receivers do agent produzem sozinhos, sem precisar de associação nenhuma. */
export function metricasDosNos(): MetricaDoNo[] {
  return [
    ...NOS.map((n) => ({ receiver: "hostmetrics" as const, nome: "system.cpu.utilization", recurso: { "host.name": n.nome } })),
    ...PODS_DO_CLUSTER.map((p) => ({ receiver: "kubeletstats" as const, nome: "k8s.pod.cpu.time", recurso: { "k8s.pod.name": p.nome, "k8s.namespace.name": p.namespace, "k8s.node.name": p.no } })),
  ];
}
