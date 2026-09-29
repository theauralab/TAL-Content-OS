import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { requireUser, requireClient } from "@/lib/access";
import { createBrand, updateBrand, deleteBrand } from "@/app/(app)/actions/brands";
import { updateClient, deleteClient } from "@/app/(app)/actions/clients";
import { setUserActive, updateClientProfile } from "@/app/(app)/actions/admin";
import { CreateUserForm } from "@/components/admin/create-user-form";
import { ResetPassword } from "@/components/admin/reset-password";
import { ConfirmButton } from "@/components/common/confirm-button";

export default async function ClientDetailPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const user = await requireUser();
  const client = await requireClient(clientId, user).catch(() => null);
  if (!client) notFound();

  const brands = await prisma.brand.findMany({
    where: { clientId: client.id, deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { contentItems: { where: { deletedAt: null } } } } },
  });

  const canManageLogins = can(user.role, "user", "update") && user.role !== "CLIENT";
  const logins = canManageLogins
    ? await prisma.user.findMany({
        where: { clientId: client.id, deletedAt: null },
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
        select: { id: true, name: true, email: true, isActive: true, lastLoginAt: true, mustChangePassword: true },
      })
    : [];
  const input = "rounded-md border border-neutral px-3 py-2 text-sm";

  const canCreateBrand = can(user.role, "brand", "create");
  const canEditBrand = can(user.role, "brand", "update");
  const canDeleteBrand = can(user.role, "brand", "delete");
  const canEditClient = can(user.role, "client", "update");
  const canDeleteClient = can(user.role, "client", "delete");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/clients" className="text-sm text-primary/60 hover:text-primary">← Clients</Link>
        <h1 className="mt-1 text-lg font-semibold text-primary">{client.name}</h1>
        <p className="text-sm text-primary/60">Pick a brand to open its content calendar</p>
        {canEditClient && (
          <Link href={`/clients/${client.id}/services`} className="mt-1 inline-block text-sm text-secondary hover:underline">
            Manage services →
          </Link>
        )}
      </div>

      {(canEditClient || canDeleteClient) && (
        <div className="flex flex-wrap items-start gap-4 text-sm">
          {canEditClient && (
            <details>
              <summary className="cursor-pointer text-primary/70 hover:text-primary">Rename client</summary>
              <form action={updateClient} className="mt-2 flex gap-2">
                <input type="hidden" name="id" value={client.id} />
                <input name="name" defaultValue={client.name} required className="rounded-md border border-neutral px-2 py-1" />
                <button type="submit" className="rounded-md bg-primary px-3 py-1 text-white">Save</button>
              </form>
            </details>
          )}
          {canDeleteClient && (
            <form action={deleteClient}>
              <input type="hidden" name="id" value={client.id} />
              <ConfirmButton message={`Delete "${client.name}" and all its brands?`} className="text-danger hover:underline">
                Delete client
              </ConfirmButton>
            </form>
          )}
        </div>
      )}

      {canCreateBrand && (
        <form action={createBrand} className="flex max-w-md gap-2">
          <input type="hidden" name="clientId" value={client.id} />
          <input name="name" placeholder="New brand name" required className="flex-1 rounded-md border border-neutral px-3 py-2 text-sm" />
          <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            Add brand
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {brands.map((b) => (
          <div key={b.id} className="rounded-lg border border-neutral bg-white p-4">
            <Link href={`/clients/${client.id}/brands/${b.id}`} className="block hover:text-secondary">
              <div className="font-medium text-primary">{b.name}</div>
              <div className="text-sm text-primary/60">{b._count.contentItems} content item(s) → open calendar</div>
            </Link>

            {(canEditBrand || canDeleteBrand) && (
              <div className="mt-3 flex items-start gap-3 border-t border-neutral pt-3 text-sm">
                {canEditBrand && (
                  <details className="flex-1">
                    <summary className="cursor-pointer text-primary/70 hover:text-primary">Rename</summary>
                    <form action={updateBrand} className="mt-2 flex gap-2">
                      <input type="hidden" name="id" value={b.id} />
                      <input name="name" defaultValue={b.name} required className="min-w-0 flex-1 rounded-md border border-neutral px-2 py-1" />
                      <button type="submit" className="rounded-md bg-primary px-3 py-1 text-white">Save</button>
                    </form>
                  </details>
                )}
                {canDeleteBrand && (
                  <form action={deleteBrand}>
                    <input type="hidden" name="id" value={b.id} />
                    <ConfirmButton message={`Delete brand "${b.name}"?`} className="text-danger hover:underline">
                      Delete
                    </ConfirmButton>
                  </form>
                )}
              </div>
            )}
          </div>
        ))}
        {brands.length === 0 && <p className="text-sm text-primary/60">No brands yet.</p>}
      </div>

      {canEditClient && (
        <section className="rounded-lg border border-neutral bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-primary">Client profile</h2>
          <form action={updateClientProfile} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={client.id} />
            <select name="status" defaultValue={client.status} className={input}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="churned">Churned</option>
            </select>
            <input name="industry" defaultValue={client.industry ?? ""} placeholder="Industry" className={input} />
            <input name="contactName" defaultValue={client.contactName ?? ""} placeholder="Main contact" className={input} />
            <input name="contactEmail" type="email" defaultValue={client.contactEmail ?? ""} placeholder="Contact email" className={input} />
            <textarea name="notes" defaultValue={client.notes ?? ""} rows={3} placeholder="Internal notes (never shown to the client)" className={`${input} sm:col-span-2`} />
            <button type="submit" className="w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90">Save profile</button>
          </form>
        </section>
      )}

      {canManageLogins && (
        <section className="rounded-lg border border-neutral bg-white p-4">
          <h2 className="mb-1 text-sm font-semibold text-primary">Client portal access</h2>
          <p className="mb-3 text-xs text-primary/60">These people sign in at the login page and only ever see {client.name}&apos;s work once it's been sent for review.</p>

          {logins.length > 0 && (
            <ul className="mb-4 divide-y divide-neutral text-sm">
              {logins.map((l) => (
                <li key={l.id} className="flex flex-wrap items-start justify-between gap-3 py-2">
                  <div>
                    <div className="font-medium text-primary">{l.name} <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] ${l.isActive ? "bg-green-100 text-green-800" : "bg-neutral text-primary/60"}`}>{l.isActive ? "Active" : "Deactivated"}</span></div>
                    <div className="text-xs text-primary/60">{l.email} · {l.lastLoginAt ? `last login ${l.lastLoginAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" })}` : l.mustChangePassword ? "invited, hasn't signed in" : "never signed in"}</div>
                  </div>
                  <div className="flex items-start gap-4">
                    <ResetPassword userId={l.id} name={l.name} label={l.lastLoginAt ? "Reset & email password" : "Resend login"} />
                    <form action={setUserActive}>
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="active" value={l.isActive ? "0" : "1"} />
                      <button className={l.isActive ? "text-danger hover:underline" : "text-primary/70 hover:underline"}>{l.isActive ? "Deactivate" : "Reactivate"}</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <CreateUserForm clients={[]} fixedClientId={client.id} canCreateTeam={false} />
        </section>
      )}
    </div>
  );
}
