import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, requireClient } from "@/lib/access";
import { can } from "@/lib/rbac";
import { getClientServiceState, updateClientServices } from "@/app/(app)/actions/services";
import { ServiceChecklist } from "@/components/admin/service-checklist";
import { ServicesForm } from "./services-form";

export default async function ClientServicesPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const user = await requireUser();
  if (user.role === "CLIENT" || !can(user.role, "client", "update")) notFound();

  const client = await requireClient(clientId, user).catch(() => null);
  if (!client) notFound();
  const state = await getClientServiceState(clientId);
  const configured = Object.keys(state).length > 0;

  return (
    <div className="space-y-4">
      <div className="text-sm text-primary/60">
        <Link href="/clients" className="hover:text-primary">Clients</Link> /{" "}
        <Link href={`/clients/${clientId}`} className="hover:text-primary">{client.name}</Link> / Services
      </div>
      <div>
        <h1 className="text-lg font-semibold text-primary">Services — {client.name}</h1>
        <p className="text-sm text-primary/60">
          What this client has bought. Enabled categories control which content types they can plan and what shows up in their menus.
        </p>
        {!configured && (
          <p role="note" className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Not configured yet — every content type is currently available to this client. Save below to start scoping it down.
          </p>
        )}
      </div>
      <ServicesForm clientId={client.id} action={updateClientServices}>
        <ServiceChecklist initial={state} detailed />
      </ServicesForm>
    </div>
  );
}
