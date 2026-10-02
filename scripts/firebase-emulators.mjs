import { spawn } from "node:child_process";
import { firebaseTestEnv } from "./firebase-test-env.mjs";

const mode = process.argv[2] || "all";
if (!["integration", "e2e", "all", "dev"].includes(mode)) throw new Error("Choose integration, e2e, all or dev.");
const command = mode === "dev" ? "npm run dev" : `node scripts/emulator-checks.mjs ${mode}`;
const child = spawn(process.execPath, ["node_modules/firebase-tools/lib/bin/firebase.js", "emulators:exec", "--project", "demo-scanly", "--only", "auth,firestore,storage", command], { stdio: "inherit", env: { ...process.env, ...firebaseTestEnv } });
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => { process.exitCode = code ?? 1; });
