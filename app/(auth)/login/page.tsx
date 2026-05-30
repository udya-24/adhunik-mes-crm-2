import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#f7f9fc_0%,#eef4ff_55%,#fff7e6_100%)] px-4">
      <section className="w-full max-w-md rounded-lg border border-border bg-white p-8 shadow-soft">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">Adhunik Switchgears</p>
          <h1 className="mt-3 text-2xl font-bold text-navy-900">MES Intelligence CRM</h1>
          <p className="mt-2 text-sm text-slate-600">Secure tender operations, analytics, and sales follow-up workspace.</p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
