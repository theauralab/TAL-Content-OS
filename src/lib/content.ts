import type { ApprovalStage, ContentStatus, ContentType, RoleName } from "@prisma/client";

export const STATUS_LABEL: Record<ContentStatus, string> = {
  DRAFT: "Draft",
  INTERNAL_REVIEW: "Internal review",
  CLIENT_REVIEW: "Plan with client",
  CHANGES_REQUESTED: "Plan changes requested",
  APPROVED: "Plan approved",
  IN_PRODUCTION: "In production",
  CREATIVE_REVIEW: "Creative with client",
  CREATIVE_CHANGES_REQUESTED: "Creative changes requested",
  READY_TO_PUBLISH: "Ready to publish",
  SCHEDULED: "Scheduled",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

export const STATUS_STYLE: Record<ContentStatus, string> = {
  DRAFT: "bg-neutral text-primary",
  INTERNAL_REVIEW: "bg-amber-100 text-amber-800",
  CLIENT_REVIEW: "bg-blue-100 text-blue-800",
  CHANGES_REQUESTED: "bg-red-100 text-red-700",
  APPROVED: "bg-green-100 text-green-800",
  IN_PRODUCTION: "bg-purple-100 text-purple-800",
  CREATIVE_REVIEW: "bg-indigo-100 text-indigo-800",
  CREATIVE_CHANGES_REQUESTED: "bg-red-100 text-red-700",
  READY_TO_PUBLISH: "bg-emerald-100 text-emerald-800",
  SCHEDULED: "bg-secondary text-primary",
  PUBLISHED: "bg-primary text-white",
  ARCHIVED: "bg-neutral text-primary/50",
};

export const TYPE_LABEL: Record<ContentType, string> = {
  INSTAGRAM_REEL: "Instagram Reel",
  INSTAGRAM_CAROUSEL: "Instagram Carousel",
  INSTAGRAM_STORY: "Instagram Story",
  INSTAGRAM_STATIC: "Instagram Static",
  FACEBOOK_POST: "Facebook Post",
  LINKEDIN_POST: "LinkedIn Post",
  YOUTUBE_VIDEO: "YouTube Video",
  YOUTUBE_SHORTS: "YouTube Shorts",
  PINTEREST_PIN: "Pinterest Pin",
  GOOGLE_BUSINESS_POST: "Google Business Post",
  REDDIT_CONTENT: "Reddit Content",
  QUORA_CONTENT: "Quora Content",
  BLOG: "Blog",
  EMAIL_CAMPAIGN: "Email Campaign",
};

export const BOARD_COLUMNS: ContentStatus[] = [
  "DRAFT",
  "INTERNAL_REVIEW",
  "CLIENT_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "IN_PRODUCTION",
  "CREATIVE_REVIEW",
  "CREATIVE_CHANGES_REQUESTED",
  "READY_TO_PUBLISH",
  "SCHEDULED",
  "PUBLISHED",
];

// Clients never see drafts or internal-review work.
export const CLIENT_VISIBLE: ContentStatus[] = [
  "CLIENT_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "IN_PRODUCTION",
  "CREATIVE_REVIEW",
  "CREATIVE_CHANGES_REQUESTED",
  "READY_TO_PUBLISH",
  "SCHEDULED",
  "PUBLISHED",
];

/** The two places the client has to make a decision, and which gate each one is. */
export const CLIENT_REVIEW_STAGE: Partial<Record<ContentStatus, ApprovalStage>> = {
  CLIENT_REVIEW: "PLAN",
  CREATIVE_REVIEW: "CREATIVE",
};
export const CLIENT_REVIEW_STATUSES = Object.keys(CLIENT_REVIEW_STAGE) as ContentStatus[];

/** Where a client's decision moves the item. */
export const CLIENT_DECISION_TARGET: Record<ApprovalStage, { APPROVED: ContentStatus; CHANGES_REQUESTED: ContentStatus }> = {
  PLAN: { APPROVED: "APPROVED", CHANGES_REQUESTED: "CHANGES_REQUESTED" },
  CREATIVE: { APPROVED: "READY_TO_PUBLISH", CHANGES_REQUESTED: "CREATIVE_CHANGES_REQUESTED" },
};

/** Statuses in which the production team may add creatives. */
export const CREATIVE_UPLOAD_STATUSES: ContentStatus[] = ["APPROVED", "IN_PRODUCTION", "CREATIVE_CHANGES_REQUESTED"];

/** While the client is reviewing, the content is frozen so they never approve something that then changes. */
export const CLIENT_LOCKED_STATUSES: ContentStatus[] = ["CLIENT_REVIEW", "CREATIVE_REVIEW"];

const INTERNAL_NEXT: Record<ContentStatus, ContentStatus[]> = {
  DRAFT: ["INTERNAL_REVIEW", "ARCHIVED"],
  INTERNAL_REVIEW: ["DRAFT", "CLIENT_REVIEW", "ARCHIVED"],
  CLIENT_REVIEW: ["INTERNAL_REVIEW"],
  CHANGES_REQUESTED: ["DRAFT", "INTERNAL_REVIEW"],
  // READY_TO_PUBLISH from here = text-only content that needs no creative.
  APPROVED: ["IN_PRODUCTION", "READY_TO_PUBLISH", "ARCHIVED"],
  IN_PRODUCTION: ["CREATIVE_REVIEW"],
  CREATIVE_REVIEW: ["IN_PRODUCTION"],
  CREATIVE_CHANGES_REQUESTED: ["IN_PRODUCTION"],
  READY_TO_PUBLISH: ["SCHEDULED", "PUBLISHED", "IN_PRODUCTION"],
  SCHEDULED: ["PUBLISHED", "READY_TO_PUBLISH"],
  PUBLISHED: ["ARCHIVED"],
  ARCHIVED: ["DRAFT"],
};

// Only managers can send work to the client, approve, publish, or restart production.
// (Production starts by itself the moment a designer/editor uploads the first file.)
const MANAGER_ONLY = new Set<ContentStatus>([
  "CLIENT_REVIEW",
  "APPROVED",
  "IN_PRODUCTION",
  "CREATIVE_REVIEW",
  "READY_TO_PUBLISH",
  "SCHEDULED",
  "PUBLISHED",
]);

export function allowedNext(role: RoleName, status: ContentStatus): ContentStatus[] {
  if (role === "CLIENT") return [];
  const isManager = role === "SUPER_ADMIN" || role === "AGENCY_MANAGER";
  const next = [...INTERNAL_NEXT[status]];
  // Recording a decision the client gave outside the app (e.g. on a call).
  if (status === "CLIENT_REVIEW") next.push("APPROVED");
  if (status === "CREATIVE_REVIEW") next.push("READY_TO_PUBLISH");
  return next.filter((s) => isManager || !MANAGER_ONLY.has(s));
}

/** Button text for a manual move — clearer than just the target status name. */
export function transitionLabel(from: ContentStatus, to: ContentStatus): string {
  if (to === "CLIENT_REVIEW") return "Send plan to client";
  if (to === "CREATIVE_REVIEW") return "Send creative to client";
  if (from === "CLIENT_REVIEW" && to === "APPROVED") return "Approved by client (record it)";
  if (from === "CREATIVE_REVIEW" && to === "READY_TO_PUBLISH") return "Approved by client (record it)";
  if (from === "APPROVED" && to === "IN_PRODUCTION") return "Start production";
  if (from === "APPROVED" && to === "READY_TO_PUBLISH") return "Skip creative (text-only)";
  if (from === "CLIENT_REVIEW" && to === "INTERNAL_REVIEW") return "Pull back to internal review";
  if (from === "CREATIVE_REVIEW" && to === "IN_PRODUCTION") return "Pull back to production";
  if (from === "READY_TO_PUBLISH" && to === "IN_PRODUCTION") return "Rework creative";
  if (to === "SCHEDULED") return "Mark scheduled";
  if (to === "PUBLISHED") return "Mark published";
  return STATUS_LABEL[to];
}

/** Round counter after moving into IN_PRODUCTION: a fresh round each time earlier work was already judged. */
export function creativeRoundAfterProduction(from: ContentStatus, current: number): number {
  if (from === "APPROVED") return Math.max(current, 1);
  if (from === "CREATIVE_CHANGES_REQUESTED" || from === "READY_TO_PUBLISH") return current + 1;
  return Math.max(current, 1); // pull-back from CREATIVE_REVIEW keeps the same, not-yet-judged round
}

/**
 * Highest creative round a client may see. Work in progress is hidden: while the team is producing,
 * the client only sees rounds they have already been sent.
 */
export function maxRoundVisibleToClient(status: ContentStatus, creativeRound: number): number {
  switch (status) {
    case "CREATIVE_REVIEW":
    case "CREATIVE_CHANGES_REQUESTED":
    case "READY_TO_PUBLISH":
    case "SCHEDULED":
    case "PUBLISHED":
      return creativeRound;
    case "IN_PRODUCTION":
      return Math.max(creativeRound - 1, 0);
    default:
      return 0;
  }
}

/** Where an item sits in the five-step pipeline shown at the top of every content page. */
export const PIPELINE_STEPS = ["Plan", "Plan approval", "Production", "Creative approval", "Publish"] as const;

export function pipelineState(status: ContentStatus): { index: number; attention: boolean } {
  switch (status) {
    case "DRAFT":
    case "INTERNAL_REVIEW":
      return { index: 0, attention: false };
    case "CHANGES_REQUESTED":
      return { index: 0, attention: true };
    case "CLIENT_REVIEW":
      return { index: 1, attention: false };
    case "APPROVED":
    case "IN_PRODUCTION":
      return { index: 2, attention: false };
    case "CREATIVE_CHANGES_REQUESTED":
      return { index: 2, attention: true };
    case "CREATIVE_REVIEW":
      return { index: 3, attention: false };
    case "READY_TO_PUBLISH":
    case "SCHEDULED":
      return { index: 4, attention: false };
    case "PUBLISHED":
      return { index: PIPELINE_STEPS.length, attention: false };
    case "ARCHIVED":
      return { index: -1, attention: false };
  }
}

/** One-line "what happens next" for the team and the client. */
export const TEAM_HINT: Record<ContentStatus, string> = {
  DRAFT: "Fill in the script, caption, keywords and hashtags, then send it for internal review.",
  INTERNAL_REVIEW: "Check the plan, then send it to the client.",
  CLIENT_REVIEW: "Waiting for the client to approve the script and caption. Editing is locked meanwhile.",
  CHANGES_REQUESTED: "The client asked for changes to the plan. Update it and send it back.",
  APPROVED: "Plan approved. Upload the reel / carousel / post creative to start production (or skip it for text-only content).",
  IN_PRODUCTION: "Upload the finished creative, then send it to the client for approval.",
  CREATIVE_REVIEW: "Waiting for the client to approve the creative. Editing is locked meanwhile.",
  CREATIVE_CHANGES_REQUESTED: "The client asked for changes to the creative. Upload a revised version and send it again.",
  READY_TO_PUBLISH: "Approved by the client. Publish it, or mark it scheduled.",
  SCHEDULED: "Scheduled. Mark it published once it's live.",
  PUBLISHED: "Live.",
  ARCHIVED: "Archived.",
};

export const CLIENT_HINT: Partial<Record<ContentStatus, string>> = {
  CLIENT_REVIEW: "Step 1 of 2: please review the script and caption.",
  CHANGES_REQUESTED: "You asked for changes to the plan. We're working on them.",
  APPROVED: "You approved the plan. The creative is being produced — you'll review it next.",
  IN_PRODUCTION: "The creative is being produced. You'll be asked to review it when it's ready.",
  CREATIVE_REVIEW: "Step 2 of 2: please review the final creative. Approving it clears it to be published.",
  CREATIVE_CHANGES_REQUESTED: "You asked for changes to the creative. We're working on them.",
  READY_TO_PUBLISH: "Approved. It will be published on the scheduled date.",
  SCHEDULED: "Approved and scheduled.",
  PUBLISHED: "Published.",
};

export function formatDate(d: Date | null | undefined) {
  if (!d) return "Unscheduled";
  return d.toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
}

export const TYPE_SHORT: Record<ContentType, string> = {
  INSTAGRAM_REEL: "Reel",
  INSTAGRAM_CAROUSEL: "Carousel",
  INSTAGRAM_STORY: "Story",
  INSTAGRAM_STATIC: "Post",
  FACEBOOK_POST: "FB",
  LINKEDIN_POST: "LinkedIn",
  YOUTUBE_VIDEO: "YouTube",
  YOUTUBE_SHORTS: "Short",
  PINTEREST_PIN: "Pin",
  GOOGLE_BUSINESS_POST: "GBP",
  REDDIT_CONTENT: "Reddit",
  QUORA_CONTENT: "Quora",
  BLOG: "Blog",
  EMAIL_CAMPAIGN: "Email",
};

/** Sort key inside a day: explicit time first, then untimed items in creation order. */
export function dayOrder(a: { scheduledTime: string | null; createdAt: Date }, b: { scheduledTime: string | null; createdAt: Date }) {
  if (a.scheduledTime && b.scheduledTime) return a.scheduledTime.localeCompare(b.scheduledTime);
  if (a.scheduledTime) return -1;
  if (b.scheduledTime) return 1;
  return a.createdAt.getTime() - b.createdAt.getTime();
}
