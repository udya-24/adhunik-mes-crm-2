import { UsersAdmin } from "@/components/users/users-admin";
import { requireRole } from "@/lib/auth";
import { getProfiles } from "@/lib/data";

export default async function UsersPage() {
  await requireRole(["ADMIN"]);
  const profiles = await getProfiles();
  return <UsersAdmin profiles={profiles} />;
}
