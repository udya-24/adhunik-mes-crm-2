import type { Profile } from "@/lib/types";

export function formatProfileDisplayName(profile?: Pick<Profile, "full_name" | "email"> | null) {
  return profile?.full_name || profile?.email || "Unknown User";
}
