import { AssignmentTimeline } from "@/components/assignments/assignment-timeline";
import { getAssignmentHistory } from "@/lib/data";

export default async function AssignmentsPage() {
  const history = await getAssignmentHistory();
  return <AssignmentTimeline history={history} />;
}
