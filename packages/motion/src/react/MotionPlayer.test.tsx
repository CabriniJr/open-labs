import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { film } from "../choreography.js";
import { line, pt } from "../geometry.js";
import { MotionPlayer } from "./MotionPlayer.js";

function filme() {
  const f = film<string>({ width: 400, height: 200 });
  f.add({ type: "node", id: "a", box: { x: 10, y: 10, w: 60, h: 30 }, label: "Alpha" });
  f.add({ type: "token", id: "m", path: line(pt(70, 25), pt(300, 25)), hidden: true, label: "msg" });
  f.chapter({ id: "one", title: "First", body: "the first body", detail: "detail one" }, (d) => d.send("m", { dur: 800 }));
  f.chapter({ id: "two", title: "Second", body: "the second body", detail: "detail two" }, (d) => d.glow("a", 1, { dur: 500, wait: true }));
  return f.build();
}

afterEach(cleanup);

describe("MotionPlayer", () => {
  it("draws the stage, lists the chapters and renders the author's detail", () => {
    render(<MotionPlayer film={filme()} label="test stage" renderDetail={(fr) => <p>{fr.detail}</p>} />);
    expect(screen.getByRole("img", { name: "test stage" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /First|Second/ })).toHaveLength(2);
    expect(screen.getByText("detail one")).toBeTruthy();
    expect(screen.getByText("Alpha")).toBeTruthy();
  });

  it("scrubbing moves the narration and the detail to the chapter under the cursor", () => {
    const f = filme();
    render(<MotionPlayer film={f} label="s" renderDetail={(fr) => <p>{fr.detail}</p>} />);
    const range = screen.getByRole("slider", { name: "Timeline" });
    act(() => {
      fireEvent.change(range, { target: { value: String(Math.round(f.chapters[1]!.start + 100)) } });
    });
    expect(screen.getByText("the second body")).toBeTruthy();
    expect(screen.getByText("detail two")).toBeTruthy();
  });

  it("keeps a custom inspector and live header on the same clock as playback", () => {
    const f = filme();
    render(<MotionPlayer film={f} label="s" renderHeader={(fr) => <output aria-label="live context">{fr.detail}</output>}
      renderScreen={(fr) => <section aria-label="inspector">{fr.detail}</section>} />);
    fireEvent.change(screen.getByRole("slider", { name: "Timeline" }), { target: { value: f.chapters[1]!.start + 100 } });
    expect(screen.getByLabelText("live context").textContent).toBe("detail two");
    expect(screen.getByLabelText("inspector").textContent).toBe("detail two");
    expect(screen.queryByRole("img", { name: "s" })).toBeNull();
  });

  it("leaves space on an embedded button to its native action", () => {
    render(<MotionPlayer film={filme()} label="s" controls={<button type="button">Inspect</button>} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Inspect" }), { key: " " });
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
  });
});
