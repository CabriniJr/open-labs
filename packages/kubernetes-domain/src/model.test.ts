import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { InteractiveSession } from "@ovh/interactive-core";
import { cpu, memory, parseManifest } from "./manifest.js";
import { DEPLOYMENT_MANIFEST, POD_MANIFEST, EXPERIMENTS } from "./examples.js";
import { clusterSummary, nodeResources, POD_LIFECYCLE_MODEL } from "./model.js";

function experiment(source = DEPLOYMENT_MANIFEST) {
  const session = new InteractiveSession(POD_LIFECYCLE_MODEL);
  apply(session, source);
  return session;
}
function apply(s: ReturnType<typeof experiment>, source: string) {
  const p = parseManifest(source);
  if (!p.ok) throw new Error(p.errors.join("\n"));
  s.dispatch({ type: "apply", workload: p.value, source });
}
function ticks(s: ReturnType<typeof experiment>, count: number) { for (let i = 0; i < count; i++) s.dispatch({ type: "tick" }); return s.state; }
const example = (id: string) => EXPERIMENTS.find((e) => e.id === id)!.manifest;

describe("o manifesto é nativo, com limites explícitos de modelagem", () => {
  it.each(EXPERIMENTS)("$id é um manifesto aceito", (e) => { expect(parseManifest(e.manifest).ok).toBe(true); });
  it("recusa YAML ambíguo, campos não modelados e requests acima do limit", () => {
    for (const source of ["kind: Pod\nkind: Deployment", DEPLOYMENT_MANIFEST.replace("replicas: 2", "replicas: 2\n  paused: true"), DEPLOYMENT_MANIFEST.replace("cpu: 500m", "cpu: 1500m")]) expect(parseManifest(source).ok).toBe(false);
  });
  it("recusa seletor que não seleciona o template e a estratégia não implementada", () => {
    expect(parseManifest(DEPLOYMENT_MANIFEST.replace("app: checkout", "app: other")).ok).toBe(false);
    expect(parseManifest(DEPLOYMENT_MANIFEST.replace("Recreate", "RollingUpdate")).ok).toBe(false);
  });
  it("converte as unidades sem confundir millicores com cores", () => {
    expect(cpu("500m")).toBe(cpu("0.5")); expect(cpu(1)).toBe(1000); expect(memory("1Gi")).toBe(1024);
    expect(() => cpu("0.0001")).toThrow(); expect(() => memory("256M")).toThrow();
  });
  it("os dois manifestos iniciais são os arquivos que podem rodar no cluster real", () => {
    expect(readFileSync(new URL("../../../labs/pod-lifecycle/deployment.yaml", import.meta.url), "utf8").trim()).toBe(DEPLOYMENT_MANIFEST.trim());
    expect(readFileSync(new URL("../../../labs/pod-lifecycle/pod.yaml", import.meta.url), "utf8").trim()).toBe(POD_MANIFEST.trim());
  });
});

