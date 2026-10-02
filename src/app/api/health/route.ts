import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { apiErrorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    getAdminAuth();
    // A real read checks credential/service access; initialization alone is not connectivity.
    await getAdminDb().collection("_health").doc("connectivity").get();
    return Response.json(process.env.NODE_ENV === "development" ? { ok: true, configurationLoaded: true, authInitialized: true, firestoreInitialized: true, firestoreReachable: true } : { ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
