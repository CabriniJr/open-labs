import { z } from "zod";
import { IdSchema } from "./schema.js";
import { labsExigidos, lerPacote, type PacoteDeHandbook } from "./bundle.js";
import { VersionSchema } from "./version.js";
export { VersionSchema } from "./version.js";

export const LAB_API_VERSION = "openlabs/lab/v1";
export const HOST_TEMPLATE_API_VERSION = "openlabs/host-template/v1";
export const DELIVERY_API_VERSION = "openlabs/delivery/v1";
export const AssetPathSchema = z.string().min(1).refine((s) => /^[a-zA-Z0-9_./-]+$/u.test(s) && !s.startsWith("/") && s.split("/").every((p) => p !== "" && p !== "." && p !== ".."), "Use a relative artifact path without traversal");
const RuntimeSchema = z.object({ id: IdSchema, version: VersionSchema }).strict();
const InteractionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("flow"), model: z.string().min(1), runtime: RuntimeSchema, structure: z.object({ format: z.literal("openlabs/mermaid-skeleton/v1"), source: AssetPathSchema.refine((s) => s.endsWith(".mmd"), "A flow requires its canonical .mmd source") }).strict() }).strict(),
  z.object({ kind: z.literal("state"), model: z.string().min(1), runtime: RuntimeSchema }).strict(),
  z.object({ kind: z.literal("direct"), model: z.string().min(1) }).strict(),
]);

/** Behavior is compiled code, not a replacement data language for models. */
export const LabDescriptorSchema = z.object({
  apiVersion: z.literal(LAB_API_VERSION), id: IdSchema, version: VersionSchema,
  title: z.string().min(1), href: z.string().regex(/^labs\/[a-z0-9]+(?:-[a-z0-9]+)*$/u), interaction: InteractionSchema,
}).strict();
export type LabDescriptor = z.infer<typeof LabDescriptorSchema>;
export const HostCapabilitiesSchema = z.object({
  id: IdSchema, version: VersionSchema, interactions: z.array(z.enum(["flow", "state", "direct"])).min(1), runtimes: z.array(RuntimeSchema),
}).strict();
export type HostCapabilities = z.infer<typeof HostCapabilitiesSchema>;
export const FileDigestSchema = z.object({ path: AssetPathSchema, sha256: z.string().regex(/^[a-f0-9]{64}$/u) }).strict();
export const HostTemplateSchema = z.object({
  apiVersion: z.literal(HOST_TEMPLATE_API_VERSION), host: HostCapabilitiesSchema,
  labs: z.array(LabDescriptorSchema), files: z.array(FileDigestSchema).min(1),
}).strict();
export type HostTemplate = z.infer<typeof HostTemplateSchema>;
export const DeliverySchema = z.object({
  apiVersion: z.literal(DELIVERY_API_VERSION), id: IdSchema, version: VersionSchema,
  host: z.object({ id: IdSchema, version: VersionSchema }).strict(),
  handbook: z.literal("handbook.json"), labs: z.array(LabDescriptorSchema), files: z.array(FileDigestSchema).min(1),
}).strict();
export type Delivery = z.infer<typeof DeliverySchema>;

export function checkDelivery(bundle: Pick<PacoteDeHandbook, "handbook">, labs: readonly LabDescriptor[], host: HostCapabilities) {
  const errors: string[] = [], resolved: LabDescriptor[] = [];
  for (const key of ["id", "href"] as const) if (new Set(labs.map((l) => l[key])).size !== labs.length) errors.push(`Duplicate lab ${key} in host catalog.`);
  for (const need of labsExigidos(bundle)) {
    const lab = labs.find((l) => l.id === need.id && l.href === need.href);
    if (!lab) { errors.push(`Host implementation required: ${need.id} (${need.href}).`); continue; }
    if (!host.interactions.includes(lab.interaction.kind)) errors.push(`Host does not support ${lab.interaction.kind}: ${lab.id}.`);
    if (lab.interaction.kind !== "direct") {
      const runtime = lab.interaction.runtime;
      if (!host.runtimes.some((r) => r.id === runtime.id && r.version === runtime.version)) errors.push(`Runtime ${runtime.id}@${runtime.version} required by ${lab.id}.`);
    }
    resolved.push(lab);
  }
  return { errors, labs: resolved };
}

