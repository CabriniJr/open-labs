import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readAssessments } from "@ovh/handbook-format/contract";
import { AssessmentPlayer } from "./AssessmentPlayer.js";

const bank = readAssessments(JSON.parse(readFileSync(resolve("packages/handbook-format/src/conformance/assessment-set-v1.json"), "utf8")));
beforeEach(() => localStorage.clear()); afterEach(cleanup);

it("o gabarito só entra no resultado após entregar; respostas são travadas e uma tentativa nova preserva o histórico", () => {
  render(<AssessmentPlayer bank={bank} assessmentId="pod-lifecycle-checkpoint" />);
  expect(screen.queryByText("Why this answer")).toBeNull();
  fireEvent.click(screen.getByLabelText("The Pod keeps its UID."));
  fireEvent.click(screen.getByRole("button", { name: "Submit assessment" }));
  expect(screen.queryByRole("region", { name: "Assessment result" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Submit with 2 incomplete" }));
  const result = screen.getByRole("region", { name: "Assessment result" });
  expect(within(result).getByText("Grade 1.43 / 10")).toBeTruthy();
  expect(screen.getAllByText("Why this answer")).toHaveLength(3);
  expect((screen.getByLabelText("The Pod keeps its UID.") as HTMLInputElement).disabled || (screen.getByLabelText("The Pod keeps its UID.").closest("fieldset") as HTMLFieldSetElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Start a new attempt" }));
  expect(screen.queryByText("Why this answer")).toBeNull();
  expect(screen.getByText("Attempt history · 1 saved locally")).toBeTruthy();
  expect((screen.getByLabelText("The Pod keeps its UID.") as HTMLInputElement).checked).toBe(false);
});

it("uma mudança de banco nunca restaura respostas ou resultado da versão anterior", () => {
  const { rerender } = render(<AssessmentPlayer bank={bank} assessmentId="pod-lifecycle-checkpoint" />);
  fireEvent.click(screen.getByLabelText("The Pod keeps its UID."));
  rerender(<AssessmentPlayer bank={{ ...bank, version: "0.2.0" }} assessmentId="pod-lifecycle-checkpoint" />);
  expect((screen.getByLabelText("The Pod keeps its UID.") as HTMLInputElement).checked).toBe(false);
  expect(screen.queryByRole("region", { name: "Assessment result" })).toBeNull();
});
