import { cookies } from "next/headers";
import { db } from "@/db";
import { sessions, users, businessMembers, businesses } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";

const SESSION_COOKIE = "qr_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const id = nanoid();
  const token = nanoid(48);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db.insert(sessions).values({ id, userId, token, expiresAt });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.token, token));
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.token, token))
    .limit(1);

  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.token, token));
    return null;
  }
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

export async function getBusinessesForUser(userId: string) {
  // owner of a business OR member
  const owned = await db
    .select()
    .from(businesses)
    .where(eq(businesses.ownerId, userId));

  const membered = await db
    .select({
      business: businesses,
      role: businessMembers.role,
    })
    .from(businessMembers)
    .innerJoin(
      businesses,
      eq(businesses.id, businessMembers.businessId)
    )
    .where(eq(businessMembers.userId, userId));

  const all = new Map<string, (typeof businesses)["$inferSelect"] & { memberRole?: string }>();
  for (const b of owned) all.set(b.id, b);
  for (const m of membered) {
    if (!all.has(m.business.id)) {
      all.set(m.business.id, { ...m.business, memberRole: m.role });
    } else {
      const existing = all.get(m.business.id)!;
      all.set(m.business.id, { ...existing, memberRole: m.role });
    }
  }
  return Array.from(all.values());
}

export async function userCanAccessBusiness(
  userId: string,
  businessId: string
) {
  const [owned] = await db
    .select()
    .from(businesses)
    .where(and(eq(businesses.id, businessId), eq(businesses.ownerId, userId)))
    .limit(1);
  if (owned) return { business: owned, role: "owner" as const };

  const [member] = await db
    .select({
      business: businesses,
      role: businessMembers.role,
    })
    .from(businessMembers)
    .innerJoin(
      businesses,
      eq(businesses.id, businessMembers.businessId)
    )
    .where(
      and(
        eq(businessMembers.userId, userId),
        eq(businessMembers.businessId, businessId)
      )
    )
    .limit(1);

  if (member) return { business: member.business, role: member.role };
  return null;
}

export async function requireBusinessAccess(userId: string, businessId: string) {
  const result = await userCanAccessBusiness(userId, businessId);
  if (!result) throw new Error("FORBIDDEN");
  return result;
}
