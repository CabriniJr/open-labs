import { expect, test } from "@playwright/test";

async function open(page: import("@playwright/test").Page) {
  await page.goto("labs/pod-lifecycle/");
  const lab = page.getByTestId("pod-lifecycle-lab");
  await lab.scrollIntoViewIfNeeded();
  await expect(lab).toHaveAttribute("data-hydrated", "true");
  await expect(lab.getByTestId("ready-count")).toHaveText("2 / 2");
  // Um gesto confirma a interação, além do HTML pré-renderizado.
  await page.getByRole("button", { name: "Next step", exact: true }).click();
  await expect(page.getByTestId("simulation-time")).toHaveText("t = 4s");
  return lab;
}

async function step(page: import("@playwright/test").Page, n: number) {
  for (let i = 0; i < n; i++) await page.getByRole("button", { name: "Next step", exact: true }).click();
}

async function load(page: import("@playwright/test").Page, id: string) {
  await page.getByLabel("Experiment", { exact: true }).selectOption(id);
  await page.getByRole("button", { name: "Load experiment", exact: true }).click();
}

test("o handbook abre o lab e o manifesto escala as réplicas observadas", async ({ page }) => {
  await page.goto("handbooks/kubernetes/");
  await page.getByRole("link", { name: "A manifest, a Pod, and the controller that replaces it", exact: true }).click();
  await expect(page).toHaveURL(/\/labs\/pod-lifecycle\/?$/);
  await open(page);
  const editor = page.getByLabel("Kubernetes manifest");
  await editor.fill((await editor.inputValue()).replace("replicas: 2", "replicas: 6"));
  await expect(page.getByText("Unapplied changes", { exact: true })).toBeVisible();
  await expect(page.getByTestId("ready-count")).toHaveText("2 / 2");
  await page.getByRole("button", { name: "Apply manifest", exact: true }).click();
  await step(page, 3);
  await expect(page.getByTestId("ready-count")).toHaveText("6 / 6");
  await expect(page.getByTestId("cpu-available")).toHaveText("1000 m");
  await expect(page.locator(".dui-stage")).toHaveCount(0);
});

test("requests sem encaixe ficam Pending mesmo com capacidade total livre", async ({ page }) => {
  await open(page); await load(page, "pending"); await step(page, 3);
  await expect(page.getByTestId("pending-count")).toHaveText("2");
  await expect(page.getByTestId("cpu-available")).toHaveText("4000 m");
  await expect(page.getByLabel("Pod inspector")).toContainText("cannot be combined");
});

test("OOM reinicia o container mantendo o UID, e menor carga permite recuperar", async ({ page }) => {
  await open(page); await load(page, "oom"); await step(page, 2);
  await expect(page.getByLabel("Pod inspector")).toContainText("OOMKilled");
  const first = page.locator("[data-pod]").first();
  const uid = await first.getAttribute("data-pod");
  await page.getByLabel("Memory working set", { exact: true }).fill("96");
  await step(page, 5);
  await expect(page.getByTestId("ready-count")).toHaveText("2 / 2");
  await expect(page.getByTestId("restart-count")).toHaveText("1");
  await expect(first).toHaveAttribute("data-pod", uid!);
});

test("um Pod sem dono não reaparece após exclusão", async ({ page }) => {
  await open(page); await load(page, "pod"); await step(page, 3);
  await page.getByRole("button", { name: "Delete selected Pod", exact: true }).click();
  await step(page, 5);
  await expect(page.locator("[data-pod]")).toHaveCount(0);
  await expect(page.getByText("Pod deleted. No controller will replace it.", { exact: true })).toBeVisible();
});

test("manifesto inválido não apaga Pods nem reservas e o histórico volta ao estado anterior", async ({ page }) => {
  await open(page);
  const editor = page.getByLabel("Kubernetes manifest");
  const valid = await editor.inputValue();
  await editor.fill("kind: [broken");
  await page.getByRole("button", { name: "Apply manifest", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Cannot apply");
  await expect(page.getByTestId("ready-count")).toHaveText("2 / 2");
  await expect(page.getByTestId("cpu-available")).toHaveText("3000 m");
  await editor.fill(valid.replace("replicas: 2", "replicas: 0"));
  await page.getByRole("button", { name: "Apply manifest", exact: true }).click();
  await step(page, 4);
  await expect(page.getByTestId("cpu-available")).toHaveText("4000 m");
  await expect(page.locator(".podlab-health")).toHaveText("● Healthy");
  await page.getByLabel("History step", { exact: true }).fill("5");
  await expect(page.getByTestId("ready-count")).toHaveText("2 / 2");
  await expect(editor).toHaveValue(valid);
});

test("o grafo rola dentro do lab, os downloads existem e a página cabe no viewport", async ({ page }) => {
  await open(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole("button", { name: "Apply manifest", exact: true })).toBeVisible();
  const link = page.getByRole("link", { name: "Download Deployment →", exact: true });
  const response = await page.request.get((await link.getAttribute("href"))!);
  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain("kind: Deployment");
  await page.getByLabel("Kubernetes manifest").focus();
  await expect(page.getByLabel("Kubernetes manifest")).toBeFocused();
});
