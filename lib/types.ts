import type { roles, sourceTypes } from "@/lib/constants";

export type Role = (typeof roles)[number];
export type SourceType = (typeof sourceTypes)[number];
export type LeadStatus = "NEW" | "ASSIGNED" | "CONTACTED" | "FOLLOW_UP" | "QUOTATION_SENT" | "NEGOTIATION" | "WON" | "LOST";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string;
  role: Role;
  manager_id: string | null;
  is_active: boolean;
  can_access_quotations: boolean;
  can_access_pi: boolean;
  created_at: string;
};

export type QuotationStatus = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED";

export type QuotationItem = {
  id?: string;
  quotation_id?: string;
  ims_master_id?: string | null;
  item_category?: string | null;
  line_no: number;
  item_description: string;
  make?: string | null;
  model?: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  created_at?: string;
};

export type QuotationTerm = {
  id?: string;
  quotation_id?: string;
  term_key: string;
  term_value: string;
  display_order: number;
  created_at?: string;
};

export type Quotation = {
  id: string;
  quotation_no: string;
  quotation_date: string;
  contract_name: string | null;
  customer_name: string;
  address: string | null;
  gst_number: string | null;
  contact_person: string | null;
  mobile_number: string | null;
  email: string | null;
  project_name: string | null;
  tender_reference: string | null;
  header_image_url: string | null;
  signature_designation: string | null;
  status: QuotationStatus;
  gst_percentage: number;
  gst_amount: number;
  grand_total: number;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  creator?: Pick<Profile, "full_name" | "email"> | null;
  items: QuotationItem[];
  terms: QuotationTerm[];
};

export type QuotationInput = Omit<
  Quotation,
  "id" | "project_name" | "tender_reference" | "gst_amount" | "grand_total" | "created_by" | "updated_by" | "created_at" | "updated_at" | "creator"
>;

export type ProformaInvoiceStatus = "DRAFT" | "SENT" | "APPROVED" | "CANCELLED";

export type ProformaInvoiceItem = {
  id?: string;
  proforma_invoice_id?: string;
  ims_master_id?: string | null;
  item_category?: string | null;
  line_no: number;
  item_description: string;
  make?: string | null;
  model_type: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at?: string;
};

export type ProformaInvoiceTerm = {
  id?: string;
  proforma_invoice_id?: string;
  term_key: string;
  term_value: string;
  display_order: number;
  created_at?: string;
};

export type ProformaInvoice = {
  id: string;
  pi_no: string;
  pi_date: string;
  our_ref_no: string | null;
  dp_code: string | null;
  mobile_no: string | null;
  indentor_name: string;
  indentor_address: string | null;
  email: string | null;
  gstin: string | null;
  po_no: string | null;
  po_date: string | null;
  project: string | null;
  status: ProformaInvoiceStatus;
  gst_percentage: number;
  gst_amount: number;
  grand_total: number;
  signature_designation: string | null;
  signature_email: string | null;
  signature_mobile: string | null;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  creator?: Pick<Profile, "full_name" | "email"> | null;
  items: ProformaInvoiceItem[];
  terms: ProformaInvoiceTerm[];
};

export type ProformaInvoiceInput = Omit<
  ProformaInvoice,
  "id" | "gst_amount" | "grand_total" | "created_by" | "updated_by" | "created_at" | "updated_at" | "creator"
>;

