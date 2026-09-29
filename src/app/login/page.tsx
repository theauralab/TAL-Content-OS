import Link from "next/link";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; reset?: string }>;
}) {
  const sp = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-xl border border-neutral p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-primary">The Aura Lab Content OS</h1>
        <p className="mb-6 text-sm text-neutral-500">Sign in to your workspace</p>

        {sp.reset === "1" && (
          <p role="status" className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
            Password updated. Sign in with your new password.
          </p>
        )}
        {sp.error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-danger">
            {sp.error === "disabled" ? "This account has been deactivated. Contact The Aura Lab." : "Invalid email or password."}
          </p>
        )}

        <form
          action={async (formData) => {
            "use server";
            try {
              await signIn("credentials", {
                email: formData.get("email"),
                password: formData.get("password"),
                redirectTo: sp.callbackUrl || "/dashboard",
              });
            } catch (error) {
              if (error instanceof AuthError) redirect("/login?error=1");
              throw error;
            }
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="email" className="mb-1 block text-sm text-primary">Email</label>
            <input
              id="email"
              name="email"
              autoComplete="email"
              type="email"
              required
              className="w-full rounded-md border border-neutral px-3 py-2 text-sm outline-none focus:border-secondary"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="password" className="text-sm text-primary">Password</label>
              <Link href="/forgot-password" className="text-xs text-primary/60 hover:text-primary hover:underline">Forgot password?</Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full rounded-md border border-neutral px-3 py-2 text-sm outline-none focus:border-secondary"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-primary py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
