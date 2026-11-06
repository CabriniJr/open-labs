import { expect, test } from "@playwright/test";

test("host and Kubernetes signals: the gateway looks up the agent's IP; the agent or k8s.pod.ip finds the Pod", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.goto("labs/host-and-kubernetes-signals/");
  const lab = page.getByTestId("nodes-lab");
  await expect(lab).toBeVisible();
  const veredito = lab.getByTestId("nos-veredito");
  await expect(veredito).toContainText("0 / 3");
  await lab.getByRole("radio", { name: "k8sattributes in the agent" }).click();
  await expect(veredito).toContainText("3 / 3");
  await lab.getByRole("radio", { name: "k8sattributes in the gateway" }).click();
  await lab.getByRole("radio", { name: "by k8s.pod.ip" }).click();
  await expect(veredito).toContainText("3 / 3");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(erros).toEqual([]);
});

test("host and Kubernetes signals: the showcase in the gateway ends with no pod names", async ({ page }) => {
  await page.goto("labs/host-and-kubernetes-signals/#showcase");
  const vit = page.getByTestId("nodes-showcase");
  await expect(vit).toBeVisible();
  await vit.getByRole("radio", { name: "in the gateway" }).click();
  await vit.getByRole("button", { name: /what the backend can group by/ }).click();
  await vit.getByRole("button", { name: "Pause" }).click();
  await expect(vit.locator(".cpuvit-linhas")).toContainText("spans with pod name0 / 3");
});
