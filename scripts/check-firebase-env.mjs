#!/usr/bin/env node
// Verifies that the environment the app is built/deployed with points at exactly
// one Firebase project — the same one whose firestore.rules/storage.rules are
// deployed. Run locally with `node --env-file=.env.local scripts/check-firebase-env.mjs`
// or on Vercel with `vercel env pull .env.local` first.
//
// No secret values are printed: only presence and the (public) project id.

const PUBLIC_KEYS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];

const problems = [];
const present = (key) => (process.env[key] || "").trim();

for (const key of PUBLIC_KEYS) if (!present(key)) problems.push(`Missing ${key}`);

const webProject = present("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
const adminProject = present("FIREBASE_PROJECT_ID");
const authDomain = present("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
const bucket = present("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");

if (!adminProject) problems.push("Missing FIREBASE_PROJECT_ID (server-side Firebase Admin)");
if (webProject && adminProject && webProject !== adminProject) {
  problems.push(`Project mismatch: NEXT_PUBLIC_FIREBASE_PROJECT_ID=${webProject} but FIREBASE_PROJECT_ID=${adminProject}. The browser and the server must use the same Firebase project as the deployed rules.`);
}
if (webProject && authDomain && !authDomain.startsWith(`${webProject}.`)) {
  problems.push(`NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN (${authDomain}) does not belong to project ${webProject}.`);
}
if (webProject && bucket && !bucket.startsWith(`${webProject}.`)) {
  problems.push(`NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET (${bucket}) does not belong to project ${webProject}.`);
}

const email = present("FIREBASE_CLIENT_EMAIL");
const key = present("FIREBASE_PRIVATE_KEY");
const adc = present("FIREBASE_USE_APPLICATION_DEFAULT_CREDENTIALS") === "true";
if (!adc) {
  if (!email || !key) problems.push("Missing FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY (or set FIREBASE_USE_APPLICATION_DEFAULT_CREDENTIALS=true)");
  if (email && !email.endsWith(".iam.gserviceaccount.com")) problems.push("FIREBASE_CLIENT_EMAIL must be a service account, not a personal email");
  if (key && !key.includes("-----BEGIN PRIVATE KEY-----")) problems.push("FIREBASE_PRIVATE_KEY must be the PEM private_key string, not the whole service-account JSON");
}
if (present("NEXT_PUBLIC_USE_FIREBASE_EMULATORS") === "true" && !webProject.startsWith("demo-")) {
  problems.push("NEXT_PUBLIC_USE_FIREBASE_EMULATORS must never be true for a live Firebase project (and never on Vercel)");
}

if (problems.length) {
  console.error("Firebase environment problems:");
  for (const problem of problems) console.error(` - ${problem}`);
  console.error(`\nDeploy the matching rules with:\n  FIREBASE_PROJECT_ID=${webProject || "<project-id>"} npm run deploy:rules`);
  process.exit(1);
}

console.log(`Firebase environment OK. Browser and server both use project "${webProject}".`);
console.log(`Deploy the rules for THIS project with:\n  firebase deploy --only firestore:rules,firestore:indexes,storage --project ${webProject}`);
