import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
const aliases = { "@": fileURLToPath(new URL("./src", import.meta.url)), "server-only": fileURLToPath(new URL("./tests/fixtures/server-only.ts", import.meta.url)) };
export default defineConfig({
  test: {
    projects: [
      { resolve: { alias: aliases }, test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node", restoreMocks: true, unstubEnvs: true, unstubGlobals: true } },
      { resolve: { alias: aliases }, test: { name: "integration", include: ["tests/integration/**/*.test.ts"], environment: "node", testTimeout: 60_000, hookTimeout: 120_000, fileParallelism: false } },
    ],
  },
});
