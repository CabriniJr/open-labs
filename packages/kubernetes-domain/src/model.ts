import type { InteractiveModel } from "@ovh/interactive-core";
import { templateKey } from "./manifest.js";
import type { Workload } from "./manifest.js";

export const NODES = [
  { id: "worker-01", cpu: 2000, memory: 2048 },
  { id: "worker-02", cpu: 2000, memory: 2048 },
] as const;
export const AVAILABLE_IMAGES: readonly string[] = ["nginx:1.27", "nginx:1.28"];
export type PodPhase = "Pending" | "Running" | "Failed";
export type PodReason = "Unschedulable" | "ContainerCreating" | "Running" | "ImagePullBackOff" | "CrashLoopBackOff" | "OOMKilled" | "Terminating";
export interface Pod {
  readonly uid: string;
  readonly name: string;
  readonly revision: number;
  readonly spec: Workload;
  readonly node: string | null;
  readonly phase: PodPhase;
  readonly reason: PodReason;
  readonly ready: boolean;
  readonly changedAt: number;
  readonly restartAt: number;
  readonly restarts: number;
  readonly lastTermination: string | null;
  readonly deletionAt: number | null;
}
export interface ClusterEvent {
  readonly tick: number;
  readonly resource: string;
  readonly reason: string;
  readonly detail: string;
}
export interface ClusterState {
  readonly tick: number;
  readonly workload: Workload | null;
  readonly source: string;
  readonly revision: number;
  readonly serial: number;
  readonly pods: readonly Pod[];
  readonly events: readonly ClusterEvent[];
  readonly standaloneDeleted: boolean;
  readonly cpuDemand: number;
  readonly memoryDemand: number;
}
export type ClusterAction =
  | { readonly type: "apply"; readonly workload: Workload; readonly source: string }
  | { readonly type: "tick" }
  | { readonly type: "delete-pod"; readonly uid: string }
  | { readonly type: "load"; readonly cpu: number; readonly memory: number };

export function initialCluster(): ClusterState {
  return { tick: 0, workload: null, source: "", revision: 0, serial: 0, pods: [], events: [], standaloneDeleted: false, cpuDemand: 350, memoryDemand: 192 };
}

function note(state: ClusterState, resource: string, reason: string, detail: string): ClusterState {
  return { ...state, events: [...state.events, { tick: state.tick, resource, reason, detail }].slice(-40) };
}

function terminate(pod: Pod, tick: number): Pod {
  return pod.deletionAt === null ? { ...pod, deletionAt: tick + Math.max(1, pod.spec.grace), reason: "Terminating", ready: false, changedAt: tick } : pod;
}

export function nodeResources(state: Readonly<ClusterState>) {
  return NODES.map((node) => {
    const pods = state.pods.filter((p) => p.node === node.id && p.phase !== "Failed");
    const cpuReserved = pods.reduce((sum, p) => sum + p.spec.cpuRequest, 0);
    const memoryReserved = pods.reduce((sum, p) => sum + p.spec.memoryRequest, 0);
    return { ...node, cpuReserved, memoryReserved, cpuAvailable: node.cpu - cpuReserved, memoryAvailable: node.memory - memoryReserved };
  });
}

export function clusterSummary(state: Readonly<ClusterState>) {
  const live = state.pods.filter((p) => p.deletionAt === null && p.phase !== "Failed");
  const nodes = nodeResources(state);
  return {
    desired: state.workload?.replicas ?? 0,
    ready: live.filter((p) => p.ready).length,
    pending: live.filter((p) => p.phase === "Pending").length,
    restarting: live.filter((p) => p.reason === "CrashLoopBackOff").length,
    cpuAvailable: nodes.reduce((sum, n) => sum + n.cpuAvailable, 0),
    memoryAvailable: nodes.reduce((sum, n) => sum + n.memoryAvailable, 0),
  };
}

