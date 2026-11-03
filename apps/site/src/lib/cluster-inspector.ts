import { NODES, nodeResources, type ClusterState } from "@ovh/kubernetes-domain";

export interface ClusterResourceDetails {
  readonly title: string;
  readonly kind: string;
  readonly fields: readonly (readonly [string, string])[];
  readonly note: string;
}

/** Resource identity is shared by the tree, scene and inspector. */
export function clusterResourceIds(state: Readonly<ClusterState>): ReadonlySet<string> {
  return new Set(["plano", "fila", "controlador", "escalonador", ...NODES.map(n => `no:${n.id}`), ...state.pods.map(p => `pod:${p.uid}`)]);
}

export function clusterResourceDetails(state: Readonly<ClusterState>, id: string | null): ClusterResourceDetails | null {
  const node = nodeResources(state).find(n => `no:${n.id}` === id);
  if (node) return {
    title: node.id, kind: "Node",
    fields: [["CPU reserved", `${node.cpuReserved} / ${node.cpu}m`], ["CPU unreserved", `${node.cpuAvailable}m`], ["Memory reserved", `${node.memoryReserved} / ${node.memory}Mi`], ["Memory unreserved", `${node.memoryAvailable}Mi`], ["Assigned Pods", String(state.pods.filter(p => p.node === node.id).length)]],
    note: "Reservations come from requests, not measured usage. A terminating Pod keeps its reservation until removal; a container restart keeps the same Pod and node.",
  };
  if (id === "controlador") return {
    title: state.workload?.kind === "Deployment" ? "ReplicaSet" : "No controller", kind: "Controller",
    fields: [["Workload", state.workload?.name ?? "None"], ["Desired replicas", String(state.workload?.replicas ?? 0)], ["Revision", String(state.revision)], ["Current active Pods", String(state.pods.filter(p => p.revision === state.revision && p.deletionAt === null && p.phase !== "Failed").length)]],
    note: state.workload?.kind === "Deployment" ? "The Deployment's ReplicaSet replaces a deleted Pod with a new UID to restore the desired count." : "A standalone Pod has no controller to create a replacement after deletion.",
  };
  if (id === "escalonador" || id === "fila") return {
    title: id === "fila" ? "Unassigned Pods" : "Scheduler", kind: id === "fila" ? "Pending queue" : "Scheduling",
    fields: [["Unassigned Pods", String(state.pods.filter(p => p.node === null).length)], ["Fixed nodes", String(NODES.length)], ["Unreserved CPU", `${nodeResources(state).reduce((s, n) => s + n.cpuAvailable, 0)}m`]],
    note: "This model uses first-fit placement. Each Pod's requests must fit on one node; free capacity on different nodes cannot be combined. A scheduled Pod can still be Pending while its container starts.",
  };
  if (id === "plano") return {
    title: "Reconciliation model", kind: "Control plane",
    fields: [["Workload kind", state.workload?.kind ?? "None"], ["Namespace", state.workload?.namespace ?? "default"], ["Model tick", `${state.tick}s`]],
    note: "A local model of controller and scheduler responsibilities. This scene is not connected to a Kubernetes API server.",
  };
  return null;
}
