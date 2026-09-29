"use client";

import { useActionState, useEffect, useState } from "react";
import { resetPassword, type AdminResult } from "@/app/(app)/actions/admin";
import { CredentialsCard } from "./credentials-card";

export function ResetPassword({ userId, name, label = "Reset & email password" }: { userId: string; name: string; label?: string }) {
  const [state, action, pending] = useActionState<AdminResult | null, FormData>(resetPassword, null);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  return (
    <div>
      <form
        action={action}
        onSubmit={(e) => {
          if (!window.confirm(`Reset the password for ${name}? Their current password stops working immediately and a new one is emailed to them.`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={userId} />
        <button type="submit" disabled={pending} className="text-primary/70 hover:text-primary hover:underline disabled:opacity-60">
          {pending ? "Sending…" : label}
        </button>
      </form>
      {state && (
        <div className={`mt-2 text-xs ${state.ok ? "text-primary" : "text-danger"}`}>
          {state.emailed && <span className="mr-1 text-success">✓</span>}
          {state.message}
          {state.ok && state.tempPassword && <CredentialsCard email={state.email} password={state.tempPassword} loginUrl={`${origin}/login`} />}
        </div>
      )}
    </div>
  );
}
