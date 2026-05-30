import type { leadStatuses, roles, sourceTypes } from "@/lib/constants";

export type Role = (typeof roles)[number];
export type LeadStatus = (typeof leadStatuses)[number];
export type SourceType = (typeof sourceTypes)[number];

export type Profile = {
  id: string;
  full_name: string | null;
  email: string;
  role: Role;
  manager_id: string | null;
  is_active: boolean;
  created_at: string;
};

export type Tender = {
  id: string;
  tender_id: string;
  organisation_chain: string | null;
  ge: string | null;
  cwe: string | null;
  tender_ref_no: string | null;
  tender_title: string | null;
  contract_date: string | null;
  bid_number: string | null;
  bidder_name: string | null;
  currency: string | null;
  awarded_value: number | null;
  contact_number_1: string | null;
  contact_number_2: string | null;
  contact_number_3: string | null;
  address: string | null;
  make: string | null;
  email: string | null;
  boq_attachment_url: string | null;
  aoc_attachment_url: string | null;
  tender_document_url: string | null;
  our_value: number | null;
  source_type: SourceType;
  uploaded_by: string | null;
  assigned_to: string | null;
  assigned_by: string | null;
  lead_status: LeadStatus;
  created_at: string;
  updated_at: string;
  assigned_profile?: Pick<Profile, "full_name" | "email"> | null;
};

export type ManualTenderInsert = {
  tender_id: string;
  organisation_chain?: string | null;
  ge?: string | null;
  cwe?: string | null;
  tender_ref_no?: string | null;
  tender_title: string;
  contract_date?: string | null;
  bid_number?: string | null;
  bidder_name?: string | null;
  currency?: string | null;
  awarded_value?: number | null;
  contact_number_1?: string | null;
  contact_number_2?: string | null;
  contact_number_3?: string | null;
  address?: string | null;
  make?: string | null;
  email?: string | null;
  boq_attachment_url?: string | null;
  aoc_attachment_url?: string | null;
  tender_document_url?: string | null;
  our_value?: number | null;
};

export type DashboardMetrics = {
  totalTenders: number;
  totalTenderValue: number;
  assignedLeads: number;
  unassignedLeads: number;
  wonLeads: number;
  lostLeads: number;
};
