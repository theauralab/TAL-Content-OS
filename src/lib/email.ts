import { Resend } from "resend";

/** Public base URL used in links inside emails. Set NEXT_PUBLIC_APP_URL in production. */
export function appUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY);

// Resend can only send from a domain you've verified with them (resend.com/domains) — it will
// never deliver "from" a Gmail/Yahoo/Outlook address, since you don't control that domain's DNS.
// Catching that here turns a confusing 403 from the API into a message that says exactly what to fix.
const FREEMAIL_DOMAINS = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "live.com", "aol.com"];
function fromDomainProblem(from: string): string | null {
  const match = from.match(/@([^\s>]+)/);
  const domain = match?.[1]?.toLowerCase();
  if (domain && FREEMAIL_DOMAINS.includes(domain)) {
    return `EMAIL_FROM is set to an address on ${domain}, which Resend can never send from (you don't control that domain's DNS). Verify your own domain at resend.com/domains, then set EMAIL_FROM to an address on it — e.g. "The Aura Lab <hello@theauralab.com>". Until then, leave EMAIL_FROM unset to use the working default: The Aura Lab <onboarding@resend.dev>.`;
  }
  return null;
}

export type EmailResult =
  | { ok: true }
  | { ok: false; reason: "not_configured" | "bad_from_domain" | "failed"; message: string };

let client: Resend | null = null;

/** Never throws — an email problem must not undo the thing that triggered it. */
export async function sendEmail(p: { to: string; subject: string; html: string; text: string }): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, reason: "not_configured", message: "Email isn't configured (RESEND_API_KEY is missing)" };
  const from = process.env.EMAIL_FROM || "The Aura Lab <onboarding@resend.dev>";
  const domainProblem = fromDomainProblem(from);
  if (domainProblem) return { ok: false, reason: "bad_from_domain", message: domainProblem };
  client ??= new Resend(key);
  try {
    const { error } = await client.emails.send({
      from,
      to: p.to,
      subject: p.subject,
      html: p.html,
      text: p.text,
    });
    if (error) return { ok: false, reason: "failed", message: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "failed", message: e instanceof Error ? e.message : "Email failed to send" };
  }
}

// ---------- Templates ----------

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function layout(heading: string, inner: string) {
  return `<!doctype html><html><body style="margin:0;background:#FFFDF7;font-family:Inter,Arial,sans-serif;color:#002A38">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border:1px solid #D8D9DE;border-radius:12px">
<tr><td style="padding:28px 28px 8px;font-size:13px;font-weight:600;letter-spacing:.02em;color:#85B4A1">THE AURA LAB</td></tr>
<tr><td style="padding:0 28px 4px;font-size:20px;font-weight:600">${esc(heading)}</td></tr>
<tr><td style="padding:12px 28px 28px;font-size:14px;line-height:1.6">${inner}</td></tr>
</table>
<p style="font-size:12px;color:#8a8f98;margin:16px 0 0">Sent by The Aura Lab Content OS</p>
</td></tr></table></body></html>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:20px 0"><a href="${esc(href)}" style="background:#002A38;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;display:inline-block">${esc(label)}</a></p>`;

export function credentialsEmail(p: { name: string; email: string; password: string; loginUrl: string; clientName?: string | null; reset?: boolean }) {
  const first = p.name.split(" ")[0] || p.name;
  const intro = p.reset
    ? "Your password was reset by The Aura Lab. Use the temporary password below to sign in."
    : p.clientName
      ? `Your workspace for <strong>${esc(p.clientName)}</strong> is ready. This is where you'll review and approve scripts, captions and finished creatives.`
      : "Your account is ready.";
  const html = layout(
    p.reset ? "Your password was reset" : "Your login is ready",
    `<p>Hi ${esc(first)},</p><p>${intro}</p>
<table role="presentation" style="background:#FFFDF7;border:1px solid #D8D9DE;border-radius:8px;padding:12px 16px;margin:12px 0;font-size:14px">
<tr><td style="color:#6b7280;padding:2px 12px 2px 0">Email</td><td><strong>${esc(p.email)}</strong></td></tr>
<tr><td style="color:#6b7280;padding:2px 12px 2px 0">Temporary password</td><td><strong style="font-family:Menlo,Consolas,monospace;font-size:15px">${esc(p.password)}</strong></td></tr>
</table>${button(p.loginUrl, "Sign in")}
<p style="font-size:13px;color:#6b7280">You'll be asked to choose your own password the first time you sign in. If you weren't expecting this email, you can ignore it.</p>`,
  );
  const text = `Hi ${first},\n\n${p.reset ? "Your password was reset by The Aura Lab." : p.clientName ? `Your workspace for ${p.clientName} is ready.` : "Your account is ready."}\n\nSign in: ${p.loginUrl}\nEmail: ${p.email}\nTemporary password: ${p.password}\n\nYou'll be asked to choose your own password on first sign-in.\n`;
  return { subject: p.reset ? "Your Aura Lab password was reset" : p.clientName ? `Your ${p.clientName} workspace on The Aura Lab` : "Your Aura Lab login", html, text };
}

export function passwordResetEmail(p: { name: string; resetUrl: string; minutes: number }) {
  const first = p.name.split(" ")[0] || p.name;
  const html = layout(
    "Reset your password",
    `<p>Hi ${esc(first)},</p><p>We got a request to reset your password. This link works once and expires in ${p.minutes} minutes.</p>
${button(p.resetUrl, "Choose a new password")}
<p style="font-size:13px;color:#6b7280">If you didn't ask for this, ignore this email — your password won't change.</p>`,
  );
  const text = `Hi ${first},\n\nReset your password (link works once, expires in ${p.minutes} minutes):\n${p.resetUrl}\n\nIf you didn't ask for this, ignore this email.\n`;
  return { subject: "Reset your Aura Lab password", html, text };
}

export function reviewEmail(p: { name: string; stage: "PLAN" | "CREATIVE"; title: string; brand: string; url: string }) {
  const first = p.name.split(" ")[0] || p.name;
  const what = p.stage === "PLAN" ? "script and caption" : "final creative";
  const html = layout(
    p.stage === "PLAN" ? "New plan to review" : "Your creative is ready",
    `<p>Hi ${esc(first)},</p><p>The ${what} for <strong>${esc(p.title)}</strong> (${esc(p.brand)}) is ready for your review.</p>
${button(p.url, "Review now")}
<p style="font-size:13px;color:#6b7280">You can approve it or request changes — either takes a minute.</p>`,
  );
  const text = `Hi ${first},\n\nThe ${what} for "${p.title}" (${p.brand}) is ready for your review:\n${p.url}\n`;
  return { subject: `${p.stage === "PLAN" ? "Review" : "Approve"}: ${p.title} (${p.brand})`, html, text };
}
