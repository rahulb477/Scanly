import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  allowedDevOrigins: ["localhost", "127.0.0.1", "*.e2b.app"],
  async rewrites() {
    const routes = [{ source: "/dashboard/:path*", destination: "/admin/:path*" }];
    if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true" && process.env.FIREBASE_PROJECT_ID?.startsWith("demo-")) {
      routes.push(
        { source: "/identitytoolkit.googleapis.com/:path*", destination: "http://127.0.0.1:9099/identitytoolkit.googleapis.com/:path*" },
        { source: "/securetoken.googleapis.com/:path*", destination: "http://127.0.0.1:9099/securetoken.googleapis.com/:path*" },
        { source: "/emulator/auth/:path*", destination: "http://127.0.0.1:9099/emulator/auth/:path*" },
        { source: "/google.firestore.v1.Firestore/:path*", destination: "http://127.0.0.1:8080/google.firestore.v1.Firestore/:path*" },
        { source: "/v1/projects/:path*", destination: "http://127.0.0.1:8080/v1/projects/:path*" },
        { source: "/v0/b/:path*", destination: "http://127.0.0.1:9199/v0/b/:path*" },
      );
    }
    return routes;
  },
};
export default nextConfig;
