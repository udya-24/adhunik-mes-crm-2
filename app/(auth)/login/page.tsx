import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-white shadow-lift lg:grid-cols-[1.1fr_0.9fr]">
        <div className="hidden bg-navy-900 p-10 text-white lg:block">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">MES CRM</p>
          <h2 className="mt-4 text-4xl font-bold leading-tight">Enterprise tender intelligence for Adhunik teams.</h2>
          <div className="mt-10 grid gap-3">
            {["Pipeline visibility", "Assignment governance", "Follow-up discipline", "Contractor intelligence"].map((item) => (
              <div key={item} className="rounded-xl bg-white/10 p-4 text-sm font-semibold text-navy-50">{item}</div>
            ))}
          </div>
        </div>
        <div className="p-8">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">Adhunik Switchgears</p>
          <h1 className="mt-3 text-2xl font-bold text-navy-900">MES Intelligence CRM</h1>
          <p className="mt-2 text-sm text-slate-600">Secure tender operations, analytics, and sales follow-up workspace.</p>
        </div>
        <LoginForm />
        </div>
      </section>
    </main>
  );
}
