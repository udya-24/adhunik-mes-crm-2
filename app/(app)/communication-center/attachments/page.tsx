import { AttachmentLibrary } from "@/components/communication-center/attachment-library";
import { getCurrentProfile } from "@/lib/auth";
import { getCommunicationCenterData } from "@/lib/communications";
export default async function AttachmentsPage(){const [profile,data]=await Promise.all([getCurrentProfile(),getCommunicationCenterData()]);if(!profile)return null;return <AttachmentLibrary files={data.attachments} profile={profile}/>}
