import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { assessmentDigest, ATTEMPT_API_VERSION, readAssessments, reviewIsCurrent } from "@ovh/handbook-format/contract";

const bank = readAssessments(JSON.parse(readFileSync(new URL("../../../handbooks/kubernetes/assessments.json", import.meta.url), "utf8")));
const question = (player: Locator, id: string) => player.locator(`[data-question-id="${id}"]`);
async function openPlayer(page: Page, route: string) {
  await page.goto(route); const player = page.getByTestId("assessment-player"); await player.scrollIntoViewIfNeeded();
  await expect(player).toHaveAttribute("data-hydrated", "true"); return player;
}
async function match(player: Locator, desktop: boolean) {
  const q = question(player, "who-does-what");
  await q.scrollIntoViewIfNeeded();
  if (desktop) await q.locator(".assessment-drag-item").filter({ hasText: "Creates a replacement" }).dragTo(q.getByLabel("Drop target: ReplicaSet controller", { exact: true }));
  else await q.getByLabel("Match: Creates a replacement to maintain the replica count", { exact: true }).selectOption("controller");
  await expect(q.getByLabel("Match: Creates a replacement to maintain the replica count", { exact: true })).toHaveValue("controller");
  await q.getByLabel("Match: Selects a node for a new unscheduled Pod", { exact: true }).selectOption("scheduler");
  await q.getByLabel("Match: Ensures the container starts on the assigned node", { exact: true }).selectOption("kubelet");
}
async function downloadBytes(download: import("@playwright/test").Download) { const chunks: Buffer[] = []; const stream = await download.createReadStream(); if (!stream) throw new Error("No report stream"); for await (const chunk of stream) chunks.push(Buffer.from(chunk)); return Buffer.concat(chunks); }

