import { spawn } from "node:child_process";

const mode = process.argv[2];
function execute(args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: "inherit", env });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${args[0]} exited with ${code}`)));
  });
}
async function integration() {
  const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3001"], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NEXT_DIST_DIR: ".next-e2e" } });
  let buffer = "";
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Next.js startup timed out.")), 120_000);
      const receive = (data) => { process.stdout.write(data); buffer += data; if (buffer.includes("Ready in")) { clearTimeout(timer); resolve(); } };
      app.stdout.on("data", receive); app.stderr.on("data", receive);
      app.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Next.js exited with ${code}`)); });
    });
    await execute(["node_modules/vitest/vitest.mjs", "run", "--project", "integration"]);
  } finally {
    app.kill("SIGTERM");
    await new Promise((resolve) => { if (app.exitCode !== null) resolve(); else app.once("exit", resolve); });
  }
}
try {
  if (mode === "all") await execute(["node_modules/vitest/vitest.mjs", "run", "--project", "unit"]);
  if (["integration", "e2e", "all"].includes(mode)) {
    // Both API and browser checks use the production-mode app. A development
    // compiler next to Java/test workers exceeds small CI memory limits.
    await execute(["node_modules/next/dist/bin/next", "build"], { ...process.env, NEXT_DIST_DIR: ".next-e2e" });
  }
  if (mode === "integration" || mode === "all") await integration();
  if (mode === "e2e" || mode === "all") {
    await execute(["node_modules/@playwright/test/cli.js", "test"]);
    await execute(["node_modules/@playwright/test/cli.js", "test", "--config=playwright.missing-config.ts"]);
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
