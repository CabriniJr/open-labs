import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import ts from "typescript";
import { franc } from "franc-min";
import { OVERRIDES } from "../apps/site/src/locales/overrides.ts";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const messages = new Map();
const normalize = (s) => s.replace(/\s+/gu, " ").trim();
const native = new Set(["OpenLabs", "GitHub", "Studio", "OpenTelemetry", "Kubernetes", "Pod", "Pods", "Deployment", "ReplicaSet", "Pending", "Running", "Terminating", "ImagePullBackOff", "CrashLoopBackOff", "OOMKilled", "CPU", "RAM", "UID", "OTLP", "HTTP/2", "OTel", "gRPC", "JSON", "YAML", "Mermaid", "RISC-V", "RV32I", "API", "SDK", "TypeScript", "JavaScript", "nginx", "traceparent", "traceId", "spanId", "ADDI", "LOAD", "STORE", "JMP", "JZ", "NOP", "ADD", "SUB", "AND", "OR", "XOR", "NOT"]);
function candidate(text) {
  if (!text || text.length > 18000 || !/[\p{L}]/u.test(text) || native.has(text)) return false;
  if (/^(?:!--|<!--|\/\*|\/\/)/u.test(text) || text.endsWith("-->")) return false;
  if (/^(?:astro-island(?:\[|:)|(?:[a-z-]+,){2,})/u.test(text)) return false;
  if (/^(?:https?:|@ovh\/|\.\.?\/|\/|#[a-z0-9]|-[a-z-]|__|\.[a-z_-])/iu.test(text)) return false;
  if (/^[a-z0-9_]+(?:[./_-][a-z0-9_-]+)+$/u.test(text) || /^[A-Z_0-9]{1,4}$/u.test(text)) return false;
  if (/\b(?:apiVersion:|import .* from|export (?:const|function)|const .* =|function\s*\(|useState\(|document\.|node_modules|font-family|grid-template|@media|data-testid)/u.test(text)) return false;
  if (/=>|\?\.[a-z]|[{}]/u.test(text.replace(/\{\d+\}/gu, ""))) return false;
  if (/^[a-zA-Z0-9_.-]+\.(?:ts|tsx|js|mjs|json|yaml|yml|md|css|html|mmd|go|py|rs)$/u.test(text)) return false;
  return true;
}
function language(text, hint = "en") {
  // Reviewed source/target pairs take precedence over statistical detection.
  if (Object.hasOwn(OVERRIDES["pt-BR"], text)) return "en";
  if (Object.hasOwn(OVERRIDES.en, text)) return "pt-BR";
  if (["Handbooks", "Labs", "labs", "roadmap"].includes(text)) return "en";
  const english = (text.match(/\b(?:the|and|you|your|this|that|which|what|when|where|how|with|without|from|are|is|has|have|does|not|before|after|for|in|of|as|to|on|can|will|must|should)\b/giu) ?? []).length;
  const portuguese = (text.match(/\b(?:uma?|não|são|para|com|por|que|seu|sua|ou|isso|esta|esse|de|do|da|das|dos|ao|na|no|duas|pontas|cargas|formas|antigas|histograma|hoje|acumula|anatomia|tinha|varreduras|depois|gente|mensagens|alvo|fases|entrega|linhas|alternativa|arraste|mudanças|folhas|ativas|fora|gerava|juntar|fontes|motor|composicional|regime|notáveis|novo|ganhou|oferece|olhar|telas|onde|ele|organizar|corredores|consulta|quatro|peças|roteiro|setas|vermelhas|submeter|ver|mecanismo|verde|virou|pertence|rascunho|proposta|progresso|andamento|escrever|iguais|vale)\b/giu) ?? []).length;
  if (english > portuguese && english > 0) return "en";
  if (portuguese > english) return "pt-BR";
  if (/[ãõçáéíóúâêôà]/iu.test(text)) return "pt-BR";
  if (text.length < 12) return /\b(?:de|da|do|dos|das|um|uma|não|para|com|por|que|seu|sua|ou|e)\b/iu.test(text) ? "pt-BR" : hint;
  return franc(text, { only: ["eng", "por"], minLength: 8 }) === "por" ? "pt-BR" : "en";
}
function add(value, file, hint = "en", scope = "ui") {
  const source = normalize(value); if (!candidate(source)) return;
  const old = messages.get(source);
  if (old) { if (scope === "ui") old.scope = "ui"; if (!old.files.includes(file)) old.files.push(file); return; }
  messages.set(source, { source, language: language(source, hint), scope, files: [file] });
}
function walk(dir, accept) { return readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile() && accept(e.name)).map((e) => join(e.parentPath, e.name)).sort(); }
for (const path of walk(join(root, "apps/site/dist"), (name) => name.endsWith(".html"))) {
  const file = relative(root, path), doc = new JSDOM(readFileSync(path, "utf8")).window.document;
  const scope = file.includes("/docs/") ? "reference" : "ui";
  const walker = doc.createTreeWalker(doc.documentElement, 4);
  for (let node; (node = walker.nextNode());) if (!node.parentElement?.closest("script,style,pre,code,textarea,kbd,samp,[translate=no],[data-no-translate]")) add(node.nodeValue, file, doc.documentElement.lang, scope);
  for (const el of doc.querySelectorAll("[aria-label],[title],[placeholder],[alt],meta[name=description]")) for (const attr of ["aria-label", "title", "placeholder", "alt", ...(el.matches("meta[name=description]") ? ["content"] : [])]) if (el.hasAttribute(attr)) add(el.getAttribute(attr), file, doc.documentElement.lang, scope);
}
const paths = ["apps/site/src", "apps/runner/src", "packages/handbook-format/src", "packages/interactive-core/src", "packages/depth-core/src", "packages/depth-ui/src", "packages/otel-domain/src", "packages/cpu-domain/src", "packages/algo-domain/src", "packages/kubernetes-domain/src"];
for (const prefix of paths) for (const path of walk(join(root, prefix), (name) => /\.(?:tsx?|astro)$/u.test(name) && !/\.test\./u.test(name))) {
  // Translation values are outputs, never new source messages to translate back.
  if (path.includes(`${join("src", "locales")}/`)) continue;
  const file = relative(root, path), source = readFileSync(path, "utf8");
  const parsed = ts.createSourceFile(file.replace(/\.astro$/u, ".tsx"), source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isJsxText(node)) add(node.text, file);
    if (ts.isStringLiteralLike(node) && !(ts.isPropertyAssignment(node.parent) && node.parent.name === node) && !(ts.isJsxAttribute(node.parent) && !["aria-label", "title", "placeholder", "alt"].includes(node.parent.name.getText(parsed)))) add(node.text, file);
    if (ts.isTemplateExpression(node)) add(node.head.text + node.templateSpans.map((span, i) => `{${i}}${span.literal.text}`).join(""), file);
    ts.forEachChild(node, visit);
  }
  visit(parsed);
}
for (const path of walk(join(root, "handbooks"), (name) => name === "assessments.json")) {
  const fields = new Set(["title", "description", "prompt", "explanation", "remediation", "text", "notes", "attribution"]);
  function visit(value, key = "") { if (typeof value === "string" && fields.has(key)) add(value, relative(root, path)); else if (Array.isArray(value)) value.forEach((v) => visit(v)); else if (value && typeof value === "object") Object.entries(value).forEach(([k, v]) => visit(v, k)); }
  visit(JSON.parse(readFileSync(path, "utf8")));
}
for (const path of walk(join(root, "apps/site/src/content/articles"), (name) => name.endsWith(".md"))) {
  for (const match of readFileSync(path, "utf8").matchAll(/^>\s*\[!deeper\]\s*(.*)$/gmu)) add(match[1].replace(/`([^`]+)`/gu, "$1").replace(/\*\*([^*]+)\*\*/gu, "$1"), relative(root, path));
}
const inventory = [...messages.values()].sort((a, b) => a.source.localeCompare(b.source, "en"));
const out = join(root, "dist"); mkdirSync(out, { recursive: true });
writeFileSync(join(out, "locale-inventory.json"), JSON.stringify({ inventoryVersion: 1, messages: inventory }, null, 2) + "\n");
console.log(JSON.stringify({ messages: inventory.length, characters: inventory.reduce((n, m) => n + m.source.length, 0), languages: Object.fromEntries(["en", "pt-BR"].map((lang) => [lang, inventory.filter((m) => m.language === lang).length])), reference: inventory.filter((m) => m.scope === "reference").length }));
