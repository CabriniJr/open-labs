import { assembleDelivery, HostTemplateSchema, lerPacote, VersionSchema } from "@ovh/handbook-format/contract";
import { zipSync } from "fflate";
import { exportProject, type StudioProject } from "./studio.js";

export async function downloadDelivery(project: StudioProject, version: string, templateUrl: string): Promise<Uint8Array> {
  VersionSchema.parse(version);
  const bundle = lerPacote(JSON.parse(exportProject(project, new Date().toISOString().slice(0, 10))));
  if (!bundle.ok) throw new Error(bundle.errors.join("\n"));
  const response = await fetch(new URL("host.json", templateUrl));
  if (!response.ok) throw new Error("Delivery host is not available. Try again after the host build is ready.");
  const template = HostTemplateSchema.parse(await response.json());
  const result = await assembleDelivery({ bundle: bundle.value, version, template, load: async (path) => {
    const r = await fetch(new URL(path, templateUrl));
    if (!r.ok) throw new Error(`Could not load delivery asset: ${path}`);
    return new Uint8Array(await r.arrayBuffer());
  } });
  return zipSync(result.files, { level: 6 });
}
