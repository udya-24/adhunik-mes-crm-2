import { CommunicationCenter } from "@/components/communication-center/communication-center";
import { getCurrentProfile } from "@/lib/auth";
import { getCommunicationCenterData } from "@/lib/communications";

export default async function CommunicationCenterPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const data = await getCommunicationCenterData();
  return <CommunicationCenter profile={profile} data={data} />;
}
