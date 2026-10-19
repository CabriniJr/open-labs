import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readAssessments } from "@ovh/handbook-format/contract";
import type { HandbookNormalizado } from "@ovh/handbook-format/contract";
import { raizDoRepo } from "./raiz.js";

/** Build-time content lookup; never imported by a learner's runtime. */
export function bankForHandbook(handbook: Pick<HandbookNormalizado, "id" | "labs">) {
  const path = join(raizDoRepo(), "handbooks", handbook.id, "assessments.json");
  return existsSync(path) ? readAssessments(JSON.parse(readFileSync(path, "utf8")), handbook) : undefined;
}
