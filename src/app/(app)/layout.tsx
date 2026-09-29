import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/layout/sidebar";
import { findDiscussion, totalUnreadForOrg, unreadCount } from "@/lib/chat";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const sid = (session?.user as { id?: string } | undefined)?.id;
  const me = sid
    ? await prisma.user.findUnique({
        where: { id: sid },
        select: {
          id: true,
          name: true,
          isActive: true,
          deletedAt: true,
          mustChangePassword: true,
          organizationId: true,
          clientId: true,
          role: { select: { name: true } },
        },
      })
    : null;

  // A deactivated account keeps its old JWT until it expires, so check the database on every page.
  if (!me || !me.isActive || me.deletedAt) redirect("/login?error=disabled");
  if (me.mustChangePassword) redirect("/change-password");

  const channel = me.role.name === "CLIENT" && me.clientId ? `private-client-${me.clientId}` : `private-org-${me.organizationId}`;

  // Best-effort — chat is a convenience, never a reason to break the whole app shell if it errors.
  let unreadChatCount = 0;
  try {
    if (me.role.name === "CLIENT" && me.clientId) {
      const discussion = await findDiscussion(me.clientId);
      unreadChatCount = discussion ? await unreadCount(discussion.id, me.id) : 0;
    } else if (me.role.name !== "CLIENT") {
      unreadChatCount = await totalUnreadForOrg(me.organizationId, me.id);
    }
  } catch (e) {
    console.error("Unread chat count failed", e);
  }

  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <Sidebar role={me.role.name} userId={me.id} channel={channel} unreadChatCount={unreadChatCount} signOutAction={doSignOut} />
      <div className="min-w-0 flex-1">
        <header className="hidden items-center justify-between border-b border-neutral bg-white px-6 py-3 md:flex">
          <span className="text-sm text-primary">{me.name}</span>
          <form action={doSignOut}>
            <button className="text-sm text-neutral-500 hover:text-danger">Sign out</button>
          </form>
        </header>
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
