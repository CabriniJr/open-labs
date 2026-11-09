import { expect, test } from "@playwright/test";

test("network: the showcase opens first and its chapters follow the switches", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.goto("labs/telecentro-network/");
  const vit = page.getByTestId("network-showcase");
  await expect(vit).toBeVisible();
  await expect(vit.getByRole("button", { name: /ACL: the staff room is closed/ })).toBeVisible();
  await vit.getByText("ACL on the Wi-Fi").click();
  await expect(vit.getByRole("button", { name: /No ACL: the Wi-Fi walks into the staff room/ })).toBeVisible();
  await vit.getByText("NAT to the ISP").click();
  await expect(vit.getByRole("button", { name: /No NAT: the reply has nowhere to go/ })).toBeVisible();
  await expect(vit.getByText(/In Cisco Packet Tracer/).first()).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(erros).toEqual([]);
});

test("network: the simulation shows the verdict the model gives, and the matching Packet Tracer output", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.goto("labs/telecentro-network/");
  await page.getByRole("tab", { name: /Simulation/ }).click();
  const sim = page.getByTestId("network-simulation");
  await expect(sim).toBeVisible();

  // Wi-Fi → staff PC, ping: dropped at R1 by line 10.
  await expect(sim.getByRole("status")).toContainText("Dropped by the ACL on the way in");
  await expect(sim).toContainText("Destination host unreachable.");

  await sim.getByText("ACL on the Wi-Fi").click();
  await expect(sim.getByRole("status")).toContainText("Delivered");

  // The course material is generated from the same model.
  await sim.getByRole("radio", { name: "R1 config" }).click();
  await expect(sim).toContainText("encapsulation dot1Q 20");
  await sim.getByRole("radio", { name: "Addressing plan" }).click();
  await expect(sim).toContainText("192.168.10.0/25");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(erros).toEqual([]);
});
