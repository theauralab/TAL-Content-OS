import { PasswordForm } from "./password-form";

export default function ChangePasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-xl border border-neutral bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-primary">Set your password</h1>
        <p className="mb-6 text-sm text-primary/60">Choose a password only you know before continuing.</p>
        <PasswordForm />
      </div>
    </main>
  );
}
