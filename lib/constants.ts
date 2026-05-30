import {
  BarChart3,
  Boxes,
  ClipboardList,
  FileSpreadsheet,
  Gauge,
  LineChart,
  Settings,
  ShieldCheck,
  Users,
  Workflow
} from "lucide-react";

export const roles = ["ADMIN", "MANAGER", "USER"] as const;
export const leadStatuses = ["NEW", "ASSIGNED", "CONTACTED", "FOLLOW_UP", "QUOTATION_SENT", "NEGOTIATION", "WON", "LOST"] as const;
export const sourceTypes = ["EXCEL_UPLOAD", "MANUAL_ENTRY"] as const;

export const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge, roles: ["ADMIN", "MANAGER", "USER"] },
  { href: "/tenders", label: "Tenders", icon: ClipboardList, roles: ["ADMIN", "MANAGER", "USER"] },
  { href: "/imports", label: "Imports", icon: FileSpreadsheet, roles: ["ADMIN", "MANAGER", "USER"] },
  { href: "/assignments", label: "Assignments", icon: Workflow, roles: ["ADMIN", "MANAGER"] },
  { href: "/follow-ups", label: "Follow-Ups", icon: BarChart3, roles: ["ADMIN", "MANAGER", "USER"] },
  { href: "/analytics", label: "Analytics", icon: LineChart, roles: ["ADMIN", "MANAGER"] },
  { href: "/contractor-intelligence", label: "Contractors", icon: Boxes, roles: ["ADMIN", "MANAGER"] },
  { href: "/product-intelligence", label: "Products", icon: Boxes, roles: ["ADMIN", "MANAGER"] },
  { href: "/users", label: "Users", icon: Users, roles: ["ADMIN"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["ADMIN"] }
] as const;

export const aiModules = [
  "AI Lead Scoring",
  "AI Tender Summary",
  "AI Contractor Intelligence",
  "AI Auto Assignment"
];
