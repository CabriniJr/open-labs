import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assembleDelivery, checkDelivery, checkInstalledDelivery, hashBytes, LabDescriptorSchema, readDelivery, VersionSchema } from "./delivery.js";
import type { HostTemplate } from "./delivery.js";
import { lerPacote } from "./bundle.js";

const original = JSON.parse(readFileSync(new URL("./conformance/bundle-v1.json", import.meta.url), "utf8"));
const read = lerPacote(original); if (!read.ok) throw new Error(read.errors.join("\n"));
const bundle = read.value;
const state = LabDescriptorSchema.parse({ apiVersion: "openlabs/lab/v1", id: "pod-lifecycle", version: "0.1.0", title: "Pod lifecycle", href: "labs/pod-lifecycle", interaction: { kind: "state", model: "pods", runtime: { id: "events", version: "1.0.0" } } });
const host = { id: "test-host", version: "1.0.0", interactions: ["state" as const], runtimes: [{ id: "events", version: "1.0.0" }] };
const source = new TextEncoder().encode("reviewed code");
async function template(): Promise<HostTemplate> { return { apiVersion: "openlabs/host-template/v1", host, labs: [state], files: await Promise.all(["index.html", "serve.mjs"].map(async (path) => ({ path, sha256: await hashBytes(source) }))) }; }

describe("os contratos de interação têm fronteiras próprias", () => {
  it("exige versões explícitas e sufixos prerelease válidos", () => {
    for (const version of ["0.0.0", "1.2.3", "0.1.0-alpha.3", "1.0.0-0"]) expect(VersionSchema.safeParse(version).success).toBe(true);
    for (const version of ["latest", "^1.0.0", "01.0.0", "1.0.0-01", "1.0.0-..", "../1.0.0"]) expect(VersionSchema.safeParse(version).success).toBe(false);
  });
  it("flow exige o .mmd canônico e não aceita convertê-lo em visualização", () => {
    const flow = { ...state, interaction: { kind: "flow", model: "pipeline", runtime: { id: "flow", version: "1.0.0" }, structure: { format: "openlabs/mermaid-skeleton/v1", source: "contracts/pipeline.mmd" } } };
    expect(LabDescriptorSchema.safeParse(flow).success).toBe(true);
    expect(LabDescriptorSchema.safeParse({ ...flow, interaction: { ...flow.interaction, structure: undefined } }).success).toBe(false);
    expect(LabDescriptorSchema.safeParse({ ...flow, interaction: { ...flow.interaction, structure: { ...flow.interaction.structure, source: "diagram.svg" } } }).success).toBe(false);
  });
  it("state não aceita estrutura de fluxo e direct não exige runtime", () => {
    expect(LabDescriptorSchema.safeParse(state).success).toBe(true);
    expect(LabDescriptorSchema.safeParse({ ...state, interaction: { ...state.interaction, structure: { source: "x.mmd" } } }).success).toBe(false);
    expect(LabDescriptorSchema.safeParse({ ...state, interaction: { kind: "direct", model: "multiplication" } }).success).toBe(true);
  });
  it("um href sozinho não instala um lab e versão de runtime incompatível recusa", () => {
    expect(checkDelivery(bundle, [], host).errors.join(" ")).toContain("Host implementation required");
    expect(checkDelivery(bundle, [state], { ...host, runtimes: [{ id: "events", version: "2.0.0" }] }).errors.join(" ")).toContain("events@1.0.0");
    expect(checkDelivery(bundle, [state, state], host).errors.join(" ")).toContain("Duplicate lab");
  });
  it("SHA-256 usa o vetor conhecido e os bytes exatos", async () => {
    expect(await hashBytes(new TextEncoder().encode("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it("monta entrega de conteúdo e código e verifica a mesma no host", async () => {
    const t = await template(); const result = await assembleDelivery({ bundle, version: "0.2.0", template: t, load: async () => source });
    expect(result.release.version).toBe("0.2.0"); expect(result.release.host.version).toBe("1.0.0");
    expect(result.release.files.find((f) => f.path === "handbook.json")?.sha256).toBe(await hashBytes(result.files["handbook.json"]!));
    expect(readDelivery(JSON.parse(new TextDecoder().decode(result.files["release.json"])))).toEqual(result.release);
    expect(checkInstalledDelivery(result.release, bundle, t)).toEqual([]);
    expect(checkInstalledDelivery({ ...result.release, labs: [{ ...state, version: "9.0.0" }] }, bundle, t).join(" ")).toContain("Incompatible lab");
  });
  it("não entrega bytes alterados, caminhos ambíguos ou arquivos duplicados", async () => {
    const t = await template();
    await expect(assembleDelivery({ bundle, version: "0.2.0", template: t, load: async () => new Uint8Array([0]) })).rejects.toThrow(/Integrity/u);
    await expect(assembleDelivery({ bundle, version: "0.2.0", template: { ...t, files: [...t.files, t.files[0]!] }, load: async () => source })).rejects.toThrow(/Duplicate/u);
    await expect(assembleDelivery({ bundle, version: "0.2.0", template: { ...t, files: [{ path: "../escape", sha256: "a".repeat(64) }] }, load: async () => source })).rejects.toThrow(/relative artifact/u);
  });
  it("uma entrega flow não pode omitir seu arquivo estrutural", async () => {
    const t = await template(); const result = await assembleDelivery({ bundle, version: "0.2.0", template: t, load: async () => source });
    const flow = LabDescriptorSchema.parse({ ...state, interaction: { kind: "flow", model: "pipeline", runtime: { id: "flow", version: "1.0.0" }, structure: { format: "openlabs/mermaid-skeleton/v1", source: "contracts/pipeline.mmd" } } });
    expect(() => readDelivery({ ...result.release, labs: [flow] })).toThrow(/canonical Mermaid/u);
  });
});
