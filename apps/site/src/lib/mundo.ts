import { connect, film, line, pt, type Box, type Film } from "@ovh/motion";

/**
 * O mundo da página inicial: os três assuntos do site como ilhas de um mesmo
 * chão, e a câmera indo de uma para a outra. É vitrine, não lab — não há
 * modelo a interrogar aqui —, e por isso mora no site e não num domínio. Cada
 * ilha aponta para o lab de onde a cena saiu.
 */
const B = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });

export const ILHAS = {
  otel: B(40, 50, 560, 300),
  k8s: B(40, 400, 560, 280),
  cpu: B(660, 90, 580, 560),
} as const;

export function filmeDoMundo(): Film<null> {
  const f = film<null>({ width: 1280, height: 720, gap: 200, maxZoom: 2.4 });
  const { otel, k8s, cpu } = ILHAS;

  // ── OpenTelemetry: serviços → Collector → backend ──
  f.add({ type: "region", id: "i:otel", box: otel, label: "OpenTelemetry", tone: "conduit" });
  const S1 = B(otel.x + 30, otel.y + 60, 130, 60);
  const S2 = B(otel.x + 30, otel.y + 190, 130, 60);
  const COL = B(otel.x + 230, otel.y + 100, 130, 110);
  const BACK = B(otel.x + 420, otel.y + 110, 110, 90);
  f.add({ type: "node", id: "o:s1", box: S1, label: "checkout", sublabel: "SDK", tone: "kind-1", shape: "pill" });
  f.add({ type: "node", id: "o:s2", box: S2, label: "payments", sublabel: "SDK", tone: "kind-3", shape: "pill" });
  f.add({ type: "node", id: "o:col", box: COL, label: "Collector", tone: "conduit", shape: "stack" });
  f.add({ type: "node", id: "o:back", box: BACK, label: "backend", tone: "container", shape: "cylinder" });
  const p1 = connect(S1, COL, 8);
  const p2 = connect(S2, COL, 8);
  const p3 = connect(COL, BACK, 8);
  f.add({ type: "link", id: "o:f1", path: p1, tone: "muted", dashed: true });
  f.add({ type: "link", id: "o:f2", path: p2, tone: "muted", dashed: true });
  f.add({ type: "link", id: "o:f3", path: p3, tone: "conduit" });
  for (let i = 0; i < 4; i += 1) {
    f.add({ type: "token", id: `o:t1:${i}`, path: p1, tone: "kind-1", hidden: true, size: 5, label: "OTLP", sublabel: "span" });
    f.add({ type: "token", id: `o:t2:${i}`, path: p2, tone: "kind-3", hidden: true, size: 5, label: "OTLP", sublabel: "span" });
  }
  f.add({ type: "token", id: "o:lote", path: p3, tone: "conduit", hidden: true, size: 6, label: "BATCH", sublabel: "8 spans" });

  // ── Kubernetes: um nó, os Pods em cima dele ──
  f.add({ type: "region", id: "i:k8s", box: k8s, label: "Kubernetes", tone: "processor" });
  const NO = B(k8s.x + 150, k8s.y + 60, 380, 180);
  const CP = B(k8s.x + 25, k8s.y + 100, 100, 90);
  f.add({ type: "node", id: "k:cp", box: CP, label: "scheduler", tone: "controller" });
  f.add({ type: "node", id: "k:no", box: NO, label: "", tone: "container", material: "pcb", height: 8 });
  const vaga = (i: number) => B(NO.x + 20 + (i % 3) * 120, NO.y + 22 + Math.floor(i / 3) * 78, 100, 60);
  for (let i = 0; i < 5; i += 1) f.add({ type: "node", id: `k:pod${i}`, box: vaga(i), label: `pod-${i + 1}`, sublabel: "Running", tone: "conduit", shape: "pill", elevation: 8, hidden: i === 4 });
  f.add({ type: "token", id: "k:agenda", path: line(pt(CP.x + CP.w, CP.y + CP.h / 2), pt(vaga(4).x, vaga(4).y + 30)), tone: "controller", hidden: true, size: 5, label: "BIND", sublabel: "pod-5 → node" });

  // ── CPU: a placa, o encapsulamento, a tampa e o die ──
  f.add({ type: "region", id: "i:cpu", box: cpu, label: "CPU", tone: "kind-4" });
  const PLACA = B(cpu.x + 20, cpu.y + 50, cpu.w - 40, cpu.h - 70);
  const DIMM = B(PLACA.x + 30, PLACA.y + 70, 40, 300);
  const PKG = B(PLACA.x + 170, PLACA.y + 80, 320, 320);
  const DIE = B(PKG.x + 100, PKG.y + 100, 120, 120);
  const TAMPA = B(PKG.x + 24, PKG.y + 24, 272, 272);
  f.add({ type: "node", id: "c:placa", box: PLACA, label: "", tone: "conduit", material: "pcb", height: 5 });
  f.add({ type: "node", id: "c:dimm", box: DIMM, label: "DRAM", tone: "kind-2", shape: "memory", material: "pcb", elevation: 5, height: 26 });
  f.add({ type: "node", id: "c:pkg", box: PKG, label: "", tone: "conduit", material: "pcb", shape: "chip", elevation: 5, height: 5 });
  f.add({ type: "node", id: "c:die", box: DIE, label: "silicon", sublabel: "RV32I", tone: "processor", material: "silicon", elevation: 10, height: 2, hidden: true });
  f.add({ type: "node", id: "c:tampa", box: TAMPA, label: "RV32I", sublabel: "core", tone: "container", material: "metal", elevation: 10, height: 10 });
  const busca = line(pt(DIMM.x + DIMM.w, DIMM.y + 150), pt(PKG.x, PKG.y + 160));
  f.add({ type: "link", id: "c:bus", path: busca, tone: "muted", elevation: 5 });
  f.add({ type: "token", id: "c:fetch", path: busca, tone: "kind-1", hidden: true, size: 5, label: "FETCH", sublabel: "add x3,x1,x2", elevation: 5 });

  f.chapter({ id: "otel", title: "OpenTelemetry", body: "" }, (d) => {
    d.camera({ box: otel }, { dur: 1600 });
    d.stagger([0, 1, 2, 3], 260, (x, i) => {
      x.together((y) => y.send(`o:t1:${i}`, { dur: 900 }), (y) => y.send(`o:t2:${i}`, { dur: 900, delay: 120 }));
    });
    d.glow("o:col", 1).ping("o:col");
    d.send("o:lote", { dur: 1000 });
    d.glow("o:col", 0).ping("o:back").wait(300);
  });
  f.chapter({ id: "k8s", title: "Kubernetes", body: "" }, (d) => {
    d.camera({ box: k8s }, { dur: 1600 });
    d.glow("k:cp", 1).ping("k:cp");
    d.send("k:agenda", { dur: 900 });
    d.show("k:pod4", { dur: 500 }).ping("k:pod4");
    d.set("k:pod1", { tone: "live", sublabel: "OOMKilled" }).ping("k:pod1");
    d.wait(800);
    d.set("k:pod1", { tone: "conduit", sublabel: "Running" }).glow("k:cp", 0).wait(500);
  });
  f.chapter({ id: "cpu", title: "CPU", body: "" }, (d) => {
    d.camera({ box: cpu, elevation: 5 }, { dur: 1600 });
    d.send("c:fetch", { dur: 900 });
    d.show("c:die", { dur: 10 });
    d.to("c:tampa", { lift: 110, opacity: 0 }, { dur: 1500 });
    d.glow("c:die", 1).ping("c:die").wait(900);
    d.to("c:tampa", { lift: 0, opacity: 1 }, { dur: 1200 });
    d.glow("c:die", 0, { dur: 200 });
  });
  f.chapter({ id: "todos", title: "Every subject", body: "" }, (d) => {
    d.camera({ at: { zoom: 1, elev: 0 } }, { dur: 1800 });
    d.set("k:pod4", { opacity: 0 });
    d.wait(1600);
  });
  return f.build();
}
