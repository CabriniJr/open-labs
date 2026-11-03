import { familyOf } from "@ovh/depth-core";
import type { StageProps } from "./Stage.js";
import type { SpatialScene, SpatialPath, SpatialMarker } from "./spatial.js";

/** Aggregate endpoints by the visible containing part, exactly as the 2D view
 * does. No new edges or activity are introduced by the camera. */
export function spatialFromStage({ tree, view, wires, state, readouts, fills, edgeTicks = 1, tickMs = 700, leituraDaCarga }: StageProps, startedAt?: number): SpatialScene {
  const byId = new Map(view.places.map(p => [p.id, p]));
  const locate = (id: string) => {
    let cursor: string | undefined = id;
    while (cursor !== undefined && cursor !== view.focus) {
      const p = byId.get(cursor); if (p) return p;
      cursor = tree.parent.get(cursor);
    }
    return byId.get(id);
  };
  const center = (p: { x: number; y: number; w: number; h: number }) => ({ x: p.x + p.w / 2, y: p.y + p.h / 2, z: 8 });
  const paths: SpatialPath[] = [];
  const seen = new Set<string>();
  for (const wire of wires) {
    const a = locate(wire.from), b = locate(wire.to);
    if (!a || !b || a.id === b.id) continue;
    const id = `${a.id}:${wire.port}:${b.id}:${wire.line ?? "data"}`;
    if (seen.has(id)) continue; seen.add(id);
    paths.push({ id, points: [center(a), center(b)], tone: wire.line === "control" ? "controller" : "conduit", dashed: wire.line === "control", arrow: true });
  }
  const markers: SpatialMarker[] = [];
  for (const item of state.flight) {
    const a = locate(item.from), b = locate(String(item.to));
    if (!a || !b || a.id === b.id) continue;
    const start = center(a), end = center(b), p = Math.min(1, Math.max(0, (state.tick - item.sent) / Math.max(1, edgeTicks)));
    const next = Math.min(1, p + 1 / Math.max(1, edgeTicks));
    markers.push({ id: item.id, x: start.x + (end.x - start.x) * p, y: start.y + (end.y - start.y) * p, z: 14, next: { x: start.x + (end.x - start.x) * next, y: start.y + (end.y - start.y) * next, z: 14 }, duration: tickMs, label: leituraDaCarga?.(item.message), tone: "live" });
  }
  return { width: view.width, height: view.height, paths, markers, startedAt, nodes: view.places.map(p => {
    const node = tree.byId.get(p.id);
    const family = node ? familyOf(node.kind) : "container";
    return { ...p, label: p.label ?? node?.label ?? p.id, sublabel: readouts?.[p.id], tone: family, frame: family === "container" && !p.collapsed, elevation: family === "container" && !p.collapsed ? 4 : 24, active: (fills?.[p.id] ?? 0) > 0 };
  }) };
}