describe("o controlador, o scheduler e o kubelet não são a mesma coisa", () => {
  it("escala réplicas por requests, sem exceder a capacidade de nenhum node", () => {
    const s = experiment(example("scale")); ticks(s, 3);
    expect(clusterSummary(s.state)).toMatchObject({ desired: 6, ready: 6, cpuAvailable: 1000 });
    expect(nodeResources(s.state).map((n) => n.cpuReserved)).toEqual([2000, 1000]);
  });
  it("um Pod não soma a capacidade livre de nodes diferentes", () => {
    const s = experiment(example("pending")); ticks(s, 4);
    expect(s.state.pods.every((p) => p.node === null && p.phase === "Pending")).toBe(true);
    expect(clusterSummary(s.state).cpuAvailable).toBe(4000);
  });
  it("limites maiores não reservam mais capacidade que os requests", () => {
    const s = experiment(DEPLOYMENT_MANIFEST.replace("cpu: 1000m", "cpu: 4000m")); ticks(s, 3);
    expect(clusterSummary(s.state).cpuAvailable).toBe(3000);
  });
  it("quando oito requests cabem, a nona réplica permanece Pending", () => {
    const s = experiment(DEPLOYMENT_MANIFEST.replace("replicas: 2", "replicas: 9")); ticks(s, 3);
    expect(clusterSummary(s.state)).toMatchObject({ ready: 8, pending: 1, cpuAvailable: 0 });
  });
  it("um container pode falhar antes de o Pod sair de Pending, mas já reservar recursos", () => {
    const s = experiment(example("image")); ticks(s, 4);
    expect(s.state.pods.every((p) => p.node !== null && p.phase === "Pending" && p.reason === "ImagePullBackOff")).toBe(true);
    expect(clusterSummary(s.state).cpuAvailable).toBe(3000);
  });
  it("OOM e restart preservam UID, node e reserva; a carga menor permite recuperação", () => {
    const s = experiment(example("oom")); ticks(s, 2);
    const before = s.state.pods[0]!;
    expect(before).toMatchObject({ phase: "Running", reason: "CrashLoopBackOff", lastTermination: "OOMKilled" });
    s.dispatch({ type: "load", cpu: 350, memory: 96 }); ticks(s, 5);
    const after = s.state.pods[0]!;
    expect(after).toMatchObject({ uid: before.uid, node: before.node, ready: true });
    expect(after.restarts).toBe(1);
    expect(clusterSummary(s.state).cpuAvailable).toBe(3000);
  });
  it("restartPolicy Never deixa o Pod Failed sem criar outro", () => {
    const s = experiment(POD_MANIFEST.replace("Always", "Never").replace("memory: 256Mi", "memory: 64Mi").replace("memory: 512Mi", "memory: 128Mi")); ticks(s, 10);
    expect(s.state.pods).toHaveLength(1);
    expect(s.state.pods[0]).toMatchObject({ phase: "Failed", reason: "OOMKilled", restarts: 0 });
  });
  it("exceder o limite de CPU não mata o container nem escala o Deployment", () => {
    const s = experiment(); s.dispatch({ type: "load", cpu: 1500, memory: 192 }); ticks(s, 6);
    expect(s.state.pods).toHaveLength(2);
    expect(s.state.pods.every((p) => p.ready && p.restarts === 0)).toBe(true);
  });
  it("deletar um Pod gerenciado cria outro UID; reserva do antigo só sai após a graça", () => {
    const s = experiment(); ticks(s, 3);
    const old = s.state.pods[0]!;
    s.dispatch({ type: "delete-pod", uid: old.uid });
    expect(clusterSummary(s.state).cpuAvailable).toBe(3000);
    ticks(s, 1);
    expect(s.state.pods).toHaveLength(3);
    expect(clusterSummary(s.state).cpuAvailable).toBe(2500);
    ticks(s, 3);
    expect(s.state.pods.some((p) => p.uid === old.uid)).toBe(false);
    expect(clusterSummary(s.state)).toMatchObject({ ready: 2, cpuAvailable: 3000 });
  });
  it("um Pod isolado deletado só volta quando seu manifesto é reaplicado", () => {
    const s = experiment(POD_MANIFEST); ticks(s, 3);
    const uid = s.state.pods[0]!.uid;
    s.dispatch({ type: "delete-pod", uid }); ticks(s, 8);
    expect(s.state.pods).toHaveLength(0);
    apply(s, POD_MANIFEST); ticks(s, 3);
    expect(s.state.pods[0]!.uid).not.toBe(uid);
  });
  it("scale to zero respeita a graça antes de liberar as reservas", () => {
    const s = experiment(); ticks(s, 3);
    apply(s, DEPLOYMENT_MANIFEST.replace("replicas: 2", "replicas: 0"));
    ticks(s, 1); expect(clusterSummary(s.state).cpuAvailable).toBe(3000);
    ticks(s, 2); expect(s.state.pods).toHaveLength(0); expect(clusterSummary(s.state).cpuAvailable).toBe(4000);
  });
  it("Recreate espera os Pods antigos saírem antes da nova revisão", () => {
    const s = experiment(); ticks(s, 3);
    const old = s.state.pods.map((p) => p.uid);
    apply(s, DEPLOYMENT_MANIFEST.replace("nginx:1.27", "nginx:1.28"));
    ticks(s, 1); expect(s.state.pods.map((p) => p.uid)).toEqual(old);
    ticks(s, 4); expect(s.state.pods.every((p) => !old.includes(p.uid) && p.spec.image === "nginx:1.28")).toBe(true);
  });
  it("editar recursos de um Pod isolado é recusado sem apagar a execução", () => {
    const s = experiment(POD_MANIFEST); ticks(s, 3); const before = s.state;
    expect(() => apply(s, POD_MANIFEST.replace("cpu: 500m", "cpu: 600m"))).toThrow(/resize/);
    expect(s.state).toEqual(before);
  });
  it("rebobinar e repetir os mesmos eventos conserva estados, UIDs e contadores", () => {
    const a = experiment(); const b = experiment(); ticks(a, 8); ticks(b, 8);
    expect(a.state).toEqual(b.state);
    const at8 = a.state; a.seek(3); ticks(a, 6); expect(a.state).toEqual(at8);
  });
});
