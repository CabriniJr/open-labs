import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { criarPacote, labsExigidos, lerPacote } from "./bundle.js";
import { criarManifesto } from "./criar.js";
import { lerManifesto } from "./ler.js";

// An actual export from PR #17, frozen before introducing the bundle reader.
const original = JSON.parse(readFileSync(new URL("./conformance/bundle-v1.json", import.meta.url), "utf8"));
const copy = () => structuredClone(original);
const errors = (doc: unknown) => { const r = lerPacote(doc); expect(r.ok).toBe(false); return r.ok ? "" : r.errors.join(" | "); };

describe("o contrato portátil preserva o export original", () => {
  it("lê o bundle v1 anterior ao SDK, sem migração", () => {
    const r = lerPacote(original);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual(original);
      expect(labsExigidos(r.value)).toEqual([{ id: "pod-lifecycle", href: "labs/pod-lifecycle" }]);
    }
  });
  it("o exportador passa pela mesma validação do consumidor", () => {
    const r = lerPacote(original);
    if (!r.ok) throw new Error(r.errors.join(" "));
    expect(criarPacote(r.value.handbook, r.value.articles, "2026-10-17")).toEqual(original);
    expect(() => criarPacote(r.value.handbook, [], "2026-10-17")).toThrow(/não existe como arquivo/u);
  });
  it("recusa bundle desconhecido antes de interpretar seu conteúdo", () => {
    expect(errors({ bundleVersion: "openlabs/bundle/v99" })).toMatch(/atualize o leitor/u);
  });
  it("explica que o handbook exige uma versão mais nova", () => {
    const p = copy(); p.handbook.apiVersion = "openlabs/handbook/v99";
    expect(errors(p)).toContain("Atualize o OpenLabs");
    expect(errors({ bundleVersion: original.bundleVersion, handbook: { apiVersion: "openlabs/handbook/v99", futureStructure: true } })).toContain("Atualize o OpenLabs");
  });
  it("recusa chave desconhecida em vez de aceitar um título perdido", () => {
    const p = copy(); p.handbook.titel = p.handbook.name;
    expect(errors(p)).toContain("titel");
  });
  it("recusa conteúdo incompleto, duplicado e que ficaria invisível", () => {
    const missing = copy(); missing.articles = [];
    expect(errors(missing)).toContain("não existe como arquivo");
    const duplicate = copy(); duplicate.articles.push(duplicate.articles[0]);
    expect(errors(duplicate)).toContain("repetido");
    const invisible = copy(); invisible.handbook.articles[0].status = "coming"; delete invisible.handbook.articles[0].href;
    expect(errors(invisible)).toContain("invisível");
  });
  it("recusa data impossível e fase sem currículo", () => {
    const date = copy(); date.exportedAt = "2026-02-30";
    expect(errors(date)).toContain("data ISO válida");
    const phase = copy(); phase.handbook.articles[0].phase = 42;
    expect(errors(phase)).toContain("fase 42");
  });
  it("não altera o documento recebido", () => {
    const p = copy(); const before = JSON.stringify(p); lerPacote(p);
    expect(JSON.stringify(p)).toBe(before);
  });
});

describe("a mesma régua de artigos fora do site", () => {
  it("lê CRLF sem exigir normalizar o arquivo do autor", () => {
    const p = copy(); p.articles[0].markdown = p.articles[0].markdown.replace(/\n/g, "\r\n");
    expect(lerPacote(p).ok).toBe(true);
  });
  it.each([
    ["identidade", (s: string) => s.replace("handbook: kubernetes", "handbook: outro"), /handbook deve ser/u],
    ["título", (s: string) => s.replace('title: "A Pod is not its container"', 'title: "Outro título"'), /título e fase/u],
    ["fonte não declarada", (s: string) => s + "\n[fato](#src-inventada)\n", /sem fonte declarada/u],
    ["fonte não citada", (s: string) => s.replace(/#src-resources/g, "#other-resources"), /não citada/u],
    ["degrau ausente", (s: string) => s.replace("[!deeper]", "[!note]"), /pelo menos um degrau/u],
    ["degrau vazio", (s: string) => s.replace(/\n>\n>/, "\n> sem branco\n>"), /linha em branco e corpo/u],
    ["lab indisponível", (s: string) => s.replace("lab: labs/pod-lifecycle", "lab: labs/rolling-updates"), /lab pronto da mesma fase/u],
  ] as const)("recusa %s", (_name, change, message) => {
    const p = copy(); p.articles[0].markdown = change(p.articles[0].markdown);
    expect(errors(p)).toMatch(message);
  });
  it("gera YAML sem transformar o nome do autor em outros campos", () => {
    const name = "Training: team\nsubject: injected";
    const lido = lerManifesto(criarManifesto({ id: "networking", nome: name, github: "octocat" }), "projeto");
    expect(lido.problemas).toEqual([]);
    expect(lido.handbook?.mantenedores[0]?.name).toBe(name);
    expect(lido.handbook?.subject).toBe("networking");
    expect(() => criarManifesto({ id: "../escape", nome: "Team", github: "octocat" })).toThrow();
  });
});
