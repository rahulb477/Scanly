import { NextResponse } from "next/server";
import { scrub } from "@/lib/server-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * TEMPORARY PRODUCTION DIAGNOSTIC.
 *
 * Reports *why* the Firebase Admin server path fails on the deployed host.
 * Everything is read-only and sanitised: booleans, error names/codes and
 * scrubbed messages only. No environment value, private key, token, cookie or
 * stack trace is ever returned, and nothing is written to Firestore.
 *
 * Nothing is imported from firebase-admin at module scope on purpose: a module
 * that fails to load takes the whole serverless function down with a 500 and an
 * empty body, which is exactly the failure this endpoint exists to explain.
 * Each step is imported dynamically inside the handler so a failing step is
 * reported instead of crashing the function.
 */

const CHECKED_ENVIRONMENT_KEYS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_APP_URL",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_USE_APPLICATION_DEFAULT_CREDENTIALS",
] as const;

function present(key: string): boolean {
  return Boolean(process.env[key]?.trim());
}

function privateKeyShape() {
  const raw = process.env.FIREBASE_PRIVATE_KEY || "";
  const key = raw.trim();
  return {
    present: key.length > 0,
    length: key.length,
    hasPemHeader: key.includes("-----BEGIN PRIVATE KEY-----"),
    hasPemFooter: key.includes("-----END PRIVATE KEY-----"),
    hasEscapedNewlines: key.includes("\\n"),
    hasRealNewlines: key.includes("\n") || key.includes("\r"),
    wrappedInQuotes: (key.startsWith("\"") && key.endsWith("\"")) || (key.startsWith("'") && key.endsWith("'")),
    looksLikeJson: key.startsWith("{") || key.includes("\"private_key\""),
  };
}

function describe(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) return { name: "non-error", message: scrub(error) };
  const record = error as Error & { code?: unknown };
  const details: Record<string, unknown> = { name: error.name, message: scrub(error.message) };
  if (typeof record.code === "string" || typeof record.code === "number") details.code = record.code;
  return details;
}

async function step<T>(label: string, report: Record<string, unknown>, run: () => Promise<T>): Promise<T | undefined> {
  const startedAt = Date.now();
  try {
    const value = await run();
    report[label] = { status: "ok", ms: Date.now() - startedAt };
    return value;
  } catch (error) {
    report[label] = { status: "failed", ms: Date.now() - startedAt, ...describe(error) };
    console.error(`[scanly:diagnostics] ${label} failed ${JSON.stringify({ ...describe(error) })}`);
    return undefined;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${label} did not respond within ${ms}ms`)), ms)),
  ]);
}

export async function GET() {
  const report: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    runtime: "nodejs",
    node: process.version,
    vercel: process.env.VERCEL ? true : false,
    vercelEnv: process.env.VERCEL_ENV || null,
    emulatorHosts: {
      auth: process.env.FIREBASE_AUTH_EMULATOR_HOST || null,
      firestore: process.env.FIRESTORE_EMULATOR_HOST || null,
    },
    environment: Object.fromEntries(CHECKED_ENVIRONMENT_KEYS.map((key) => [key, present(key)])),
    project: {
      adminProjectId: process.env.FIREBASE_PROJECT_ID?.trim() || null,
      webProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || null,
      match: Boolean(process.env.FIREBASE_PROJECT_ID?.trim()) && process.env.FIREBASE_PROJECT_ID?.trim() === process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim(),
    },
    clientEmail: {
      present: present("FIREBASE_CLIENT_EMAIL"),
      isServiceAccount: /^[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com$/i.test((process.env.FIREBASE_CLIENT_EMAIL || "").trim().replace(/^["']|["']$/g, "")),
      length: (process.env.FIREBASE_CLIENT_EMAIL || "").trim().length,
      hasAtSign: (process.env.FIREBASE_CLIENT_EMAIL || "").includes("@"),
      wrappedInQuotes: /^["'].*["']$/.test((process.env.FIREBASE_CLIENT_EMAIL || "").trim()),
      looksLikeJson: (process.env.FIREBASE_CLIENT_EMAIL || "").trim().startsWith("{"),
    },
    privateKey: privateKeyShape(),
  };

  const appModule = await step("import:firebase-admin/app", report, () => import("firebase-admin/app"));
  await step("import:firebase-admin/auth", report, () => import("firebase-admin/auth"));
  await step("import:firebase-admin/firestore", report, () => import("firebase-admin/firestore"));
  await step("import:firebase-admin/storage", report, () => import("firebase-admin/storage"));
  await step("import:@/lib/firebase/admin", report, () => import("@/lib/firebase/admin"));

  if (appModule) {
    const admin = await import("@/lib/firebase/admin").catch(() => undefined);
    if (admin) {
      // Reports whether the configured credentials resolve and parse. Never
      // returns (or logs) a value — only the outcome and the source.
      let resolvedCredentials: { clientEmail: string; privateKey: string; source: string; unwrappedJson: boolean } | undefined;
      await step("credentials:resolve", report, async () => {
        const resolved = admin.resolveServiceAccountCredentials();
        if ("error" in resolved) throw new Error(`credential resolution failed: ${resolved.error}`);
        resolvedCredentials = resolved;
        return true;
      });
      if (resolvedCredentials) {
        const { privateKey, clientEmail, source, unwrappedJson } = resolvedCredentials;
        // A service account's domain is <project-id>.iam.gserviceaccount.com; the
        // project id is public configuration, so comparing it is safe and shows
        // whether the configured key belongs to this Firebase project.
        const accountProject = clientEmail.split("@")[1]?.replace(/\.iam\.gserviceaccount\.com$/i, "") || null;
        report.credentials = {
          source,
          unwrappedJson,
          serviceAccountProject: accountProject,
          serviceAccountProjectMatches: accountProject === (process.env.FIREBASE_PROJECT_ID?.trim() || null),
        };
        await step("credentials:parse-private-key", report, async () => {
          const { createPrivateKey } = await import("node:crypto");
          createPrivateKey(privateKey);
          return true;
        });
      }

      const app = await step("admin:getFirebaseAdminApp", report, async () => admin.getFirebaseAdminApp());
      if (app) {
        await step("admin:getAdminAuth", report, async () => admin.getAdminAuth());
        const db = await step("admin:getAdminDb", report, async () => admin.getAdminDb());
        if (db) {
          await step("firestore:read", report, () => withTimeout(db.collection("_health").doc("connectivity").get(), 8_000, "Firestore read"));
        }
        await step("auth:listUsers", report, () => withTimeout(admin.getAdminAuth().listUsers(1), 8_000, "Auth listUsers"));
      }
    }
  }

  const failed = Object.entries(report).filter(([, value]) => typeof value === "object" && value !== null && (value as { status?: string }).status === "failed").map(([key]) => key);
  report.failingSteps = failed;
  report.ok = failed.length === 0;

  return NextResponse.json(report, { status: 200, headers: { "Cache-Control": "no-store" } });
}
