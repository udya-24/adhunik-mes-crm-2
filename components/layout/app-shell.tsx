"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { navItems } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";
import { useUiStore } from "@/store/ui-store";

export function AppShell({ children, profile }: { children: React.ReactNode; profile: Profile }) {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar, closeSidebar } = useUiStore();
  const items = navItems.filter((item) => (item.roles as readonly string[]).includes(profile.role));

  return (
    <div className="min-h-screen bg-background text-slate-950">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 border-r border-border bg-white px-4 py-5 shadow-soft transition-transform lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">Adhunik</p>
          <h2 className="mt-1 text-lg font-bold text-navy-900">MES Intelligence CRM</h2>
        </div>
        <nav className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeSidebar}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-600",
                  active && "bg-navy-900 text-white",
                  !active && "hover:bg-slate-100 hover:text-navy-900"
                )}
              >
                <Icon size={17} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-white/95 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="px-3 lg:hidden" onClick={toggleSidebar} aria-label="Open menu">
              <Menu size={20} />
            </Button>
            <div>
              <p className="text-sm font-semibold text-navy-900">{profile.full_name || profile.email}</p>
              <p className="text-xs text-slate-500">{profile.role}</p>
            </div>
          </div>
          <form action={logoutAction}>
            <Button variant="secondary">
              <LogOut size={16} />
              Logout
            </Button>
          </form>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
