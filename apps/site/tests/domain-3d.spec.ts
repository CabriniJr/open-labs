import { expect, test, type Page } from "@playwright/test";

test.setTimeout(60_000);
async function hydrated(page: Page, selector: string) {
  const island = page.locator(`astro-island:has(${selector})`).first();
  await island.scrollIntoViewIfNeeded();
  await expect(island).not.toHaveAttribute("ssr", /.*/, { timeout: 20_000 });
}
async function capture(page: Page, file: string) {
  await page.screenshot({ path: file, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

test("Kubernetes 3D uses the actual nodes and Pods, keeps selection and does not advance the model clock", async ({ page }, info) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(String(error)));
  await page.goto("handbooks/kubernetes/");
  await page.getByRole("region", { name: "3D experiments" }).getByRole("link").click();
  await expect(page).toHaveURL(/pod-lifecycle\/\?view=3d#experiment/);
  await hydrated(page, ".podlab");
  const lab = page.getByTestId("pod-lifecycle-lab");
  const stage = lab.locator(".iso-stage");
  await expect(stage).toHaveAttribute("data-ready", "true", { timeout: 20_000 });
  await expect(stage).toHaveAttribute("data-projection", "perspective");
  await expect(stage.locator('[data-entity^="pod:"]')).toHaveCount(2);
  const clock = await lab.getByTestId("simulation-time").textContent();
  const original = await stage.getAttribute("data-camera");
  await stage.focus(); await page.keyboard.press("ArrowRight");
  await expect(stage).not.toHaveAttribute("data-camera", original!);
  await lab.getByRole("button", { name: "Zoom in 3D", exact: true }).click();
  await expect(lab.getByLabel("Camera zoom")).toHaveText("120%");
  await lab.getByRole("button", { name: "Reset camera" }).click();
  await expect(stage).toHaveAttribute("data-camera", original!);
  await expect(lab.getByTestId("simulation-time")).toHaveText(clock!);
  await lab.getByRole("button", { name: "Inspect scene" }).click();
  await lab.locator(".iso-contents").getByRole("button", { name: /^worker-01/ }).click();
  await expect(lab.getByLabel("Resource inspector")).toContainText("1000 / 2000m");
  await lab.getByRole("radio", { name: "Iso", exact: true }).click();
  await expect(stage).toHaveAttribute("data-projection", "orthographic");
  await expect(lab.getByLabel("Resource inspector")).toContainText("worker-01");
  await lab.getByRole("radio", { name: "Tree", exact: true }).click();
  const pod = lab.locator("[data-pod]").first(), uid = await pod.getAttribute("data-pod");
  await pod.click();
  await lab.getByRole("radio", { name: "3D", exact: true }).click();
  await expect(stage.locator(`[data-entity="pod:${uid}"]`)).toHaveAttribute("data-selected", "");
  await capture(page, info.outputPath("kubernetes-selected-pod.png"));
  await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
  await expect(stage.locator(`[data-entity="pod:${uid}"]`)).toHaveAttribute("data-selected", "");
  await capture(page, info.outputPath("kubernetes-dark.png"));
  await lab.getByRole("button", { name: "Delete selected Pod" }).click();
  for (let i = 0; i < 3; i++) await lab.getByRole("button", { name: "Next step", exact: true }).click();
  await expect(stage.locator(`[data-entity="pod:${uid}"]`)).toHaveCount(0);
  await expect(lab.getByTestId("ready-count")).toHaveText("2 / 2");
  expect(errors).toEqual([]);
});

test("Kubernetes pending and restart states stay inspectable in 3D", async ({ page }) => {
  await page.goto("labs/pod-lifecycle/?view=3d#experiment");
  await hydrated(page, ".podlab");
  const lab = page.getByTestId("pod-lifecycle-lab");
  await expect(lab.locator(".iso-stage")).toHaveAttribute("data-ready", "true", { timeout: 20_000 });
  await lab.getByLabel("Experiment", { exact: true }).selectOption("pending");
  await lab.getByRole("button", { name: "Load experiment" }).click();
  await lab.getByRole("button", { name: "Next step", exact: true }).click();
  await expect(lab.getByTestId("pending-count")).toHaveText("2");
  await lab.getByRole("button", { name: "Inspect scene" }).click();
  await lab.locator(".iso-contents").getByRole("button", { name: "pending", exact: true }).click();
  await expect(lab.getByLabel("Resource inspector")).toContainText("4000m");
  await lab.getByLabel("Experiment", { exact: true }).selectOption("oom");
  await lab.getByRole("button", { name: "Load experiment" }).click();
  for (let i = 0; i < 2; i++) await lab.getByRole("button", { name: "Next step", exact: true }).click();
  await expect(lab.getByLabel("Pod inspector")).toContainText("OOMKilled");
  const uid = await lab.locator(".podlab-inspector .podlab-panel-title > span").last().textContent();
  await lab.getByLabel("Memory working set", { exact: true }).fill("96");
  for (let i = 0; i < 5; i++) await lab.getByRole("button", { name: "Next step", exact: true }).click();
  await expect(lab.getByTestId("ready-count")).toHaveText("2 / 2");
  await expect(lab.locator(".podlab-inspector .podlab-panel-title > span").last()).toHaveText(uid!);
  await expect(lab.getByTestId("restart-count")).toHaveText("1");
});

test("OpenTelemetry 3D changes the lens and deployment while keeping trace routing and timeline", async ({ page }, info) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(String(error)));
  await page.goto("labs/agent-or-gateway/?view=3d#experiment");
  await hydrated(page, ".deplab");
  const lab = page.getByTestId("deployment-lab");
  const stage = lab.locator(".iso-stage");
  await expect(stage).toHaveAttribute("data-ready", "true", { timeout: 20_000 });
  const timeline = lab.getByRole("slider", { name: "Timeline" });
  const max = Number(await timeline.getAttribute("max"));
  await timeline.fill(String(Math.round(max * .7 / 10) * 10));
  const time = await timeline.inputValue();
  await lab.getByRole("radio", { name: "Agent + gateway" }).click();
  await lab.getByRole("switch", { name: /Route by trace ID/ }).focus();
  await page.keyboard.press("Space");
  await expect(lab.locator(".deplab-table")).toContainText("works: each trace lands whole");
  await expect(timeline).toHaveValue(time);
  await stage.focus(); await page.keyboard.press("ArrowLeft");
  await expect(timeline).toHaveValue(time);
  await lab.getByRole("radio", { name: "Iso", exact: true }).click();
  await expect(stage).toHaveAttribute("data-projection", "orthographic");
  await expect(timeline).toHaveValue(time);
  await lab.getByRole("button", { name: "Inspect scene" }).click();
  await lab.locator(".iso-contents button").first().click();
  await expect(lab.locator(".mo-selection")).toBeVisible();
  await capture(page, info.outputPath("otel-agent-gateway.png"));
  await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
  await capture(page, info.outputPath("otel-dark.png"));
  await lab.getByRole("radio", { name: "3D", exact: true }).click();
  await expect(stage).toHaveAttribute("data-projection", "perspective");
  await expect(timeline).toHaveValue(time);
  expect(errors).toEqual([]);
});
