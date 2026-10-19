import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { strFromU8, unzipSync } from "fflate";

const original = JSON.parse(readFileSync(new URL("../../../packages/handbook-format/src/conformance/bundle-v1.json", import.meta.url), "utf8"));
async function open(page: import("@playwright/test").Page) {
  await page.goto("studio/");
  await expect(page.getByTestId("handbook-studio")).toHaveAttribute("data-hydrated", "true");
  await expect(page.getByRole("button", { name: "Export bundle" })).toBeEnabled();
}
async function downloaded(download: import("@playwright/test").Download): Promise<Buffer> {
  const stream = await download.createReadStream();
  if (!stream) throw new Error("Download has no stream");
  const chunks: Buffer[] = []; for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
async function importBundle(page: import("@playwright/test").Page, bundle = original) {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Open project", exact: true }).click();
  await (await chooser).setFiles({ name: "handbook.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(bundle)) });
}

test("edita o currículo e exporta o mesmo bundle consumido pelo SDK", async ({ page }) => {
  await page.goto("handbooks/");
  await page.getByRole("navigation", { name: "Main", exact: true }).getByRole("link", { name: "Studio", exact: true }).click();
  await expect(page.getByTestId("handbook-studio")).toHaveAttribute("data-hydrated", "true");
  const editor = page.getByRole("textbox", { name: "Edit handbook.yaml", exact: true });
  await editor.fill((await editor.inputValue()).replace("Kubernetes Visual Handbook", "Kubernetes at Work"));
  await expect(page.getByRole("region", { name: "Handbook preview" }).getByRole("heading", { name: "Kubernetes at Work", exact: true })).toBeVisible();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export bundle" }).click();
  const result = JSON.parse((await downloaded(await pending)).toString());
  expect(result.bundleVersion).toBe("openlabs/bundle/v2");
  expect(result.assessments.apiVersion).toBe("openlabs/assessment-set/v1");
  expect(result.handbook.name).toBe("Kubernetes at Work");
  expect(result.articles[0].markdown).toContain("#src-resources");
  await importBundle(page, result);
  await expect(editor).toHaveValue(/Kubernetes at Work/);
});

test("recupera texto inválido no reload e permite baixar fontes sem liberar export", async ({ page }) => {
  await open(page);
  await page.getByRole("textbox", { name: "Edit handbook.yaml", exact: true }).fill("id: [unfinished");
  await expect(page.getByRole("button", { name: "Export bundle" })).toBeDisabled();
  await expect(page.getByRole("region", { name: "Validation diagnostics" })).toContainText("Invalid YAML");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("openlabs-studio-project-v1"))).toContain("unfinished");
  await page.reload();
  await expect(page.getByTestId("handbook-studio")).toHaveAttribute("data-hydrated", "true");
  await expect(page.getByRole("textbox", { name: "Edit handbook.yaml", exact: true })).toHaveValue("id: [unfinished");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download sources", exact: true }).click();
  const bytes = await downloaded(await pending);
  expect(strFromU8(unzipSync(bytes)["handbook.yaml"]!)).toBe("id: [unfinished");
  await page.getByRole("button", { name: "Kubernetes example", exact: true }).click();
  await page.getByLabel("Open project file", { exact: true }).setInputFiles({ name: "draft.zip", mimeType: "application/zip", buffer: bytes });
  await expect(page.getByRole("textbox", { name: "Edit handbook.yaml", exact: true })).toHaveValue("id: [unfinished");
});

test("uma importação recusada preserva o projeto e o anterior pode ser restaurado", async ({ page }) => {
  await open(page);
  const editor = page.getByRole("textbox", { name: "Edit handbook.yaml", exact: true });
  const text = await editor.inputValue();
  await importBundle(page, { ...original, bundleVersion: "openlabs/bundle/v99" });
  await expect(page.getByRole("alert")).toContainText("bundleVersion");
  await expect(editor).toHaveValue(text);
  const changed = structuredClone(original); changed.handbook.name = "Private training";
  await importBundle(page, changed);
  await expect(editor).toHaveValue(/Private training/);
  await page.getByRole("button", { name: "Restore previous", exact: true }).click();
  await expect(editor).toHaveValue(text);
});

test("cria um handbook, rascunha artigo sem fontes fictícias e prepara um brief", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "New handbook", exact: true }).click();
  await page.getByLabel("Handbook id", { exact: true }).fill("networking");
  await page.getByLabel("Maintainer name", { exact: true }).fill("Training Team");
  await page.getByLabel("GitHub handle", { exact: true }).fill("octocat");
  await page.getByRole("button", { name: "Create handbook", exact: true }).click();
  await expect(page.getByRole("button", { name: "Export bundle" })).toBeEnabled();
  await page.getByRole("button", { name: "Draft article +", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Edit articles/the-first-article.md", exact: true })).toHaveValue(/sources: \[\]/);
  await expect(page.getByRole("button", { name: "Export bundle" })).toBeDisabled();
  await page.getByRole("button", { name: "AI brief", exact: true }).click();
  await page.getByLabel("What should the assistant help with?", { exact: true }).fill("Teach packet routing with primary sources.");
  const brief = page.getByRole("textbox", { name: "Prepared AI brief", exact: true });
  await expect(brief).toHaveValue(/Teach packet routing with primary sources\./);
  await expect(brief).toHaveValue(/the-first-article\.md/);
  await expect(brief).toHaveValue(/Current diagnostics/);
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download AI brief", exact: true }).click();
  expect((await downloaded(await pending)).toString()).toContain("Teach packet routing");
});

