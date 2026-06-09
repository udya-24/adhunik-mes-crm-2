"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Bell, ChevronsLeft, ChevronsRight, LogOut, Menu, Search } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { navItems } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";
import { useUiStore } from "@/store/ui-store";

export function AppShell({ children, profile }: { children: React.ReactNode; profile: Profile }) {
  const pathname = usePathname();
  const { sidebarOpen, sidebarCollapsed, toggleSidebar, closeSidebar, setSidebarCollapsed } = useUiStore();
  const items = navItems.filter((item) => (item.roles as readonly string[]).includes(profile.role));

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
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 border-r border-border bg-white px-4 py-5 shadow-soft transition-all duration-300 lg:translate-x-0",
          sidebarCollapsed ? "w-20" : "w-72",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className={cn("mb-6 rounded-2xl bg-navy-900 p-4 text-white shadow-lift", sidebarCollapsed && "grid place-items-center px-2")}>
          {sidebarCollapsed ? (
            <p className="text-lg font-bold text-amber-300" title="Adhunik MES Intelligence CRM">A</p>
          ) : (
            <>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">Adhunik</p>
              <h2 className="mt-1 text-lg font-bold">MES Intelligence CRM</h2>
              <p className="mt-2 text-xs text-navy-100">Tender command center</p>
            </>
          )}
        </div>
        <Button variant="secondary" className={cn("mb-4 h-9 w-full", sidebarCollapsed && "px-0")} onClick={toggleCollapsed} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
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
                  "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-600 transition",
                  sidebarCollapsed && "justify-center px-0",
                  active && "bg-navy-50 text-navy-900 ring-1 ring-navy-100",
                  !active && "hover:bg-slate-50 hover:text-navy-900"
                )}
              >
                <Icon size={17} />
                {!sidebarCollapsed && item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className={cn("transition-all duration-300", sidebarCollapsed ? "lg:pl-20" : "lg:pl-72")}>
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-4 border-b border-border bg-white/90 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="px-3 lg:hidden" onClick={toggleSidebar} aria-label="Open menu">
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
        <main className="mx-auto w-full max-w-[1800px] px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
