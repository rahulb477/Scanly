import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword, createSession } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";

const schemaInput = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  if (!rateLimit(`login:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = schemaInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { email, password } = parsed.data;
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  await createSession(user.id);
  return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
}