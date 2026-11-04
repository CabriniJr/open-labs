import type { MalEntendido } from "../providers/labels.js";

export const MAL_ENTENDIDOS_DOS_NOS: readonly MalEntendido[] = [
  {
    crenca: "k8sattributes knows which Pod sent the data.",
    spec:
      "It looks the sender up, by default by the IP of the incoming connection. Behind another Collector, that IP " +
      "is the forwarding Collector's, not the Pod's, and the lookup finds nothing.",
    fonte: "https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/k8sattributesprocessor",
    onde: "lookup",
  },
  {
    crenca: "Pod metrics and Pod traces always line up.",
    spec:
      "kubeletstats metrics come with pod names from the kubelet. Spans only get them if k8sattributes (or the SDK " +
      "resource detector) adds them; without that, the two cannot be joined by Pod.",
    fonte: "https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/receiver/kubeletstatsreceiver",
    onde: "backend",
  },
  {
    crenca: "Enrich in the gateway, it is the one place that sees everything.",
    spec:
      "Either run k8sattributes in the agent, where the connection is the Pod's, or associate by a resource " +
      "attribute such as k8s.pod.ip that the SDK sets — then any Collector can find the Pod.",
    fonte: "https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/k8sattributesprocessor#configuration",
    onde: "lookup",
  },
];
