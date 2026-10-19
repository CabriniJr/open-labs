import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { lerPacote } from "@ovh/handbook-format/contract";
import { aiBrief, draftArticle, exportProject, MAX_PROJECT_BYTES, projectFromBundle, projectFromZip, projectZip, readDraft, saveableDraft, validateProject } from "./studio.js";

const fixture = readFileSync(new URL("../../../../packages/handbook-format/src/conformance/bundle-v1.json", import.meta.url), "utf8");
const project = projectFromBundle(fixture);

describe("o projeto do Studio usa o mesmo contrato do SDK", () => {
  it("edita o bundle antigo e exporta conteúdo que o leitor do SDK aceita", () => {
    const edited = { ...project, manifest: project.manifest.replace("Kubernetes Visual Handbook", "Kubernetes at Work") };
    const result = lerPacote(JSON.parse(exportProject(edited, "2026-10-18")));
    expect(result.ok).toBe(true);
    if (result.ok) { expect(result.value.handbook.name).toBe("Kubernetes at Work"); expect(result.value.articles).toEqual(project.articles); }
  });
  it("um YAML inválido pode ser salvo e transferido como fonte, mas não como release", () => {
    const broken = { ...project, manifest: "spec: [broken" };
    expect(readDraft(saveableDraft(broken))).toEqual(broken);
    expect(projectFromZip(projectZip(broken))).toEqual(broken);
    expect(() => exportProject(broken, "2026-10-18")).toThrow(/diagnostics/u);
  });
  it("o ZIP mantém bytes de fontes e suporta uma pasta envolvente", () => {
    const exact = { ...project, manifest: "# a comment\r\n" + project.manifest.replace(/\n/g, "\r\n") };
    expect(projectFromZip(projectZip(exact))).toEqual(exact);
    const nested = zipSync({ "project/handbook.yaml": strToU8(project.manifest), "project/articles/a-pod-is-not-its-container.md": strToU8(project.articles[0]!.markdown) });
    expect(projectFromZip(nested)).toEqual(project);
  });
  it("o diagnóstico de fonte é associado ao arquivo editável", () => {
    const changed = { ...project, articles: [{ ...project.articles[0]!, markdown: project.articles[0]!.markdown + "\n[claim](#src-invented)" }] };
    expect(validateProject(changed).diagnostics).toContainEqual(expect.objectContaining({ file: "articles/a-pod-is-not-its-container.md", message: expect.stringContaining("invented") }));
  });
  it("mantém avaliações e rascunhos inválidos em fontes, autosave e bundle v2", () => {
    const source = readFileSync(new URL("../../../../packages/handbook-format/src/conformance/assessment-set-v1.json", import.meta.url), "utf8");
    const assessed = { ...project, assessments: source };
    expect(validateProject(assessed).diagnostics).toEqual([]);
    expect(readDraft(saveableDraft(assessed))).toEqual(assessed);
    expect(projectFromZip(projectZip(assessed))).toEqual(assessed);
    const bundle = exportProject(assessed, "2026-10-19");
    expect(JSON.parse(bundle).bundleVersion).toBe("openlabs/bundle/v2");
    expect(validateProject(projectFromBundle(bundle)).assessments).toEqual(JSON.parse(source));
    expect(draftArticle(assessed, "a-rollout-is-not-a-restart").assessments).toBe(source);
    const invalid = { ...assessed, assessments: "{unfinished" };
    expect(projectFromZip(projectZip(invalid)).assessments).toBe("{unfinished");
    expect(validateProject(invalid).diagnostics.some((d) => d.file === "assessments.json")).toBe(true);
    expect(() => exportProject(invalid, "2026-10-19")).toThrow(/diagnostics/u);
    expect(aiBrief(assessed, "Improve assessment distractors")).toContain(JSON.stringify(source));
  });
  it("rascunhar um item atualiza o currículo sem fabricar fontes", () => {
    const drafted = draftArticle(project, "a-rollout-is-not-a-restart");
    const result = validateProject(drafted);
    expect(result.handbook?.articles.find((a) => a.id === "a-rollout-is-not-a-restart")?.status).toBe("available");
    expect(result.diagnostics.some((d) => d.file === "articles/a-rollout-is-not-a-restart.md" && /sources/u.test(d.message))).toBe(true);
    expect(() => exportProject(drafted, "2026-10-18")).toThrow();
    expect(() => draftArticle(project, "a-pod-is-not-its-container")).toThrow();
  });
  it("o briefing leva o objetivo, texto exato e os erros ainda não resolvidos", () => {
    const broken = { ...project, manifest: "id: [unfinished" };
    const brief = aiBrief(broken, "Teach reconciliation before scheduling.");
    expect(brief).toContain("Teach reconciliation before scheduling.");
    expect(brief).toContain("YAML inválido");
    expect(brief).toContain(JSON.stringify(broken.manifest));
    expect(brief).toContain("Mermaid is the structural contract of flow-engine scenarios");
  });
  it("recusa fontes estranhas, caminhos ambíguos e arquivos grandes antes de abrir", () => {
    expect(() => projectFromZip(zipSync({ "handbook.yaml": strToU8("id: x"), "../../x.md": strToU8("x") }))).toThrow(/Unexpected/u);
    expect(() => projectFromZip(zipSync({ "../handbook.yaml": strToU8("id: x") }))).toThrow(/relative/u);
    expect(() => projectFromZip(zipSync({ "a/handbook.yaml": strToU8("x"), "b/handbook.yaml": strToU8("y") }))).toThrow(/exactly one/u);
    expect(() => projectFromZip(zipSync({ "handbook.yaml": new Uint8Array(MAX_PROJECT_BYTES + 1) }))).toThrow(/exceeds/u);
    expect(() => readDraft(JSON.stringify({ draftVersion: 99, project }))).toThrow(/Unrecognized/u);
    expect(() => saveableDraft({ manifest: "x".repeat(MAX_PROJECT_BYTES + 1), articles: [] })).toThrow(/exceeds/u);
  });
});
