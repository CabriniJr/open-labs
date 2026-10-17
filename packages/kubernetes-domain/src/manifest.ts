import { parse } from "yaml";
import { z } from "zod";

const nome = z.string().max(63).regex(/^[a-z0-9](?:[-a-z0-9]*[a-z0-9])?$/);
const quantidade = z.union([z.string(), z.number()]);
const recursos = z.object({ cpu: quantidade, memory: quantidade }).strict();
const container = z.object({
  name: nome,
  image: z.string().min(1).max(200),
  resources: z.object({ requests: recursos, limits: recursos.optional() }).strict(),
}).strict();
const podSpec = z.object({
  containers: z.array(container).length(1, "This experiment models exactly one container per Pod."),
  restartPolicy: z.enum(["Always", "OnFailure", "Never"]).default("Always"),
  terminationGracePeriodSeconds: z.number().int().min(0).max(30).default(30),
}).strict();
const metadata = z.object({ name: nome, namespace: nome.default("default"), labels: z.record(z.string()).optional() }).strict();
const schema = z.discriminatedUnion("kind", [
  z.object({ apiVersion: z.literal("v1"), kind: z.literal("Pod"), metadata, spec: podSpec }).strict(),
  z.object({
    apiVersion: z.literal("apps/v1"), kind: z.literal("Deployment"), metadata,
    spec: z.object({
      replicas: z.number().int().min(0).max(12).default(1),
      strategy: z.object({ type: z.literal("Recreate") }).strict(),
      selector: z.object({ matchLabels: z.record(z.string()).refine((x) => Object.keys(x).length > 0, "A selector needs a label.") }).strict(),
      template: z.object({ metadata: z.object({ labels: z.record(z.string()) }).strict(), spec: podSpec }).strict(),
    }).strict(),
  }).strict(),
]);

export interface Workload {
  readonly kind: "Pod" | "Deployment";
  readonly name: string;
  readonly namespace: string;
  readonly replicas: number;
  readonly image: string;
  readonly containerName: string;
  readonly cpuRequest: number;
  readonly memoryRequest: number;
  readonly cpuLimit: number | null;
  readonly memoryLimit: number | null;
  readonly restartPolicy: "Always" | "OnFailure" | "Never";
  readonly grace: number;
  readonly selector: Readonly<Record<string, string>> | null;
  readonly templateLabels: Readonly<Record<string, string>>;
}

export function cpu(value: string | number): number {
  const raw = String(value);
  const milli = /^\d+m$/.test(raw) ? Number(raw.slice(0, -1)) : /^\d+(?:\.\d{1,3})?$/.test(raw) ? Math.round(Number(raw) * 1000) : NaN;
  if (!Number.isFinite(milli) || milli <= 0 || !Number.isInteger(milli) || milli > 1_000_000) throw new Error("CPU must be positive whole millicores, such as 500m, 0.5 or 1.");
  return milli;
}

export function memory(value: string | number): number {
  const match = /^(\d+)(Mi|Gi)$/.exec(String(value));
  const mi = match ? Number(match[1]) * (match[2] === "Gi" ? 1024 : 1) : NaN;
  if (!Number.isSafeInteger(mi) || mi <= 0 || mi > 1_048_576) throw new Error("This experiment accepts memory in whole Mi or Gi, such as 256Mi or 1Gi.");
  return mi;
}

export type ManifestResult = { readonly ok: true; readonly value: Workload } | { readonly ok: false; readonly errors: readonly string[] };

/** Subconjunto explícito da API: campo que não modelamos é recusado, não ignorado. */
export function parseManifest(source: string): ManifestResult {
  try {
    if (source.length > 20_000) throw new Error("Keep this single-workload manifest below 20 KB.");
    const result = schema.safeParse(parse(source, { maxAliasCount: 20, uniqueKeys: true }));
    if (!result.success) return { ok: false, errors: result.error.issues.map((e) => `${e.path.join(".") || "manifest"}: ${e.message}`) };
    const doc = result.data;
    const spec = doc.kind === "Deployment" ? doc.spec.template.spec : doc.spec;
    if (doc.kind === "Deployment") {
      if (spec.restartPolicy !== "Always") throw new Error("Deployment Pods require restartPolicy: Always.");
      for (const [key, value] of Object.entries(doc.spec.selector.matchLabels)) {
        if (doc.spec.template.metadata.labels[key] !== value) throw new Error("spec.selector.matchLabels must match the Pod template labels.");
      }
    }
    const c = spec.containers[0]!;
    const cpuRequest = cpu(c.resources.requests.cpu);
    const memoryRequest = memory(c.resources.requests.memory);
    const cpuLimit = c.resources.limits ? cpu(c.resources.limits.cpu) : null;
    const memoryLimit = c.resources.limits ? memory(c.resources.limits.memory) : null;
    if ((cpuLimit !== null && cpuLimit < cpuRequest) || (memoryLimit !== null && memoryLimit < memoryRequest)) throw new Error("A resource request cannot exceed its limit.");
    return { ok: true, value: {
      kind: doc.kind, name: doc.metadata.name, namespace: doc.metadata.namespace,
      replicas: doc.kind === "Deployment" ? doc.spec.replicas : 1,
      image: c.image, containerName: c.name, cpuRequest, memoryRequest, cpuLimit, memoryLimit,
      restartPolicy: spec.restartPolicy, grace: spec.terminationGracePeriodSeconds,
      selector: doc.kind === "Deployment" ? doc.spec.selector.matchLabels : null,
      templateLabels: doc.kind === "Deployment" ? doc.spec.template.metadata.labels : {},
    } };
  } catch (e) {
    return { ok: false, errors: [e instanceof Error ? e.message : "Invalid manifest."] };
  }
}

/** Parte que altera a identidade do template, sem misturar escala com rollout. */
export function templateKey(w: Workload): string {
  return JSON.stringify([w.image, w.containerName, w.cpuRequest, w.memoryRequest, w.cpuLimit, w.memoryLimit, w.restartPolicy, w.grace, Object.entries(w.templateLabels).sort()]);
}
