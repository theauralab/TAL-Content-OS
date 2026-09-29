import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { requireUser } from "@/lib/access";
import { changeUserRole, setUserActive } from "@/app/(app)/actions/admin";
import { CreateUserForm } from "@/components/admin/create-user-form";
import { ResetPassword } from "@/components/admin/reset-password";

const TEAM_ROLES = ["SUPER_ADMIN", "AGENCY_MANAGER", "DESIGNER", "VIDEO_EDITOR", "CONTENT_WRITER", "SEO_SPECIALIST", "MEDIA_BUYER"];
const pretty = (r: string) => r.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ client?: string; show?: string }> }) {
  const sp = await searchParams;
  const me = await requireUser();
  if (!can(me.role, "user", "read")) notFound();
  const isSuper = me.role === "SUPER_ADMIN";

  const clients = await prisma.client.findMany({
    where: { organizationId: me.organizationId, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const show = sp.show === "team" && isSuper ? "team" : "clients";

  const users = await prisma.user.findMany({
    where: {
      organizationId: me.organizationId,
      deletedAt: null,
      role: show === "team" ? { name: { not: "CLIENT" } } : { name: "CLIENT" },
      ...(show === "clients" && sp.client ? { clientId: sp.client } : {}),
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { role: true, client: { select: { id: true, name: true } } },
  });

  const tab = (key: "clients" | "team", label: string) => (
    <Link href={`/admin/users?show=${key}`} className={`rounded px-3 py-1 ${show === key ? "bg-primary text-white" : "text-primary hover:bg-background"}`}>{label}</Link>
  );
  const when = (d: Date | null) => (d ? d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }) : "Never");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-primary/60 hover:text-primary">← Admin panel</Link>
        <h1 className="mt-1 text-lg font-semibold text-primary">Logins &amp; team</h1>
        <p className="text-sm text-primary/60">New logins get a one-time temporary password and must set their own on first sign-in.</p>
      </div>

      <section className="rounded-lg border border-neutral bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-primary">Create a login</h2>
        <CreateUserForm clients={clients} canCreateTeam={isSuper} />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {isSuper ? (
          <div className="flex gap-1 rounded-md border border-neutral bg-white p-1 text-sm">{tab("clients", "Client logins")}{tab("team", "Team")}</div>
        ) : (
          <span className="text-sm font-medium text-primary">Client logins</span>
        )}
        {show === "clients" && (
          <form className="flex items-center gap-2 text-sm">
            <select name="client" defaultValue={sp.client ?? ""} className="rounded-md border border-neutral bg-white px-2 py-1">
              <option value="">All clients</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="rounded-md border border-neutral bg-white px-3 py-1 hover:border-secondary">Filter</button>
          </form>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-neutral text-xs uppercase text-primary/60">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">{show === "clients" ? "Client" : "Role"}</th>
              <th className="px-3 py-2">Last login</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-neutral align-top last:border-0">
                <td className="px-3 py-2">
                  <div className="font-medium text-primary">{u.name}</div>
                  <div className="text-xs text-primary/60">{u.email}</div>
                </td>
                <td className="px-3 py-2">
                  {show === "clients" ? (
                    u.client ? <Link href={`/clients/${u.client.id}`} className="hover:text-secondary">{u.client.name}</Link> : "—"
                  ) : isSuper && u.id !== me.id ? (
                    <form action={changeUserRole} className="flex gap-1">
                      <input type="hidden" name="id" value={u.id} />
                      <select name="role" defaultValue={u.role.name} className="rounded-md border border-neutral bg-white px-2 py-1 text-xs">
                        {TEAM_ROLES.map((r) => <option key={r} value={r}>{pretty(r)}</option>)}
                      </select>
                      <button className="rounded-md border border-neutral px-2 text-xs hover:border-secondary">Save</button>
                    </form>
                  ) : (
                    pretty(u.role.name)
                  )}
                </td>
                <td className="px-3 py-2 text-primary/70">
                  {when(u.lastLoginAt)}
                  {u.mustChangePassword && <div className="text-xs text-warning">Hasn&apos;t set a password yet</div>}
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${u.isActive ? "bg-green-100 text-green-800" : "bg-neutral text-primary/60"}`}>{u.isActive ? "Active" : "Deactivated"}</span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-start gap-4 text-sm">
                    <ResetPassword userId={u.id} name={u.name} />
                    {u.id !== me.id && (
                      <form action={setUserActive}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="active" value={u.isActive ? "0" : "1"} />
                        <button className={u.isActive ? "text-danger hover:underline" : "text-primary/70 hover:underline"}>{u.isActive ? "Deactivate" : "Reactivate"}</button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-primary/60">No logins here yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