export type ImsMasterItem = {
  id: string;
  item_code: string | null;
  item_category: string;
  item_description: string;
  make: string | null;
  model: string | null;
  unit: string | null;
  hsn_code: string | null;
  remarks: string | null;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ImsImportHistory = {
  id: string;
  file_name: string;
  imported_by: string | null;
  rows_imported: number;
  rows_updated: number;
  rows_skipped: number;
  duplicate_rows: number;
  created_at: string;
};

export type ImsItemInput = Omit<ImsMasterItem, "id" | "created_by" | "updated_by" | "created_at" | "updated_at">;

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
  boq_attachment_name: string | null;
  boq_attachment_url: string | null;
  aoc_attachment_name: string | null;
  aoc_attachment_url: string | null;
  tender_document_attachment_name: string | null;
  tender_document_url: string | null;
  our_value: number | null;
  source_type: SourceType;
  uploaded_by: string | null;
  assigned_to: string | null;
  assigned_by: string | null;
  assigned_user_name?: string | null;
  assigned_user_email?: string | null;
  assigned_date?: string | null;
  assigned_profile?: Pick<Profile, "full_name" | "email" | "role"> | null;
  assigned_by_profile?: Pick<Profile, "full_name" | "email" | "role"> | null;
  uploaded_by_profile?: Pick<Profile, "full_name" | "email" | "role"> | null;
  lead_stage?: Pick<LeadStatusMaster, "id" | "status_name" | "status_color" | "sort_order"> | null;
  latest_remark?: string | null;
  last_updated_by_name?: string | null;
  last_activity_date?: string | null;
  lead_status: LeadStatus;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadStatusMaster = {
  id: string;
  status_name: string;
  sort_order: number;
  status_order?: number | null;
  status_color: string;
  is_active: boolean;
  created_at: string;
};

export type LeadRemark = {
  id: string;
  tender_id: string;
  user_id: string;
  remark: string;
  created_at: string;
  tender?: Pick<Tender, "id"> | null;
  user?: Pick<Profile, "full_name" | "email"> | null;
};

export type LeadStatusHistory = {
  id: string;
  tender_id: string;
  status_id: string;
  updated_by: string;
  remarks: string | null;
  created_at: string;
  tender?: Pick<Tender, "id"> | null;
  old_status?: Pick<LeadStatusMaster, "status_name" | "status_color"> | null;
  new_status?: Pick<LeadStatusMaster, "status_name" | "status_color"> | null;
  user?: Pick<Profile, "full_name" | "email"> | null;
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
  boq_attachment_name?: string | null;
  boq_attachment_url?: string | null;
  aoc_attachment_name?: string | null;
  aoc_attachment_url?: string | null;
  tender_document_attachment_name?: string | null;
  tender_document_url?: string | null;
  our_value?: number | null;
};

export type TenderUpdateInput = ManualTenderInsert & {
  id: string;
  assigned_to?: string | null;
};

export type AuditLog = {
  id: string;
  table_name?: string | null;
  record_id?: string | null;
  user_id: string | null;
  action?: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
  user_name?: string | null;
};

export type LeadAssignment = {
  id: string;
  tender_id: string;
  assigned_to: string;
  assigned_by: string;
  assigned_date: string;
  remarks: string | null;
  tender?: Pick<Tender, "tender_id" | "bidder_name" | "ge" | "cwe" | "contract_date"> | null;
  assignee?: Pick<Profile, "full_name" | "email" | "role"> | null;
  assigner?: Pick<Profile, "full_name" | "email" | "role"> | null;
};

export type TenderFollowUp = {
  id: string;
  tender_id: string;
  user_id: string;
  follow_up_date: string;
  remarks: string;
  status: string;
  created_at: string;
  user?: Pick<Profile, "full_name" | "email"> | null;
};

export type StatusSummaryRow = {
  status_id: string | null;
  status_name: string;
  status_color: string | null;
  sort_order: number | null;
  tender_count: number;
  our_value: number;
  awarded_value: number;
};

export type OperationalSummaryRow = {
  status: "ASSIGNED" | "OPEN_POOL";
  count: number;
};

export type PipelineSummaryRow = {
  stage: LeadStatus;
  count: number;
};

export type LeadActivity = {
  id: string;
  tender_id: string;
  user_id: string;
  activity_type: string;
  activity_notes: string | null;
  created_at: string;
  user?: Pick<Profile, "full_name" | "email"> | null;
};

export type DashboardMetrics = {
  totalTenders: number;
  totalTenderValue: number;
  totalOurValue: number;
  assignedLeads: number;
  unassignedLeads: number;
  assignedOurValue: number;
  unassignedOurValue: number;
  myOurValue: number;
  showMyOurValue: boolean;
  wonLeads: number;
  lostLeads: number;
  quotationSentValue: number;
  negotiationValue: number;
  piPendingValue: number;
  orderReceivedValue: number;
  lostLeadValue: number;
};

export type AnalyticsBreakdownRow = {
  name: string;
  count: number;
  value: number;
  ourValue: number;
  won: number;
  lost: number;
};

export type MonthlyTrendRow = {
  name: string;
  count: number;
  value: number;
  ourValue: number;
};

export type AgeingBucket = {
  name: string;
  count: number;
  ourValue: number;
  awardedValue: number;
};

export type UserPerformanceRow = {
  userId: string;
  userName: string;
  role: Role;
  assignedTenders: number;
  uploadedTenders: number;
  followUps: number;
  assignedOurValue: number;
  convertedTenders: number;
};

export type AnalyticsBreakdowns = {
  ge: AnalyticsBreakdownRow[];
  cwe: AnalyticsBreakdownRow[];
  contractDate: AnalyticsBreakdownRow[];
  bidder: AnalyticsBreakdownRow[];
  user: AnalyticsBreakdownRow[];
  ourValueByUser: AnalyticsBreakdownRow[];
  ourValueByGE: AnalyticsBreakdownRow[];
  ourValueByContractor: AnalyticsBreakdownRow[];
  monthlyOurValueTrend: MonthlyTrendRow[];
  ageing: AgeingBucket[];
  leadStageDistribution: AnalyticsBreakdownRow[];
  lostLeadsByReason: AnalyticsBreakdownRow[];
  competitorAnalysis: AnalyticsBreakdownRow[];
  userWiseConversion: AnalyticsBreakdownRow[];
  managerWiseConversion: AnalyticsBreakdownRow[];
  salesFunnel: AnalyticsBreakdownRow[];
};
