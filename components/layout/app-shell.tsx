"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Bell, ChevronsLeft, ChevronsRight, LogOut, Menu, Search, X } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { navItems } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";
import { useUiStore } from "@/store/ui-store";

export function AppShell({ children, profile }: { children: React.ReactNode; profile: Profile }) {
  const pathname = usePathname();
  const { sidebarOpen, sidebarCollapsed, toggleSidebar, closeSidebar, setSidebarCollapsed } = useUiStore();
  const items = navItems.filter(
    (item) =>
      (item.roles as readonly string[]).includes(profile.role) &&
      (item.href !== "/quotations" || profile.role !== "USER" || profile.can_access_quotations) &&
      (item.href !== "/proforma-invoices" || profile.role !== "USER" || profile.can_access_pi)
  );

  useEffect(() => {
    setSidebarCollapsed(localStorage.getItem("adhunik-sidebar-collapsed") === "true");
  }, [setSidebarCollapsed]);

  function toggleCollapsed() {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem("adhunik-sidebar-collapsed", String(next));
  }

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <div
        className={cn("fixed inset-0 z-30 bg-slate-950/40 transition-opacity lg:hidden", sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0")}
        onClick={closeSidebar}
        aria-hidden="true"
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[min(20rem,86vw)] border-r border-border bg-white px-4 py-5 shadow-soft transition-all duration-300 lg:translate-x-0",
          sidebarCollapsed ? "lg:w-20" : "lg:w-72",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
          <p className="text-sm font-bold text-navy-900">Menu</p>
          <Button variant="ghost" className="h-11 w-11 rounded-full px-0" onClick={closeSidebar} aria-label="Close menu">
            <X size={18} />
          </Button>
        </div>
        <div className={cn("mb-6 rounded-2xl bg-navy-900 p-4 text-white shadow-lift", sidebarCollapsed && "lg:grid lg:place-items-center lg:px-2")}>
          {sidebarCollapsed ? (
            <>
              <p className="hidden text-lg font-bold text-amber-300 lg:block" title="Adhunik MES Intelligence CRM">A</p>
              <div className="lg:hidden">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">Adhunik</p>
                <h2 className="mt-1 text-lg font-bold">MES Intelligence CRM</h2>
                <p className="mt-2 text-xs text-navy-100">Tender command center</p>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">Adhunik</p>
              <h2 className="mt-1 text-lg font-bold">MES Intelligence CRM</h2>
              <p className="mt-2 text-xs text-navy-100">Tender command center</p>
            </>
          )}
        </div>
        <Button variant="secondary" className={cn("mb-4 hidden h-9 w-full lg:inline-flex", sidebarCollapsed && "px-0")} onClick={toggleCollapsed} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {sidebarCollapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          {!sidebarCollapsed && "Collapse"}
        </Button>
        <nav className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeSidebar}
                title={sidebarCollapsed ? item.label : undefined}
                className={cn(
                  "flex h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-600 transition lg:h-11",
                  sidebarCollapsed && "lg:justify-center lg:px-0",
                  active && "bg-navy-50 text-navy-900 ring-1 ring-navy-100",
                  !active && "hover:bg-slate-50 hover:text-navy-900"
                )}
              >
                <Icon size={17} />
                <span className={cn(sidebarCollapsed && "lg:hidden")}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className={cn("transition-all duration-300", sidebarCollapsed ? "lg:pl-20" : "lg:pl-72")}>
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-4 border-b border-border bg-white/90 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="h-11 w-11 px-0 lg:hidden" onClick={toggleSidebar} aria-label="Open menu">
              <Menu size={20} />
            </Button>
            <div>
              <p className="text-sm font-semibold text-navy-900">{profile.full_name || profile.email}</p>
              <p className="text-xs text-slate-500">{profile.role}</p>
            </div>
          </div>
          <div className="hidden flex-1 justify-center md:flex">
            <label className="relative w-full max-w-md">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input className="h-10 w-full rounded-full border border-border bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-navy-500 focus:bg-white focus:ring-4 focus:ring-navy-100" placeholder="Search tenders, contractors, GE, CWE" />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" className="h-10 w-10 rounded-full px-0" aria-label="Notifications">
              <Bell size={16} />
            </Button>
            <form action={logoutAction}>
              <Button variant="secondary">
                <LogOut size={16} />
                Logout
              </Button>
            </form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1800px] overflow-x-hidden px-3 py-4 sm:px-4 sm:py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
