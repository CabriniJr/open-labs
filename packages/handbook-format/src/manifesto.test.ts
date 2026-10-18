import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lerPacote } from "./bundle.js";
import { lerManifesto, serializarManifesto } from "./manifesto.js";

const bundle = JSON.parse(readFileSync(new URL("./conformance/bundle-v1.json", import.meta.url), "utf8"));
describe("o contrato editável sem filesystem", () => {
  it("reconstitui o manifesto do bundle sem perder metadados normalizados", () => {
    const read = lerPacote(bundle); if (!read.ok) throw new Error(read.errors.join("\n"));
    const h = read.value.handbook;
    const rich = { ...h, reference: { title: "A model", author: "An author", where: "A primary source", href: "handbooks/kubernetes/reference", line: "Attribution survives editing." } };
    const result = lerManifesto(serializarManifesto(rich), "browser");
    expect(result.problemas).toEqual([]);
    expect(result.handbook).toEqual(rich);
  });
  it("não troca a versão recebida por uma atual implicitamente", () => {
    const read = lerPacote(bundle); if (!read.ok) throw new Error(read.errors.join("\n"));
    expect(() => serializarManifesto({ ...read.value.handbook, apiVersion: "openlabs/handbook/v99" })).toThrow(/escritor dessa versão/u);
  });
  it("refuta YAML duplicado e mantém o texto de erro para o editor", () => {
    const result = lerManifesto("id: a\nid: b", "handbook.yaml");
    expect(result.handbook).toBeUndefined(); expect(result.problemas.join(" ")).toContain("YAML inválido");
  });
});
