import Link from "next/link";
import { requireUser } from "@/lib/access";
import { listClients } from "@/lib/queries";
import { can } from "@/lib/rbac";
import { updateClient, deleteClient } from "@/app/(app)/actions/clients";
import { OnboardClientForm } from "@/components/admin/onboard-client-form";
import { ConfirmButton } from "@/components/common/confirm-button";

export default async function ClientsPage() {
  const user = await requireUser();
  const clients = await listClients();
  const canCreate = can(user.role, "client", "create");
  const canEdit = can(user.role, "client", "update");
  const canDelete = can(user.role, "client", "delete");

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-primary">Clients</h1>

      {canCreate && (
        <details className="rounded-lg border border-neutral bg-white p-4">
          <summary className="cursor-pointer text-sm font-medium text-primary">+ Onboard a new client</summary>
          <div className="mt-3"><OnboardClientForm /></div>
        </details>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clients.map((c) => (
          <div key={c.id} className="rounded-lg border border-neutral bg-white p-4">
            <Link href={`/clients/${c.id}`} className="block hover:text-secondary">
              <div className="font-medium text-primary">{c.name}</div>
              <div className="text-sm text-primary/60">{c.brands.length} brand(s)</div>
            </Link>

            {(canEdit || canDelete) && (
              <div className="mt-3 flex items-start gap-3 border-t border-neutral pt-3 text-sm">
                {canEdit && (
                  <details className="flex-1">
                    <summary className="cursor-pointer text-primary/70 hover:text-primary">Rename</summary>
                    <form action={updateClient} className="mt-2 flex gap-2">
                      <input type="hidden" name="id" value={c.id} />
                      <input name="name" defaultValue={c.name} required className="min-w-0 flex-1 rounded-md border border-neutral px-2 py-1" />
                      <button type="submit" className="rounded-md bg-primary px-3 py-1 text-white">Save</button>
                    </form>
                  </details>
                )}
                {canDelete && (
                  <form action={deleteClient}>
                    <input type="hidden" name="id" value={c.id} />
                    <ConfirmButton message={`Delete "${c.name}" and all its brands?`} className="text-danger hover:underline">
                      Delete
                    </ConfirmButton>
                  </form>
                )}
              </div>
            )}
          </div>
        ))}
        {clients.length === 0 && <p className="text-sm text-primary/60">No clients yet.</p>}
      </div>
    </div>
  );
}
