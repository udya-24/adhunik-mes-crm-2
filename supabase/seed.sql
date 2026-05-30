-- Create users in Supabase Auth first, then update these IDs to match auth.users.
-- This seed adds representative tender data for local verification.

insert into public.tenders (
  tender_id, organisation_chain, ge, cwe, tender_ref_no, tender_title, contract_date,
  bid_number, bidder_name, currency, awarded_value, contact_number_1, address, make,
  email, our_value, source_type, lead_status
) values
('MES-2026-001','MES Delhi Zone','GE West','CWE Delhi','REF-001','LT Panel Supply and Installation','2026-05-01','BID-7781','Sharma Electricals','INR',1450000,'9810000001','Delhi Cantt','Schneider, HPL','ops@sharma.example',1310000,'EXCEL_UPLOAD','NEW'),
('MES-2026-002','MES Jaipur Zone','GE North','CWE Jaipur','REF-002','Switchgear Replacement Works','2026-05-08','BID-7782','Apex Infra Power','INR',2380000,'9820000002','Jaipur','ABB, Siemens','tenders@apex.example',2200000,'MANUAL_ENTRY','CONTACTED'),
('MES-2026-003','MES Lucknow Zone','GE East','CWE Lucknow','REF-003','Distribution Board Works','2026-05-12','BID-7783','National Electrical Co','INR',985000,'9830000003','Lucknow','Havells, Legrand','sales@national.example',910000,'EXCEL_UPLOAD','WON');