test("checkpoint revela resoluções depois da entrega, trava respostas e mantém tentativas distintas", async ({ page }, info) => {
  const player = await openPlayer(page, "labs/pod-lifecycle/");
  await expect(player.getByRole("heading", { name: "Why this answer", exact: true })).toHaveCount(0);
  await question(player, "restart-identity").getByLabel("Every container restart creates a new Pod UID.", { exact: true }).check();
  await match(player, info.project.name === "desktop");
  await question(player, "does-this-pod-fit").getByLabel("It remains Pending because neither node can fit the CPU request.", { exact: true }).check();
  await player.getByRole("button", { name: "Submit assessment", exact: true }).click();
  await expect(player.getByRole("heading", { name: "Grade 8.57 / 10", exact: true })).toBeVisible();
  await expect(player.getByRole("heading", { name: "Why this answer", exact: true })).toHaveCount(3);
  await expect(question(player, "restart-identity")).toContainText("This confuses a container restart with replacement of the Pod object.");
  await expect(question(player, "restart-identity").getByLabel("The Pod keeps its UID.", { exact: true })).toBeDisabled();
  const pending = page.waitForEvent("download"); await player.getByRole("button", { name: "Download attempt report", exact: true }).click();
  const report = JSON.parse((await downloadBytes(await pending)).toString()); expect(report.apiVersion).toBe(ATTEMPT_API_VERSION); expect(report.bank.digest).toBe(assessmentDigest(bank));
  await page.reload(); const restored = page.getByTestId("assessment-player"); await restored.scrollIntoViewIfNeeded(); await expect(restored.getByRole("heading", { name: "Grade 8.57 / 10", exact: true })).toBeVisible();
  await restored.getByRole("button", { name: "Start a new attempt", exact: true }).click();
  await expect(restored.getByRole("heading", { name: "Why this answer", exact: true })).toHaveCount(0);
  await expect(restored.getByText("Attempt history · 1 saved locally", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test("simulado final aceita cinco tipos, ordenação acessível e dá nota por objetivo", async ({ page }, info) => {
  const player = await openPlayer(page, "handbooks/kubernetes/#assessment");
  await question(player, "restart-identity").getByLabel("The Pod keeps its UID.", { exact: true }).check();
  const multiple = question(player, "requests-and-limits");
  await multiple.getByLabel("CPU and memory requests are used for placement.", { exact: true }).check();
  await multiple.getByLabel("Exceeding a memory limit can cause the container to be OOM-killed.", { exact: true }).check();
  const ordering = question(player, "startup-sequence");
  if (info.project.name === "desktop") await ordering.locator("li").filter({ hasText: "ReplicaSet creates the Pod object" }).dragTo(ordering.locator("li").filter({ hasText: "Pod becomes Ready in the lab" }));
  else await ordering.getByRole("button", { name: "Move ReplicaSet creates the Pod object up", exact: true }).click();
  await ordering.getByRole("button", { name: "Move Scheduler binds the Pod to a node up", exact: true }).click();
  await ordering.getByRole("button", { name: "Move Scheduler binds the Pod to a node up", exact: true }).click();
  await ordering.getByRole("button", { name: "Move Kubelet starts the container up", exact: true }).click();
  await match(player, info.project.name === "desktop");
  await question(player, "does-this-pod-fit").getByLabel("It remains Pending because neither node can fit the CPU request.", { exact: true }).check();
  await question(player, "delete-owned-pod").getByLabel("A replacement Pod appears with a new UID.", { exact: true }).check();
  await question(player, "memory-pressure").getByLabel("The container is OOM-killed and may restart inside the same Pod.", { exact: true }).check();
  await player.getByRole("button", { name: "Submit assessment", exact: true }).click();
  await expect(player.getByRole("heading", { name: "Grade 10 / 10", exact: true })).toBeVisible();
  await expect(player.locator(".assessment-objectives li")).toHaveCount(4);
  await expect(player.locator(".assessment-resolution")).toHaveCount(7);
  await expect(player.getByRole("region", { name: "Assessment result", exact: true })).toContainText("7 correct");
});

test("educador registra revisão vinculada ao conteúdo e recalcula relatório do banco exato", async ({ page }) => {
  await page.goto("studio/"); await expect(page.getByTestId("handbook-studio")).toHaveAttribute("data-hydrated", "true");
  await page.getByRole("button", { name: "Assessments", exact: true }).click();
  const panel = page.getByRole("region", { name: "Assessment authoring and educator review", exact: true });
  await panel.getByLabel("Educator name", { exact: true }).fill("Browser educator fixture");
  await panel.getByLabel("Review notes", { exact: true }).fill("Checked explanations and primary source attribution for this test fixture.");
  for (const checkbox of await panel.getByRole("checkbox").all()) await checkbox.check();
  await panel.getByRole("button", { name: "Approve this question", exact: true }).click();
  await panel.getByRole("button", { name: "Edit assessments.json", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Edit assessments.json", exact: true });
  const approved = readAssessments(JSON.parse(await editor.inputValue())); expect(reviewIsCurrent(approved.questions[0]!, approved)).toBe(true);
  approved.questions[0]!.points += 1; approved.version = "0.2.0";
  await editor.fill(JSON.stringify(approved, null, 2));
  await expect(page.getByRole("region", { name: "Validation diagnostics", exact: true })).toContainText("approval is stale");
  await expect(page.getByRole("button", { name: "Export bundle", exact: true })).toBeDisabled();
  for (const checkbox of await panel.getByRole("checkbox").all()) await checkbox.check();
  await panel.getByRole("button", { name: "Approve this question", exact: true }).click();
  await expect(page.getByRole("button", { name: "Export bundle", exact: true })).toBeEnabled();
  const current = readAssessments(JSON.parse(await editor.inputValue()));
  const attempt = { apiVersion: ATTEMPT_API_VERSION, id: "19a5523f-fc21-4e77-a7ab-84d56880d04e", bank: { id: current.id, version: current.version, digest: assessmentDigest(current) }, assessment: "kubernetes-final", startedAt: "2026-10-19T12:00:00.000Z", submittedAt: "2026-10-19T12:01:00.000Z", answers: Object.fromEntries(current.questions.map((q) => [q.id, q.type === "matching" ? Object.fromEntries(q.items.map((i) => [i.id, i.target])) : q.correct])) };
  await panel.getByLabel("Open attempt report file", { exact: true }).setInputFiles({ name: "attempt.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(attempt)) });
  await expect(panel.getByRole("region", { name: "Recomputed attempt result", exact: true })).toContainText("10.00 / 10");
  await panel.getByLabel("Open attempt report file", { exact: true }).setInputFiles({ name: "wrong-version.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ ...attempt, bank: { ...attempt.bank, version: "0.0.0" } })) });
  await expect(panel.getByRole("status")).toContainText("original bank version");
});
