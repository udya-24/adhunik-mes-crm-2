import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { canAccessProformaInvoices, canAccessQuotations, canAccessRoute } from "@/lib/permissions";
import type { Role } from "@/lib/types";

export async function updateSession(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user && !request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role,is_active,can_access_quotations,can_access_pi")
      .eq("id", user.id)
      .maybeSingle();

    const quotationDenied =
      request.nextUrl.pathname.startsWith("/quotations") &&
      profile?.is_active &&
      !canAccessQuotations({
        role: profile.role as Role,
        can_access_quotations: Boolean(profile.can_access_quotations)
      });
    const piDenied =
      request.nextUrl.pathname.startsWith("/proforma-invoices") &&
      profile?.is_active &&
      !canAccessProformaInvoices({
        role: profile.role as Role,
        can_access_pi: Boolean(profile.can_access_pi)
      });

    if (profile?.is_active && (!canAccessRoute(request.nextUrl.pathname, profile.role as Role) || quotationDenied || piDenied)) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
