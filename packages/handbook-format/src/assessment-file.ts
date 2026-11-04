import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readAssessments, type AssessmentSet } from "./assessments.js";
import type { HandbookNormalizado } from "./versoes.js";

export function readAssessmentFile(dir: string, handbook: HandbookNormalizado): { assessments?: AssessmentSet; problemas: string[] } {
  const path = join(dir, "assessments.json");
  if (!existsSync(path)) return { problemas: [] };
  try { return { assessments: readAssessments(JSON.parse(readFileSync(path, "utf8")), handbook), problemas: [] }; }
  catch (error) { return { problemas: [`${path}: ${error instanceof Error ? error.message : String(error)}`] }; }
}