export async function hashBytes(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("Integrity checks require HTTPS or localhost.");
  const hash = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer);
  return Array.from(new Uint8Array(hash), (v) => v.toString(16).padStart(2, "0")).join("");
}

function checkFiles(files: Delivery["files"]) {
  const paths = files.map((f) => f.path);
  if (new Set(paths).size !== paths.length) throw new Error("Duplicate delivery asset path.");
  if (paths.includes("release.json")) throw new Error("release.json cannot hash itself.");
  if (!paths.includes("index.html") || !paths.includes("serve.mjs")) throw new Error("A delivery needs index.html and serve.mjs.");
}

export function readDelivery(doc: unknown): Delivery {
  const release = DeliverySchema.parse(doc); checkFiles(release.files);
  if (!release.files.some((f) => f.path === release.handbook)) throw new Error("Missing handbook digest.");
  for (const lab of release.labs) if (lab.interaction.kind === "flow") {
    const source = lab.interaction.structure.source;
    if (!release.files.some((f) => f.path === source)) throw new Error(`Missing canonical Mermaid source for ${lab.id}.`);
  }
  return release;
}

/** Same assembly in the CLI and Studio. The caller supplies reviewed host bytes. */
export async function assembleDelivery(input: { bundle: PacoteDeHandbook; version: string; template: HostTemplate; load: (path: string) => Promise<Uint8Array> }) {
  const template = HostTemplateSchema.parse(input.template); checkFiles(template.files);
  const read = lerPacote(input.bundle); if (!read.ok) throw new Error(read.errors.join("\n"));
  const plan = checkDelivery(read.value, template.labs, template.host);
  if (plan.errors.length) throw new Error(plan.errors.join("\n"));
  const files: Record<string, Uint8Array> = {};
  for (const item of template.files) {
    if (item.path === "handbook.json") throw new Error("The host template must not supply handbook content.");
    const bytes = await input.load(item.path);
    if (await hashBytes(bytes) !== item.sha256) throw new Error(`Integrity mismatch: ${item.path}`);
    files[item.path] = bytes;
  }
  const handbook = new TextEncoder().encode(JSON.stringify(read.value, null, 2) + "\n");
  files["handbook.json"] = handbook;
  const release = readDelivery({
    apiVersion: DELIVERY_API_VERSION, id: read.value.handbook.id, version: input.version,
    host: { id: template.host.id, version: template.host.version }, handbook: "handbook.json", labs: plan.labs,
    files: [...template.files, { path: "handbook.json", sha256: await hashBytes(handbook) }],
  });
  files["release.json"] = new TextEncoder().encode(JSON.stringify(release, null, 2) + "\n");
  return { release, files };
}

export function checkInstalledDelivery(release: Delivery, bundle: PacoteDeHandbook, template: Pick<HostTemplate, "host" | "labs">): readonly string[] {
  const errors = [...checkDelivery(bundle, template.labs, template.host).errors];
  if (release.id !== bundle.handbook.id) errors.push("Delivery and handbook identities differ.");
  if (release.host.id !== template.host.id || release.host.version !== template.host.version) errors.push("Incompatible host version.");
  const required = labsExigidos(bundle);
  if (release.labs.length !== required.length) errors.push("Delivery lab set differs from the handbook requirements.");
  for (const need of required) {
    const provided = release.labs.find((l) => l.id === need.id && l.href === need.href);
    const installed = template.labs.find((l) => l.id === need.id && l.href === need.href);
    if (!provided || !installed || JSON.stringify(LabDescriptorSchema.parse(provided)) !== JSON.stringify(LabDescriptorSchema.parse(installed))) errors.push(`Incompatible lab descriptor: ${need.id}.`);
  }
  return errors;
}
