import { InteractiveSession } from "@ovh/interactive-core";
import { frameAt } from "@ovh/motion";
import { describe, expect, it } from "vitest";
import { filmeDaTransicao, lugares } from "./cena.js";
import { EXPERIMENTS } from "./examples.js";
import { DEPLOYMENT_MANIFEST } from "./examples.js";
import { parseManifest } from "./manifest.js";
import { POD_LIFECYCLE_MODEL } from "./model.js";

function sessao(source = DEPLOYMENT_MANIFEST) {
  const s = new InteractiveSession(POD_LIFECYCLE_MODEL);
  const p = parseManifest(source);
  if (!p.ok) throw new Error(p.errors.join("\n"));
  s.dispatch({ type: "apply", workload: p.value, source });
  return s;
}

const estado = (f: ReturnType<typeof filmeDaTransicao>, id: string, t: number) =>
  frameAt(f, t).entities.find((e) => e.spec.id === id)!.state;

describe("a cena do cluster sai do estado", () => {
  it("keeps every Pod in a distinct slot when requests allow more than eight on one node", () => {
    const s = sessao(DEPLOYMENT_MANIFEST.replace("replicas: 2", "replicas: 12").replace("cpu: 500m", "cpu: 100m").replace("memory: 256Mi", "memory: 64Mi"));
    const state = s.dispatch({ type: "tick" });
    expect(state.pods).toHaveLength(12);
    const boxes = [...lugares(state).values()];
    expect(new Set(boxes.map(b => `${b.x}:${b.y}`)).size).toBe(12);
    const film = filmeDaTransicao(null, state);
    const node = film.entities.find(e => e.id === "no:worker-01");
    expect(node?.type).toBe("region");
    if (node?.type !== "region") throw new Error("Missing node");
    for (const b of boxes) expect(b.y + b.h).toBeLessThan(node.box.y + node.box.h - 84);
  });

  it("grows the pending area instead of stacking unassigned Pods in the same slot", () => {
    const source = EXPERIMENTS.find(e => e.id === "pending")!.manifest.replace("replicas: 2", "replicas: 12");
    const s = sessao(source), state = s.dispatch({ type: "tick" });
    const boxes = [...lugares(state).values()];
    expect(new Set(boxes.map(b => `${b.x}:${b.y}`)).size).toBe(12);
    const film = filmeDaTransicao(null, state);
    for (const b of boxes) expect(b.y + b.h).toBeLessThan(film.height);
  });
  it("um Pod criado e agendado no mesmo passo sai do scheduler e anda até a vaga", () => {
    const s = sessao();
    const antes = s.state; // aplicado, nenhum Pod ainda
    const depois = s.dispatch({ type: "tick" });
    const pod = depois.pods[0]!;
    expect(pod.node).not.toBeNull();
    const f = filmeDaTransicao(antes, depois);
    const para = lugares(depois).get(pod.uid)!;
    expect(estado(f, `pod:${pod.uid}`, 0).opacity).toBe(0);
    expect(Math.abs(estado(f, `pod:${pod.uid}`, 0).dx)).toBeGreaterThan(50);
    expect(para.x).toBeGreaterThan(380);
    expect(estado(f, `pod:${pod.uid}`, f.duration).dx).toBeCloseTo(0);
    // A reserva do nó cresce durante o mesmo filme.
    const no = depois.pods[0]!.node!;
    expect(estado(f, `cpu:${no}`, 0).progress).toBeLessThan(estado(f, `cpu:${no}`, f.duration).progress);
    expect(estado(f, "escalonador", 200).glow).toBeGreaterThan(0);
  });

  it("um Pod deletado se apaga, e o substituto nasce com outro UID", () => {
    const s = sessao();
    for (let i = 0; i < 4; i++) s.dispatch({ type: "tick" });
    const vivo = s.state.pods[0]!;
    const antes = s.dispatch({ type: "delete-pod", uid: vivo.uid });
    let depois = antes;
    for (let i = 0; i < 3 && depois.pods.some((p) => p.uid === vivo.uid); i++) depois = s.dispatch({ type: "tick" });
    const f = filmeDaTransicao(antes, depois);
    expect(estado(f, `pod:${vivo.uid}`, f.duration).opacity).toBeLessThan(0.05);
    const novo = depois.pods.find((p) => !antes.pods.some((q) => q.uid === p.uid));
    expect(novo).toBeDefined();
    expect(estado(f, `pod:${novo!.uid}`, 0).opacity).toBe(0);
    expect(estado(f, `pod:${novo!.uid}`, f.duration).opacity).toBeCloseTo(1);
  });

  it("um Pod sem vaga fica na fila, no tom de pendente", () => {
    const s = sessao(EXPERIMENTS.find((e) => e.id === "pending")!.manifest);
    const antes = s.state;
    const depois = s.dispatch({ type: "tick" });
    const f = filmeDaTransicao(antes, depois);
    const p = depois.pods[0]!;
    expect(p.node).toBeNull();
    expect(lugares(depois).get(p.uid)!.x).toBeLessThan(340);
    expect(estado(f, `pod:${p.uid}`, f.duration).tone).toBe("high");
  });

  it("dois estados iguais dão uma cena parada", () => {
    const s = sessao();
    s.dispatch({ type: "tick" });
    const f = filmeDaTransicao(s.state, s.state);
    for (const e of frameAt(f, f.duration).entities) {
      expect(e.state.dx).toBe(0);
      expect(e.state.dy).toBe(0);
    }
  });
});