function apply(state: Readonly<ClusterState>, workload: Workload, source: string): ClusterState {
  const previous = state.workload;
  if (previous && (previous.kind !== workload.kind || previous.name !== workload.name || previous.namespace !== workload.namespace)) {
    throw new Error("This sandbox holds one workload. Load a new experiment to change its kind, name or namespace.");
  }
  const changed = previous !== null && templateKey(previous) !== templateKey(workload);
  if (previous?.kind === "Deployment" && JSON.stringify(Object.entries(previous.selector ?? {}).sort()) !== JSON.stringify(Object.entries(workload.selector ?? {}).sort())) throw new Error("A Deployment selector is immutable. Start a new experiment to change it.");
  if (previous?.kind === "Pod" && changed) {
    if (state.pods.some((p) => p.phase === "Failed")) throw new Error("This Pod is terminal. Delete and recreate it before changing its image.");
    const withoutImage = (w: Workload) => templateKey({ ...w, image: "" });
    if (withoutImage(previous) !== withoutImage(workload)) throw new Error("This lab does not model in-place Pod resource resize. Recreate the Pod, or edit a Deployment template.");
  }
  const revision = state.revision + (previous === null || (changed && workload.kind === "Deployment") ? 1 : 0);
  let pods = state.pods;
  if (changed && workload.kind === "Deployment") pods = pods.map((p) => terminate(p, state.tick));
  if (changed && workload.kind === "Pod") pods = pods.map((p) => p.deletionAt !== null ? p : { ...p, spec: workload, ready: false, reason: "ContainerCreating", phase: "Pending", changedAt: state.tick });
  return note({ ...state, workload, source, revision, pods, standaloneDeleted: state.pods.length === 0 ? false : state.standaloneDeleted }, workload.name, "Applied", changed ? "Template changed. Recreate replaces old Pods; an image edit restarts a standalone Pod container." : "Desired state accepted. Reconciliation happens on the next step.");
}

