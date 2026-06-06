"use client";

import { useFormStatus } from "react-dom";
import { LogIn } from "lucide-react";
import { loginAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button className="w-full" disabled={pending}>
      <LogIn size={16} />
      {pending ? "Signing in..." : "Sign in"}
    </Button>
  );
}

export function LoginForm() {
  return (
    <form action={loginAction} className="space-y-4">
      <Field label="Email">
        <input name="email" type="email" required className={inputClass} placeholder="admin@adhunik.com" />
      </Field>
      <Field label="Password">
        <input name="password" type="password" required className={inputClass} placeholder="••••••••" />
      </Field>
      <SubmitButton />
    </form>
  );
}
