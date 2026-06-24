import { createUserAction, toggleQuotationAccessAction, toggleUserAction } from "@/app/actions/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, inputClass } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { roles } from "@/lib/constants";
import type { Profile, Role } from "@/lib/types";
import { ShieldCheck, UsersRound } from "lucide-react";

export function UsersAdmin({ profiles, currentUserRole }: { profiles: Profile[]; currentUserRole: Role }) {
  const canManageUsers = currentUserRole === "ADMIN";
  const managers = profiles.filter((profile) => profile.role === "MANAGER" && profile.is_active);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={canManageUsers ? "Admin" : "Team"} title="Team Management" description={canManageUsers ? "Create users, manage role access, and keep the tender team operational." : "View active roles and account status across the tender team."} />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <UsersRound className="text-navy-700" size={22} />
          <p className="mt-3 text-2xl font-bold text-navy-900">{profiles.length}</p>
          <p className="text-sm text-slate-600">Total team members</p>
        </Card>
        <Card>
          <ShieldCheck className="text-amber-600" size={22} />
          <p className="mt-3 text-2xl font-bold text-navy-900">{profiles.filter((profile) => profile.is_active).length}</p>
          <p className="text-sm text-slate-600">Active accounts</p>
        </Card>
        <Card>
          <UsersRound className="text-orange-600" size={22} />
          <p className="mt-3 text-2xl font-bold text-navy-900">{managers.length}</p>
          <p className="text-sm text-slate-600">Managers</p>
        </Card>
      </div>

      <div className={canManageUsers ? "grid gap-6 xl:grid-cols-[0.8fr_1.2fr]" : "grid gap-6"}>
        {canManageUsers ? (
          <Card>
            <h1 className="text-xl font-bold text-navy-900">Create User</h1>
            <form action={createUserAction} className="mt-5 grid gap-4">
              <Field label="Full Name"><input name="full_name" className={inputClass} required /></Field>
              <Field label="Email"><input name="email" type="email" className={inputClass} required /></Field>
              <Field label="Password"><input name="password" type="password" className={inputClass} required /></Field>
              <Field label="Role">
                <select name="role" className={inputClass}>{roles.map((role) => <option key={role}>{role}</option>)}</select>
              </Field>
              <Field label="Manager">
                <select name="manager_id" className={inputClass}>
                  <option value="">None</option>
                  {managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.full_name || manager.email}</option>)}
                </select>
              </Field>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input name="is_active" type="checkbox" defaultChecked /> Active</label>
              <Button>Create Account</Button>
            </form>
          </Card>
        ) : null}

        <Card>
          <h2 className="mb-4 text-xl font-bold text-navy-900">Team Cards</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {profiles.map((profile) => (
              <div key={profile.id} className="rounded-xl border border-border bg-slate-50 p-4">
                <div>
                  <p className="font-semibold text-navy-900">{profile.full_name || profile.email}</p>
                  <p className="text-sm text-slate-500">{profile.email}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone={profile.role === "ADMIN" ? "blue" : profile.role === "MANAGER" ? "amber" : "slate"}>{profile.role}</Badge>
                    <Badge tone={profile.is_active ? "green" : "red"}>{profile.is_active ? "Active" : "Disabled"}</Badge>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div className="rounded-lg bg-white p-2 ring-1 ring-border">
                    <p className="font-bold text-navy-900">0</p>
                    <p>Assigned</p>
                  </div>
                  <div className="rounded-lg bg-white p-2 ring-1 ring-border">
                    <p className="font-bold text-navy-900">0%</p>
                    <p>Win rate</p>
                  </div>
                </div>
                {canManageUsers ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <form action={toggleUserAction}>
                      <input type="hidden" name="id" value={profile.id} />
                      <input type="hidden" name="is_active" value={String(profile.is_active)} />
                      <Button variant={profile.is_active ? "danger" : "secondary"}>{profile.is_active ? "Disable" : "Enable"}</Button>
                    </form>
                    {profile.role === "USER" ? (
                      <form action={toggleQuotationAccessAction}>
                        <input type="hidden" name="id" value={profile.id} />
                        <input type="hidden" name="has_access" value={String(profile.can_access_quotations)} />
                        <Button variant="secondary">
                          {profile.can_access_quotations ? "Revoke Quotations" : "Grant Quotations"}
                        </Button>
                      </form>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
