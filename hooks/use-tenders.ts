"use client";

import { useQuery } from "@tanstack/react-query";
import { tenderQueryKeys } from "@/lib/queries/tenders";
import { createClient } from "@/lib/supabase/client";
import type { Tender } from "@/lib/types";

export function useTenders() {
  return useQuery({
    queryKey: tenderQueryKeys.all,
    queryFn: async () => {
      const supabase = createClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();

      const { data: profile, error: profileError } = user
        ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
        : { data: null, error: null };

      if (profileError) {
        console.error("[useTenders] profile lookup error", profileError);
      }

      const query = supabase.from("tenders").select("*").order("created_at", { ascending: false });
      const { data, error } = await query;

      console.log("[useTenders] returned rows count", data?.length ?? 0);
      console.log("[useTenders] Supabase error object", error);
      console.log("[useTenders] role", profile?.role ?? "UNKNOWN");

      if (error) throw new Error(error.message);
      return (data ?? []) as Tender[];
    }
  });
}
