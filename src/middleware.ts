import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/",
    "/cava/:path*",
    "/login",
    "/registro",
    "/recuperar",
    "/nueva-contrasena",
    "/auth/callback",
    "/auth/reset",
  ],
};
