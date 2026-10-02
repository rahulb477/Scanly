import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createSession } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { nanoid } from "nanoid";

const schemaInput = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(200).optional(),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  if (!rateLimit(`register:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = schemaInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }
  const email = parsed.data.email.toLowerCase();
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }
  const passwordHash = await hashPassword(parsed.data.password);
  const id = nanoid();
  await db.insert(users).values({
    id,
    email,
    name: parsed.data.name || null,
    passwordHash,
    role: "owner",
  });
  await createSession(id);
  return NextResponse.json({ ok: true });
}