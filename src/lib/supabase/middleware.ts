import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

const AUTH_PATHS = new Set(["/login", "/signup", "/forgot-password", "/reset-password", "/auth/callback"]);

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = getSupabaseEnv();

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = path === "/app" || path.startsWith("/app/");
  const isAuthPath = AUTH_PATHS.has(path);

  if (!user && isProtected) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.searchParams.set("next", `${path}${request.nextUrl.search}`);
    return NextResponse.redirect(redirect);
  }

  if (user && isAuthPath && path !== "/auth/callback" && path !== "/reset-password") {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/app";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
