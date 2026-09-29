"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Pusher from "pusher-js";

const NAV = [
  { href: "/dashboard", label: "Dashboard", roles: "all" },
  { href: "/clients", label: "Clients", roles: "all" },
  { href: "/approvals", label: "Approvals", roles: "all" },
  { href: "/chat", label: "Chat", roles: "all" },
  { href: "/admin", label: "Admin panel", roles: ["SUPER_ADMIN", "AGENCY_MANAGER"] },
  { href: "/admin/users", label: "Logins & team", roles: ["SUPER_ADMIN", "AGENCY_MANAGER"] },
] as const;

function NavLinks({ role, unreadChatCount, onNavigate }: { role: string; unreadChatCount: number; onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = NAV.filter((n) => n.roles === "all" || (n.roles as readonly string[]).includes(role));
  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${active ? "bg-primary text-white" : "text-primary hover:bg-background"}`}
          >
            {item.label}
            {item.href === "/chat" && unreadChatCount > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${active ? "bg-white/20 text-white" : "bg-danger text-white"}`}>
                {unreadChatCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

type Toast = { id: number; title: string; body?: string; href: string };

/** A short, unobtrusive two-tone ping — synthesized so there's no audio file to ship or license. */
function playPing() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [880, 1175].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.09;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.24);
    });
    setTimeout(() => ctx.close(), 500);
  } catch {
    // Autoplay can be blocked before the visitor has interacted with the page at all — a
    // missed ping is fine, the toast and badge still carry the notification.
  }
}

export function Sidebar({
  role,
  userId,
  channel,
  unreadChatCount = 0,
  signOutAction,
}: {
  role: string;
  userId: string;
  channel: string;
  unreadChatCount?: number;
  signOutAction?: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(unreadChatCount);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pathname = usePathname();

  // Close the drawer whenever the route changes (covers back/forward too, not just link clicks).
  useEffect(() => setOpen(false), [pathname]);
  // The server recomputes unreadChatCount on every navigation — resync local state to it so a
  // visit to /chat (which marks threads read server-side) clears the badge again.
  useEffect(() => setCount(unreadChatCount), [unreadChatCount]);

  const onChatPage = pathname?.startsWith("/chat");
  const onChatPageRef = useRef(onChatPage);
  onChatPageRef.current = onChatPage;

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!key || !cluster) return;

    const pusher = new Pusher(key, { cluster, authEndpoint: "/api/pusher/auth" });
    const ch = pusher.subscribe(channel);

    const addToast = (t: Omit<Toast, "id">) => {
      const toast = { ...t, id: Date.now() + Math.random() };
      setToasts((prev) => [...prev.slice(-2), toast]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== toast.id)), 6000);
    };

    ch.bind("chat_message", (payload: { senderId: string; senderName: string; body: string; clientId: string }) => {
      if (payload.senderId === userId) return;
      playPing();
      if (!onChatPageRef.current) setCount((c) => c + 1);
      addToast({ title: `New message — ${payload.senderName}`, body: payload.body, href: `/chat?clientId=${payload.clientId}` });
    });

    ch.bind("activity", (payload: { title: string; body?: string; contentId?: string }) => {
      playPing();
      addToast({ title: payload.title, body: payload.body, href: payload.contentId ? `/content/${payload.contentId}` : "/dashboard" });
    });

    return () => {
      pusher.unsubscribe(channel);
      pusher.disconnect();
    };
  }, [channel, userId]);

  return (
    <>
      {/* Desktop: fixed sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-neutral bg-white p-4 md:block">
        <div className="mb-6 text-sm font-semibold text-primary">The Aura Lab Content OS</div>
        <NavLinks role={role} unreadChatCount={count} />
        <div className="mt-8 text-xs uppercase tracking-wide text-neutral-400">Signed in as</div>
        <div className="text-xs text-secondary">{role}</div>
      </aside>

      {/* Mobile: top bar with a hamburger that opens a slide-over drawer */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-neutral bg-white px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-neutral text-primary"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M1.5 4.5h15M1.5 9h15M1.5 13.5h15" strokeLinecap="round" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-primary">The Aura Lab Content OS</span>
        <Link href="/chat" aria-label="Chat" className="relative flex h-9 w-9 items-center justify-center rounded-md border border-neutral text-primary">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M2 5.5A2.5 2.5 0 0 1 4.5 3h11A2.5 2.5 0 0 1 18 5.5v6A2.5 2.5 0 0 1 15.5 14H8l-4 3v-3H4.5A2.5 2.5 0 0 1 2 11.5v-6Z" strokeLinejoin="round" />
          </svg>
          {count > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-danger px-1 text-[9px] font-semibold text-white">{count}</span>}
        </Link>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/40" />
          <aside className="absolute inset-y-0 left-0 w-64 max-w-[85vw] overflow-y-auto bg-white p-4 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <span className="text-sm font-semibold text-primary">The Aura Lab Content OS</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="flex h-8 w-8 items-center justify-center rounded-md text-primary/60 hover:bg-background">
                ✕
              </button>
            </div>
            <NavLinks role={role} unreadChatCount={count} onNavigate={() => setOpen(false)} />
            <div className="mt-8 text-xs uppercase tracking-wide text-neutral-400">Signed in as</div>
            <div className="text-xs text-secondary">{role}</div>
            {signOutAction && (
              <form action={signOutAction} className="mt-4 border-t border-neutral pt-4">
                <button className="text-sm text-neutral-500 hover:text-danger">Sign out</button>
              </form>
            )}
          </aside>
        </div>
      )}

      {/* Toasts for incoming chat messages and activity (approvals, uploads...) */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((t) => (
          <Link
            key={t.id}
            href={t.href}
            className="pointer-events-auto rounded-lg border border-neutral bg-white p-3 text-sm shadow-lg transition hover:border-secondary"
          >
            <div className="font-medium text-primary">{t.title}</div>
            {t.body && <div className="mt-0.5 truncate text-xs text-primary/60">{t.body}</div>}
          </Link>
        ))}
      </div>
    </>
  );
}