test("a prévia remove scripts, imagens e URLs executáveis e mantém o deeper", async ({ page }) => {
  await open(page);
  const file = page.getByRole("complementary", { name: "Project files" }).getByRole("button", { name: /a-pod-is-not-its-container\.md/ });
  await file.click();
  const editor = page.getByRole("textbox", { name: "Edit articles/a-pod-is-not-its-container.md", exact: true });
  await editor.fill((await editor.inputValue()) + '\n<img src=x onerror="window.studioXss=true"><script>window.studioXss=true</script>\n[bad](javascript:alert(1))\n');
  await expect(page.locator(".studio-markdown details summary")).toContainText("scheduled Pod");
  expect(await page.evaluate(() => (window as unknown as { studioXss?: boolean }).studioXss)).toBeUndefined();
  await expect(page.locator(".studio-markdown script, .studio-markdown img, .studio-markdown a[href^='javascript:']")).toHaveCount(0);
  await page.locator(".studio-markdown summary").click();
  await expect(page.locator(".studio-markdown details")).toHaveAttribute("open", "");
});

test("labs desconhecidos ficam como requisito e a página cabe em tela estreita", async ({ page }) => {
  await open(page);
  const foreign = structuredClone(original);
  foreign.handbook.labs[0].href = "labs/private-workshop";
  foreign.articles[0].markdown = foreign.articles[0].markdown.replace("lab: labs/pod-lifecycle", "lab: labs/private-workshop");
  await importBundle(page, foreign);
  await expect(page.getByText("Host implementation required", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open installed lab ↗", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.getByRole("textbox", { name: "Edit handbook.yaml", exact: true }).focus();
  await expect(page.getByRole("textbox", { name: "Edit handbook.yaml", exact: true })).toBeFocused();
});

test("armazenamento bloqueado deixa a edição e o download disponíveis", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(Storage.prototype, "setItem", { value: () => { throw new Error("Blocked"); } }); });
  await open(page);
  await expect(page.getByText("Download sources to keep a copy", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download sources", exact: true })).toBeEnabled();
  await page.getByRole("textbox", { name: "Edit handbook.yaml", exact: true }).fill("invalid: [");
  await expect(page.getByRole("region", { name: "Validation diagnostics" })).toContainText("Invalid YAML");
});
