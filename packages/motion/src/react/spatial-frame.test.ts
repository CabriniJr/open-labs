import { expect, it } from "vitest";
import { film } from "../choreography.js";
import { frameAt } from "../frame.js";
import { line, poseAt, pt } from "../geometry.js";
import { spatialFromFrame } from "./spatial-frame.js";

it("spatial messages use the frame's progress, position and visibility", () => {
  const f = film({ width: 400, height: 200 });
  const path = line(pt(40, 80), pt(350, 80));
  f.add({ type: "node", id: "a", box: { x: 10, y: 10, w: 60, h: 30 }, label: "Alpha" });
  f.add({ type: "token", id: "m", path, hidden: true, label: "message" });
  f.chapter({ id: "one", title: "Send", body: "" }, d => d.send("m", { dur: 1000 }));
  const built = f.build();
  expect(spatialFromFrame(built, frameAt(built, 0)).markers).toHaveLength(0);
  const frame = frameAt(built, 500);
  const before = JSON.stringify(frame);
  const spatial = spatialFromFrame(built, frame);
  const message = frame.entities.find(e => e.spec.id === "m")!;
  const at = poseAt(path, message.state.progress);
  expect(spatial.markers?.[0]).toMatchObject({ id: "m", x: at.x, y: at.y, label: "message" });
  expect(spatial.nodes.map(n => n.id)).toEqual(["a"]);
  expect(JSON.stringify(frame)).toBe(before);
});
