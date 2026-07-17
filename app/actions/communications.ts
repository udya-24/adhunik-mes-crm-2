"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CommunicationChannel } from "@/lib/types";

const channels: CommunicationChannel[] = ["EMAIL", "WHATSAPP", "SMS", "NOTIFICATION"];
const text = (value: FormDataEntryValue | null) => String(value ?? "").trim();
function channel(value: FormDataEntryValue | null): CommunicationChannel {
  const result = text(value).toUpperCase() as CommunicationChannel;
  if (!channels.includes(result)) throw new Error("Invalid communication channel.");
  return result;
}
function refresh() { revalidatePath("/communication-center"); }

export async function renameAttachmentAction(id:string,fileName:string){await requireRole(["ADMIN","MANAGER","USER"]);if(!fileName.trim())throw new Error("File name is required.");const {error}=await createAdminClient().from("communication_attachments").update({file_name:fileName.trim()}).eq("id",id);if(error)throw new Error(error.message);revalidatePath("/communication-center/attachments")}
export async function deleteAttachmentAction(id:string){const profile=await requireRole(["ADMIN","MANAGER","USER"]);const supabase=createAdminClient();const query=supabase.from("communication_attachments").delete().eq("id",id);if(profile.role==="USER")query.eq("created_by",profile.id);const {error}=await query;if(error)throw new Error(error.message);revalidatePath("/communication-center/attachments")}

export async function saveTemplateAction(formData: FormData) {
  const profile = await requireRole(["ADMIN", "MANAGER"]);
  const id = text(formData.get("id"));
  const payload = {
    template_name: text(formData.get("template_name")), channel: channel(formData.get("channel")),
    subject: text(formData.get("subject")) || null, body: text(formData.get("body")),
    category: text(formData.get("category")) || "CUSTOM", is_active: formData.get("is_active") === "on"
  };
  if (!payload.template_name || !payload.body) throw new Error("Template name and body are required.");
  const supabase = createAdminClient();
  const result = id ? await supabase.from("communication_templates").update(payload).eq("id", id) : await supabase.from("communication_templates").insert({ ...payload, created_by: profile.id });
  if (result.error) throw new Error(result.error.message);
  refresh();
}

export async function deleteTemplateAction(id: string) {
  await requireRole(["ADMIN", "MANAGER"]);
  const { error } = await createAdminClient().from("communication_templates").delete().eq("id", id);
  if (error) throw new Error(error.message); refresh();
}

export async function duplicateTemplateAction(id: string) {
  const profile = await requireRole(["ADMIN", "MANAGER"]);
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("communication_templates").select("template_name,channel,subject,body,category,is_active").eq("id", id).single();
  if (error) throw new Error(error.message);
  const result = await supabase.from("communication_templates").insert({ ...data, template_name: `${data.template_name} Copy`, created_by: profile.id });
  if (result.error) throw new Error(result.error.message); refresh();
}

export async function saveDraftAction(formData: FormData) {
  const profile = await requireRole(["ADMIN", "MANAGER", "USER"]);
  const id = text(formData.get("id"));
  const payload = { channel: channel(formData.get("channel")), subject: text(formData.get("subject")) || null, body: text(formData.get("body")), to_address: text(formData.get("to_address")) || null, cc: text(formData.get("cc")).split(",").map(x=>x.trim()).filter(Boolean), bcc: text(formData.get("bcc")).split(",").map(x=>x.trim()).filter(Boolean) };
  if (!payload.body) throw new Error("Draft body is required.");
  const supabase = createAdminClient();
  if (id) {
    const { data: draft } = await supabase.from("communication_drafts").select("created_by").eq("id", id).maybeSingle();
    if (!draft || draft.created_by !== profile.id) throw new Error("You can only edit your own drafts.");
  }
  const result = id ? await supabase.from("communication_drafts").update(payload).eq("id", id) : await supabase.from("communication_drafts").insert({ ...payload, created_by: profile.id });
  if (result.error) throw new Error(result.error.message); refresh();
}

export async function duplicateDraftAction(id: string) {
  const profile = await requireRole(["ADMIN", "MANAGER", "USER"]);
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("communication_drafts").select("channel,subject,body,to_address,cc,bcc,attachment_count").eq("id",id).eq("created_by",profile.id).single();
  if(error) throw new Error(error.message);
  const result=await supabase.from("communication_drafts").insert({...data,subject:`${data.subject||"Draft"} Copy`,created_by:profile.id});
  if(result.error) throw new Error(result.error.message); refresh();
}

export async function deleteDraftAction(id: string) {
  const profile = await requireRole(["ADMIN", "MANAGER", "USER"]);
  const { error } = await createAdminClient().from("communication_drafts").delete().eq("id", id).eq("created_by", profile.id);
  if (error) throw new Error(error.message); refresh();
}
