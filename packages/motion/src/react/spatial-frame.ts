import type { SpatialScene, SpatialNode, SpatialPath, SpatialMarker } from "@ovh/depth-ui";
import type { Film } from "../choreography.js";
import type { Frame } from "../frame.js";
import { poseAt } from "../geometry.js";

/** Presentation adapter only: geometry and progress are sampled from the frame. */
export function spatialFromFrame<D>(film: Film<D>, frame: Frame<D>): SpatialScene {
  const nodes: SpatialNode[] = [], paths: SpatialPath[] = [], markers: SpatialMarker[] = [];
  for (const { spec, state } of frame.entities) {
    const opacity = state.opacity * (1 - .72 * state.dim);
    if (opacity < .005) continue;
    const common = { id: spec.id, label: state.label, tone: state.tone, opacity };
    if (spec.type === "node" || spec.type === "region" || spec.type === "bar" || spec.type === "lane" || spec.type === "custom") {
      const box = spec.type === "lane" ? spec.head : spec.box;
      let w = box.w * state.scale, h = box.h * state.scale;
      if (spec.type === "bar") { if (spec.grow === "right") w *= state.progress; else h *= state.progress; }
      nodes.push({ ...common, x: box.x + state.dx + (box.w - box.w * state.scale) / 2, y: box.y + state.dy + (box.h - box.h * state.scale) / 2, w, h, sublabel: state.sublabel, elevation: spec.type === "region" ? 2 : spec.type === "bar" ? 10 : 28, active: state.glow > .05 });
      if (spec.type === "lane") paths.push({ id: `${spec.id}:life`, tone: state.tone, opacity, dashed: true, points: [{ x: box.x + box.w / 2 + state.dx, y: box.y + box.h + state.dy }, { x: box.x + box.w / 2 + state.dx, y: box.y + box.h + state.dy + (spec.bottom - box.y - box.h - state.dy) * state.progress }] });
    } else if (spec.type === "link") {
      paths.push({ ...common, label: state.progress > .86 ? state.label : "", dashed: spec.dashed, arrow: spec.arrow, points: Array.from({ length: 33 }, (_, i) => { const p = poseAt(spec.path, state.progress * i / 32); return { x: p.x + state.dx, y: p.y + state.dy, z: 8 }; }) });
    } else if (spec.type === "token") {
      const p = poseAt(spec.path, state.progress);
      markers.push({ ...common, x: p.x + state.dx, y: p.y + state.dy, z: 18 });
    } else if (spec.type === "note") {
      markers.push({ ...common, x: spec.at.x + state.dx, y: spec.at.y + state.dy, z: 2 });
    }
  }
  return { width: film.width, height: film.height, nodes, paths, markers };
}
