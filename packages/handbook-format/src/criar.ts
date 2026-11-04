import { stringify } from "yaml";
import { ManifestoV1Schema, VERSAO_ATUAL } from "./versoes.js";

/** Molde único para a submissão no repo e para autoria em projeto próprio. */
export function criarManifesto({ id, nome, github }: { readonly id: string; readonly nome: string; readonly github: string }): string {
  const titulo = id.split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
  const doc = ManifestoV1Schema.parse({
    apiVersion: VERSAO_ATUAL, id, name: `${titulo} Visual Handbook`, subject: id.replace(/-/gu, " "),
    tagline: "One sentence that says what the reader will be able to see.",
    blurb: "Describe what this handbook teaches and what its interactive models make observable.",
    model: `${id}.model`, stage: "planned", maintainers: [{ name: nome, github }],
    theme: {
      light: { accent: "#425cc7", flow: "#425cc7", dropped: "#b8442a", ok: "#3f7a52", mutation: "#f5a800", processor: "#425cc7", conduit: "#3f7a52", species: ["#7c5cd6", "#3f7a52", "#c2410c", "#0e7490"] },
      dark: { accent: "#8fa2ee" },
    },
    phases: [{ number: 1, title: "The first idea", line: "What the reader needs before the next concept." }],
    articles: [{ id: "the-first-article", title: "The first article", status: "coming", phase: 1 }],
    labs: [],
  });
  return `# OpenLabs handbook — edit the curriculum, then run check.\n${stringify(doc)}`;
}