function step(state: Readonly<ClusterState>): ClusterState {
  let next: ClusterState = { ...state, tick: state.tick + 1, pods: state.pods.filter((p) => p.deletionAt === null || p.deletionAt > state.tick + 1) };
  for (const p of state.pods) if (!next.pods.some((x) => x.uid === p.uid)) next = note(next, p.name, "Deleted", "Pod removed; its resource reservation is released.");
  const wanted = next.workload;
  if (wanted) {
    let active = next.pods.filter((p) => p.deletionAt === null && p.phase !== "Failed" && p.revision === next.revision);
    if (active.length > wanted.replicas) {
      const excess = new Set(active.slice(wanted.replicas).map((p) => p.uid));
      next = { ...next, pods: next.pods.map((p) => excess.has(p.uid) ? terminate(p, next.tick) : p) };
      next = note(next, wanted.name, "ScaledDown", "Surplus Pods are terminating; reservations remain until removal.");
      active = active.slice(0, wanted.replicas);
    }
    const oldRevisionExists = next.pods.some((p) => p.revision !== next.revision);
    const mayCreate = wanted.kind === "Deployment" ? !oldRevisionExists : !next.standaloneDeleted && next.pods.length === 0;
    if (mayCreate) {
      const count = wanted.kind === "Deployment" ? wanted.replicas - active.length : 1;
      for (let i = 0; i < count; i += 1) {
        const serial = next.serial + 1;
        const name = wanted.kind === "Deployment" ? `${wanted.name}-r${next.revision}-${String(serial).padStart(3, "0")}` : wanted.name;
        const pod: Pod = { uid: `pod-${serial}`, name, revision: next.revision, spec: wanted, node: null, phase: "Pending", reason: "Unschedulable", ready: false, changedAt: next.tick, restartAt: 0, restarts: 0, lastTermination: null, deletionAt: null };
        next = note({ ...next, serial, pods: [...next.pods, pod] }, name, "Created", wanted.kind === "Deployment" ? "ReplicaSet creates a Pod to match the desired replica count." : "The Pod object was created directly.");
      }
    }
  }

  const processed: Pod[] = [];
  for (const original of next.pods) {
    let pod = original;
    if (pod.deletionAt !== null || pod.phase === "Failed") { processed.push(pod); continue; }
    if (pod.node === null) {
      const resources = nodeResources({ ...next, pods: [...processed, ...next.pods.slice(processed.length)] });
      const fit = resources.find((n) => n.cpuAvailable >= pod.spec.cpuRequest && n.memoryAvailable >= pod.spec.memoryRequest);
      if (fit) {
        pod = { ...pod, node: fit.id, reason: "ContainerCreating", changedAt: next.tick };
        next = note(next, pod.name, "Scheduled", `Bound to ${fit.id} using requests, not limits or observed usage.`);
      } else if (next.tick === pod.changedAt || next.tick % 5 === 0) {
        next = note(next, pod.name, "FailedScheduling", "No single node has enough unreserved CPU and memory for this request.");
      }
    } else if (pod.reason === "CrashLoopBackOff") {
      if (next.tick >= pod.restartAt) {
        pod = { ...pod, reason: "ContainerCreating", restarts: pod.restarts + 1, changedAt: next.tick };
        next = note(next, pod.name, "Restarting", "The kubelet restarts the container. The Pod UID and its node stay the same.");
      }
    } else if (!AVAILABLE_IMAGES.includes(pod.spec.image)) {
      if (pod.reason !== "ImagePullBackOff") next = note(next, pod.name, "ImagePullBackOff", "Image is absent from this experiment's simulated image catalog.");
      pod = { ...pod, phase: "Pending", ready: false, reason: "ImagePullBackOff" };
    } else if (next.tick > pod.changedAt && pod.spec.memoryLimit !== null && next.memoryDemand > pod.spec.memoryLimit) {
      const restart = pod.spec.restartPolicy !== "Never";
      pod = { ...pod, phase: restart ? "Running" : "Failed", ready: false, reason: restart ? "CrashLoopBackOff" : "OOMKilled", lastTermination: "OOMKilled", restartAt: next.tick + Math.min(8, 2 ** Math.min(pod.restarts + 1, 3)), changedAt: next.tick };
      next = note(next, pod.name, "OOMKilled", `${next.memoryDemand} Mi synthetic demand exceeds ${pod.spec.memoryLimit} Mi limit. ${restart ? "Restart backoff begins." : "restartPolicy: Never leaves the Pod Failed."}`);
    } else if (next.tick > pod.changedAt) {
      const wasRunning = pod.reason === "Running";
      pod = { ...pod, phase: "Running", reason: "Running", ready: next.tick - pod.changedAt >= 2 };
      if (!wasRunning) next = note(next, pod.name, "Started", "Container is running. This experiment uses a fixed two-step startup before Ready.");
    }
    processed.push(pod);
  }
  return { ...next, pods: processed };
}

export function transitionCluster(state: Readonly<ClusterState>, action: ClusterAction): ClusterState {
  if (action.type === "tick") return step(state);
  if (action.type === "apply") return apply(state, action.workload, action.source);
  if (action.type === "load") {
    if (!Number.isInteger(action.cpu) || action.cpu < 0 || action.cpu > 2000 || !Number.isInteger(action.memory) || action.memory < 1 || action.memory > 2048) throw new Error("Synthetic demand is outside the experiment range.");
    return { ...state, cpuDemand: action.cpu, memoryDemand: action.memory };
  }
  const pod = state.pods.find((p) => p.uid === action.uid);
  if (!pod || pod.deletionAt !== null) return { ...state };
  return note({ ...state, standaloneDeleted: state.workload?.kind === "Pod" || state.standaloneDeleted, pods: state.pods.map((p) => p.uid === pod.uid ? terminate(p, state.tick) : p) }, pod.name, "DeletionRequested", "Deletion is graceful. A controller may create a replacement with a new UID.");
}

export const POD_LIFECYCLE_MODEL: InteractiveModel<ClusterState, ClusterAction> = {
  id: "kubernetes/pod-lifecycle", initial: initialCluster, transition: transitionCluster,
};
