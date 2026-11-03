import { InteractiveSession } from "@ovh/interactive-core";
import { DEPLOYMENT_MANIFEST, parseManifest, POD_LIFECYCLE_MODEL } from "@ovh/kubernetes-domain";
import { expect, it } from "vitest";
import { clusterResourceDetails, clusterResourceIds } from "./cluster-inspector.js";

it("reads actual reservations without changing resource identity or model state", () => {
  const parsed = parseManifest(DEPLOYMENT_MANIFEST);
  if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
  const session = new InteractiveSession(POD_LIFECYCLE_MODEL);
  session.dispatch({ type: "apply", workload: parsed.value, source: DEPLOYMENT_MANIFEST });
  const state = session.dispatch({ type: "tick" });
  const before = JSON.stringify(state);
  const details = clusterResourceDetails(state, "no:worker-01")!;
  expect(Object.fromEntries(details.fields)).toMatchObject({ "CPU reserved": "1000 / 2000m", "CPU unreserved": "1000m", "Assigned Pods": "2" });
  expect(clusterResourceIds(state).has(`pod:${state.pods[0]!.uid}`)).toBe(true);
  expect(clusterResourceDetails(state, state.pods[0]!.uid)).toBeNull();
  expect(JSON.stringify(state)).toBe(before);
});
