import react from "@vitejs/plugin-react";
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      name: "node",
      environment: "node",
      include: [
        "packages/depth-core/src/**/*.test.ts",
        "packages/otel-domain/src/**/*.test.ts",
        "packages/cpu-domain/src/**/*.test.ts",
        "packages/algo-domain/src/**/*.test.ts",
        "packages/model-format/src/**/*.test.ts",
        "apps/site/src/**/*.test.ts",
        "packages/depth-ui/src/**/*.test.ts",
        "scripts/**/*.test.mjs",
      ],
    },
  },
  {
    plugins: [react()],
    test: {
      name: "dom",
      environment: "jsdom",
      include: ["packages/depth-ui/src/**/*.test.tsx", "apps/site/src/**/*.test.tsx"],
    },
  },
]);
