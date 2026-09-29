import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, channelFor } from "@/lib/access";
import { can } from "@/lib/rbac";
import { getOrCreateDiscussion, findDiscussion, listChatPreviews } from "@/lib/chat";
import { ChatThread, type ChatMessage } from "@/components/chat/chat-thread";
import { ChatRefresh } from "@/components/chat/chat-refresh";

const ago = (d: Date) => {
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
};

/** Called during render for the thread actually being viewed — no client JS needed. */
async function markRead(discussionId: string, userId: string) {
  await prisma.chatRead.upsert({
    where: { discussionId_userId: { discussionId, userId } },
    update: { lastReadAt: new Date() },
    create: { discussionId, userId },
  });
}

async function loadMessages(discussionId: string, userId: string): Promise<ChatMessage[]> {
  const rows = await prisma.message.findMany({
    where: { discussionId },
    include: { sender: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  return rows.map((m) => ({ id: m.id, body: m.body, createdAt: m.createdAt.toISOString(), senderName: m.sender.name, mine: m.senderId === userId }));
}

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ clientId?: string }> }) {
  const user = await requireUser();
  if (!can(user.role, "chat", "read")) {
    return <p className="rounded-lg border border-neutral bg-white p-6 text-sm text-primary/60">Chat isn&apos;t available for your role.</p>;
  }

  // ---- Client view: one thread with the agency ----
  if (user.role === "CLIENT") {
    if (!user.clientId) return <p className="text-sm text-primary/60">No workspace is linked to your account yet.</p>;
    const discussion = await findDiscussion(user.clientId);
    const messages = discussion ? await loadMessages(discussion.id, user.id) : [];
    if (discussion) await markRead(discussion.id, user.id);
    return (
      <div className="space-y-4">
        <ChatRefresh channel={channelFor(user)} />
        <div>
          <h1 className="text-lg font-semibold text-primary">Chat with The Aura Lab</h1>
          <p className="text-sm text-primary/60">Quick questions and updates — no need for WhatsApp or email.</p>
        </div>
        <ChatThread clientId={user.clientId} messages={messages} placeholder="Say hello — your account manager will reply here." />
      </div>
    );
  }

  // ---- Team view: inbox of every client, selected thread on the right ----
  // One query for every client's preview + unread count, instead of ~2 DB round trips (one of
  // them a write) per client — with dozens of clients that N+1 pattern was the main reason the
  // chat inbox felt slow to load.
  const previews = await listChatPreviews(user.organizationId, user.id);

  const sp = await searchParams;
  // No clientId param at all → default to the first client (good default for desktop's two-pane
  // view). clientId="" is an explicit "show the list" signal — that's what the mobile back link uses.
  const activeClientId =
    sp.clientId === undefined
      ? previews[0]?.clientId
      : previews.some((p) => p.clientId === sp.clientId)
        ? sp.clientId
        : undefined;
  const active = previews.find((p) => p.clientId === activeClientId);
  // A client that's never been messaged has no Discussion row yet — create it only now, at the
  // moment someone actually opens that thread, not for every client on every inbox load.
  let activeDiscussionId = active?.discussionId ?? null;
  if (active && !activeDiscussionId) {
    activeDiscussionId = (await getOrCreateDiscussion(active.clientId)).id;
  }
  const messages = activeDiscussionId ? await loadMessages(activeDiscussionId, user.id) : [];
  if (activeDiscussionId) await markRead(activeDiscussionId, user.id);

  return (
    <div className="space-y-4">
      <ChatRefresh channel={channelFor(user)} />
      <div>
        <h1 className="text-lg font-semibold text-primary">Client chat</h1>
        <p className="text-sm text-primary/60">One thread per client — replaces WhatsApp/email for quick back-and-forth.</p>
      </div>
      {previews.length === 0 ? (
        <p className="rounded-lg border border-neutral bg-white p-6 text-sm text-primary/60">Onboard a client to start chatting.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          {/* On phones, show the list OR the open thread — not both stacked full-height. */}
          <ul className={`h-[32rem] space-y-1 overflow-y-auto rounded-lg border border-neutral bg-white p-2 ${activeClientId ? "hidden lg:block" : ""}`}>
            {previews.map((p) => (
              <li key={p.clientId}>
                <Link
                  href={`/chat?clientId=${p.clientId}`}
                  className={`flex items-start justify-between gap-2 rounded-md px-3 py-2 text-sm ${p.clientId === activeClientId ? "bg-background" : "hover:bg-background"}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-primary">{p.clientName}</span>
                    <span className="block truncate text-xs text-primary/50">{p.lastBody ?? "No messages yet"}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    {p.lastCreatedAt && <span className="block text-[10px] text-primary/40">{ago(p.lastCreatedAt)}</span>}
                    {p.unread > 0 && <span className="mt-0.5 inline-block rounded-full bg-primary px-1.5 text-[10px] font-semibold text-white">{p.unread}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {active ? (
            <div className={activeClientId ? "" : "hidden lg:block"}>
              <Link href="/chat?clientId=" className="mb-2 inline-block text-xs text-secondary hover:underline lg:hidden">← All clients</Link>
              <ChatThread clientId={active.clientId} messages={messages} placeholder={`Start the conversation with ${active.clientName}.`} />
            </div>
          ) : (
            <div className="hidden h-[32rem] items-center justify-center rounded-lg border border-neutral bg-white text-sm text-primary/40 lg:flex">Pick a client to start chatting.</div>
          )}
        </div>
      )}
    </div>
  );
}
