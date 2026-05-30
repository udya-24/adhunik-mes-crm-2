import { createUserAction, toggleUserAction } from "@/app/actions/users";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, inputClass } from "@/components/ui/field";
import { roles } from "@/lib/constants";
import type { Profile } from "@/lib/types";

export function UsersAdmin({ profiles }: { profiles: Profile[] }) {
  const managers = profiles.filter((profile) => profile.role === "MANAGER" && profile.is_active);
  return (
    <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
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
          <label className="flex items-center gap-2 text-sm"><input name="is_active" type="checkbox" defaultChecked /> Active</label>
          <Button>Create Account</Button>
        </form>
      </Card>
      <Card>
        <h2 className="mb-4 text-xl font-bold text-navy-900">Users</h2>
        <div className="space-y-2">
          {profiles.map((profile) => (
            <div key={profile.id} className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <p className="font-semibold text-navy-900">{profile.full_name || profile.email}</p>
                <p className="text-sm text-slate-500">{profile.email} · {profile.role}</p>
              </div>
              <form action={toggleUserAction}>
                <input type="hidden" name="id" value={profile.id} />
                <input type="hidden" name="is_active" value={String(profile.is_active)} />
                <Button variant={profile.is_active ? "danger" : "secondary"}>{profile.is_active ? "Disable" : "Enable"}</Button>
              </form>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
