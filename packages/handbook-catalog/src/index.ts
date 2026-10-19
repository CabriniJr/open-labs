import { HostCapabilitiesSchema, LabDescriptorSchema } from "@ovh/handbook-format/contract";
import catalog from "./catalog.json" with { type: "json" };

/** Reviewed adapters supplied by the first static host; never remote code paths. */
export const STATIC_HOST = HostCapabilitiesSchema.parse(catalog.host);
export const STATIC_LABS = catalog.labs.map((lab) => LabDescriptorSchema.parse(lab));
