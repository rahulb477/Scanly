// Legacy export/inspection only. No runtime application route imports PostgreSQL.
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
config({ path: ".env.local" });
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL only when inspecting/migrating your legacy PostgreSQL database.");
export default defineConfig({ dialect: "postgresql", schema: "./src/db/schema.ts", dbCredentials: { url: process.env.DATABASE_URL } });
