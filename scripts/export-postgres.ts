import { config } from "dotenv";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
config({ path: ".env.local" });

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL for the legacy database. This export is read-only.");
  const target = resolve(process.argv[2] || "backups/scanly-export.json");
  const { db, pool } = await import("../src/db/index");
  const schema = await import("../src/db/schema");
  try {
    // One consistent, explicitly read-only snapshot, even while the legacy DB is live.
    const snapshot = await db.transaction(async (transaction) => {
      // Never export password_hash, authentication sessions or cookie tokens.
      const { users } = schema;
      const profiles = await transaction.select({ id: users.id, email: users.email, name: users.name, role: users.role, createdAt: users.createdAt, updatedAt: users.updatedAt }).from(users);
      const [businesses, businessMembers, qrCodes, menuCategories, menuItems, analyticsEvents, reviewSessions, activityLogs] = await Promise.all([
        transaction.select().from(schema.businesses), transaction.select().from(schema.businessMembers), transaction.select().from(schema.qrCodes), transaction.select().from(schema.menuCategories), transaction.select().from(schema.menuItems), transaction.select().from(schema.analyticsEvents), transaction.select().from(schema.reviewSessions), transaction.select().from(schema.activityLogs),
      ]);
      return { profiles, businesses, businessMembers, qrCodes, menuCategories, menuItems, analyticsEvents, reviewSessions, activityLogs };
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
    const { profiles, businesses, businessMembers, qrCodes, menuCategories, menuItems, analyticsEvents, reviewSessions, activityLogs } = snapshot;
    const data = { version: 1, exportedAt: new Date().toISOString(), users: profiles, businesses, businessMembers, qrCodes, menuCategories, menuItems, analyticsEvents, reviewSessions, activityLogs };
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    await writeFile(target, JSON.stringify(data, null, 2), { mode: 0o600, flag: "wx" });
    console.info(`Read-only export completed: ${businesses.length} businesses, ${profiles.length} profiles. Private export saved outside tracked source; no database rows were changed.`);
  } finally { await pool.end(); }
}
main().catch(() => { console.error("Legacy export failed. Check DATABASE_URL, database permissions, schema and that the output file does not already exist. No credentials are printed."); process.exitCode = 1; });
