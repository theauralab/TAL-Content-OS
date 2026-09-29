import Link from "next/link";
import { ForgotForm } from "./forgot-form";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-neutral bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-primary">Forgot your password?</h1>
        <p className="mb-6 text-sm text-primary/60">Enter your email and we&apos;ll send you a link to choose a new one.</p>
        <ForgotForm />
        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="text-primary/70 hover:text-primary hover:underline">← Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}
