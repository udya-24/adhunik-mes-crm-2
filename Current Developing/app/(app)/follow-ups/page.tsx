import { FollowUpBoard } from "@/components/follow-ups/follow-up-board";
import { getFollowUpBuckets } from "@/lib/data";

export default async function FollowUpsPage() {
  const buckets = await getFollowUpBuckets();
  return <FollowUpBoard buckets={buckets} />;
}
