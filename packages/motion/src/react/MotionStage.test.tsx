import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { film } from "../choreography.js";
import { line, pt } from "../geometry.js";
import { MotionStage } from "./MotionStage.js";

afterEach(cleanup);

const GLIFO = { paths: ["M4 12h16"] };

function filme(icone: boolean) {
  const f = film<null>({ width: 400, height: 200 });
  f.add({ type: "token", id: "m", path: line(pt(20, 100), pt(380, 100)), label: "msg", sublabel: "header", ...(icone ? { icon: GLIFO } : {}) });
  f.chapter({ id: "um", title: "Um", body: "" }, (d) => d.send("m", { dur: 800 }));
  return f.build();
}

describe("MotionStage — a ficha", () => {
  it("abre o cabeçalho da etiqueta com o ícone do papel, quando a peça tem um", () => {
    const { container } = render(<MotionStage film={filme(true)} t={400} label="s" />);
    expect(container.querySelector(".mo-token .mo-token__icon path")?.getAttribute("d")).toBe("M4 12h16");
  });

  it("sem ícone, a etiqueta continua só texto", () => {
    const { container } = render(<MotionStage film={filme(false)} t={400} label="s" />);
    expect(container.querySelector(".mo-token")).not.toBeNull();
    expect(container.querySelector(".mo-token__icon")).toBeNull();
  });
});
