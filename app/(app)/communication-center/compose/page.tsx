import { CommunicationCompose } from "@/components/communication-center/communication-compose";
import { getCommunicationCenterData } from "@/lib/communications";
export default async function ComposePage(){const data=await getCommunicationCenterData();return <CommunicationCompose accounts={data.accounts} templates={data.templates.filter(x=>x.is_active)}/>}
