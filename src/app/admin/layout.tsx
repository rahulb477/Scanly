import { redirect } from "next/navigation";
import { getCurrentUser, getBusinessesForUser } from "@/lib/auth";
import { AdminShell } from "./AdminShell";
import { AuthGuard } from "@/components/auth/AuthGuard";

export const dynamic = "force-dynamic";
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const businesses = await getBusinessesForUser(user.uid);
  return <AuthGuard><AdminShell user={user} businesses={businesses}>{children}</AdminShell></AuthGuard>;
}
