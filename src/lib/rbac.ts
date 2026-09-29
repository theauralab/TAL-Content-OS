import { RoleName } from "@prisma/client";

// Static permission matrix for Phase 1. Once the Permission table is
// populated per-organization (Phase 2+), swap getStaticPermissions() for a
// DB lookup — the checkPermission() call site does not need to change.
type Action = "create" | "read" | "update" | "delete" | "approve";
type Resource =
  | "client"
  | "brand"
  | "content"
  | "asset"
  | "task"
  | "report"
  | "invoice"
  | "user"
  | "chat";

const MATRIX: Record<RoleName, Partial<Record<Resource, Action[]>>> = {
  SUPER_ADMIN: {
    client: ["create", "read", "update", "delete"],
    brand: ["create", "read", "update", "delete"],
    content: ["create", "read", "update", "delete", "approve"],
    asset: ["create", "read", "update", "delete"],
    task: ["create", "read", "update", "delete"],
    report: ["create", "read", "update", "delete"],
    invoice: ["create", "read", "update", "delete"],
    user: ["create", "read", "update", "delete"],
    chat: ["create", "read"],
  },
  AGENCY_MANAGER: {
    client: ["create", "read", "update"],
    brand: ["create", "read", "update"],
    content: ["create", "read", "update", "approve"],
    asset: ["create", "read", "update"],
    task: ["create", "read", "update"],
    report: ["create", "read", "update"],
    invoice: ["create", "read", "update"],
    user: ["create", "read", "update"], // managers: client logins only (enforced in admin actions)
    chat: ["create", "read"],
  },
  DESIGNER: {
    content: ["create", "read", "update"],
    asset: ["create", "read"],
    task: ["read", "update"],
    chat: ["create", "read"],
  },
  VIDEO_EDITOR: {
    content: ["create", "read", "update"],
    asset: ["create", "read"],
    task: ["read", "update"],
    chat: ["create", "read"],
  },
  CONTENT_WRITER: {
    content: ["create", "read", "update"],
    task: ["read", "update"],
    chat: ["create", "read"],
  },
  SEO_SPECIALIST: {
    content: ["read", "update"],
    task: ["read", "update"],
    chat: ["create", "read"],
  },
  MEDIA_BUYER: {
    content: ["read"],
    task: ["read", "update"],
    chat: ["create", "read"],
  },
  CLIENT: {
    content: ["read", "approve"],
    asset: ["read"],
    report: ["read"],
    invoice: ["read"],
    chat: ["create", "read"],
  },
};

export function can(role: RoleName, resource: Resource, action: Action): boolean {
  return Boolean(MATRIX[role]?.[resource]?.includes(action));
}

/**
 * Tenant isolation check: a CLIENT-role user may only touch rows scoped to
 * their own clientId. Everyone else is scoped to their organizationId.
 * Call this in every server action / route handler that reads or writes
 * client-owned data — do not rely on the UI to hide the wrong rows.
 */
export function assertTenantScope(params: {
  sessionOrgId: string;
  sessionClientId: string | null;
  role: RoleName;
  targetOrgId: string;
  targetClientId?: string | null;
}) {
  const { sessionOrgId, sessionClientId, role, targetOrgId, targetClientId } = params;

  if (targetOrgId !== sessionOrgId) {
    throw new Error("Cross-organization access denied");
  }
  if (role === "CLIENT") {
    if (!sessionClientId || targetClientId !== sessionClientId) {
      throw new Error("Cross-client access denied");
    }
  }
}
