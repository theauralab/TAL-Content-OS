import { describe, expect, it } from "vitest";
import { generateTempPassword, hashToken, newResetToken } from "@/lib/tokens";
import { credentialsEmail, passwordResetEmail, reviewEmail, sendEmail } from "@/lib/email";

describe("reset tokens", () => {
  it("stores only a hash; the raw token is long, random and unique", () => {
    const a = newResetToken(), b = newResetToken();
    expect(a.raw).not.toBe(b.raw);
    expect(a.raw.length).toBeGreaterThanOrEqual(40);
    expect(a.hash).toBe(hashToken(a.raw));
    expect(a.hash).not.toContain(a.raw);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("temporary passwords", () => {
  it("are 14 chars, avoid look-alike characters, and don't repeat", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const p = generateTempPassword();
      expect(p).toHaveLength(14);
      expect(p).not.toMatch(/[0OIl1]/);
      seen.add(p);
    }
    expect(seen.size).toBe(200);
  });
});

describe("email templates", () => {
  it("escape user-controlled values (client / item names are typed by staff)", () => {
    const evil = `<img src=x onerror=alert(1)>`;
    const c = credentialsEmail({ name: evil, email: "a@b.co", password: "pw<b>", loginUrl: "https://x.test/login", clientName: evil });
    const r = reviewEmail({ name: evil, stage: "PLAN", title: evil, brand: evil, url: "https://x.test/content/1" });
    for (const html of [c.html, r.html]) {
      expect(html).not.toContain("<img");
      expect(html).toContain("&lt;img");
    }
    expect(c.html).not.toContain("pw<b>");
  });
  it("credentials email carries the login URL, email and temp password (also as plain text)", () => {
    const m = credentialsEmail({ name: "Asha Rao", email: "asha@brand.in", password: "Zx9Kp2Qm7Wtn4E", loginUrl: "https://app.test/login", clientName: "Neend" });
    expect(m.subject).toContain("Neend");
    expect(m.text).toContain("https://app.test/login");
    expect(m.text).toContain("Zx9Kp2Qm7Wtn4E");
    expect(m.html).toContain("Asha");
  });
  it("reset email links to the reset page and states the expiry", () => {
    const m = passwordResetEmail({ name: "Asha", resetUrl: "https://app.test/reset-password?token=abc", minutes: 60 });
    expect(m.html).toContain("token=abc");
    expect(m.text).toContain("60 minutes");
  });
});

describe("sendEmail", () => {
  it("reports 'not configured' instead of throwing when there's no API key", async () => {
    const old = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    const r = await sendEmail({ to: "a@b.co", subject: "x", html: "x", text: "x" });
    expect(r).toMatchObject({ ok: false, reason: "not_configured" });
    if (old) process.env.RESEND_API_KEY = old;
  });
});
