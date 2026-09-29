import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { requireUser, requireContent, channelFor } from "@/lib/access";
import {
  CLIENT_HINT,
  CLIENT_LOCKED_STATUSES,
  CLIENT_REVIEW_STAGE,
  CREATIVE_UPLOAD_STATUSES,
  STATUS_LABEL,
  STATUS_STYLE,
  TEAM_HINT,
  TYPE_LABEL,
  allowedNext,
  formatDate,
  maxRoundVisibleToClient,
  pipelineState,
  transitionLabel,
} from "@/lib/content";
import { addComment, changeStatus, decideContent, deleteContent } from "@/app/(app)/actions/content";
import { creativeHint } from "@/lib/creatives";
import { storageConfigured } from "@/lib/storage";
import { Pipeline } from "@/components/content/pipeline";
import { CreativeGallery } from "@/components/content/creative-gallery";
import { CreativeUploader } from "@/components/content/creative-uploader";
import { ContentEditor } from "@/components/content/content-editor";
import { PlanView } from "@/components/content/plan-view";
import { readScript } from "@/lib/script";
import { ConfirmButton } from "@/components/common/confirm-button";
import { LiveRefresh } from "@/components/common/live-refresh";

const stamp = (d: Date) =>
  d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default async function ContentPage({ params }: { params: Promise<{ contentId: string }> }) {
  const { contentId } = await params;
  const user = await requireUser();
  const item = await requireContent(contentId, user).catch(() => null);
  if (!item) notFound();

  const detail = await prisma.contentItem.findUniqueOrThrow({
    where: { id: item.id },
    include: {
      versions: { orderBy: { versionNumber: "desc" } },
      approvals: { orderBy: { createdAt: "desc" }, include: { decidedBy: { select: { name: true } } } },
      comments: { where: { deletedAt: null }, orderBy: { createdAt: "asc" }, include: { author: { select: { name: true, role: { select: { name: true } } } } } },
    },
  });

  const isClient = user.role === "CLIENT";
  const canEdit = can(user.role, "content", "update");
  const canDelete = can(user.role, "content", "delete");
  const canUpload = can(user.role, "asset", "create");
  const next = allowedNext(user.role, item.status);
  const locked = CLIENT_LOCKED_STATUSES.includes(item.status);
  const stage = CLIENT_REVIEW_STAGE[item.status];
  const awaitingClient = isClient && !!stage;
  const backHref = `/clients/${item.brand.clientId}/brands/${item.brandId}`;

  // Clients only ever get creatives from rounds that have been sent to them; work in progress stays internal.
  const creatives = await prisma.creative.findMany({
    where: {
      contentItemId: item.id,
      deletedAt: null,
      ...(isClient ? { round: { lte: maxRoundVisibleToClient(item.status, item.creativeRound) } } : {}),
    },
    orderBy: [{ round: "desc" }, { position: "asc" }],
  });
  const inProduction = CREATIVE_UPLOAD_STATUSES.includes(item.status);
  const showCreatives = creatives.length > 0 || (!isClient && (pipelineState(item.status).index >= 2 || inProduction));
  const activeRound = item.status === "IN_PRODUCTION" ? item.creativeRound : 0;

  // What the client last asked for, so the team sees it front and centre when they pick the work back up.
  const feedbackStage = item.status === "CHANGES_REQUESTED" ? "PLAN" : item.status === "CREATIVE_CHANGES_REQUESTED" ? "CREATIVE" : null;
  const feedback = feedbackStage ? detail.approvals.find((a) => a.decision === "CHANGES_REQUESTED" && a.stage === feedbackStage) : null;
  const hint = isClient ? CLIENT_HINT[item.status] : TEAM_HINT[item.status];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <LiveRefresh channel={channelFor(user)} contentId={item.id} />

      <div>
        <div className="text-sm text-primary/60">
          <Link href={backHref} className="hover:text-primary">← {item.brand.client.name} / {item.brand.name}</Link>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-semibold text-primary">{item.title}</h1>
          <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLE[item.status]}`}>{STATUS_LABEL[item.status]}</span>
        </div>
        <p className="text-sm text-primary/60">{TYPE_LABEL[item.type]} · {formatDate(item.scheduledFor)}{item.scheduledTime ? ` · ${item.scheduledTime}` : ""}</p>
      </div>

      {item.status !== "ARCHIVED" && <Pipeline status={item.status} />}
      {hint && <p className="text-sm text-primary/70">{hint}</p>}
      {item.publishedUrl && (
        <p className="text-sm"><a href={item.publishedUrl} target="_blank" rel="noreferrer" className="text-secondary hover:underline">View the live post ↗</a></p>
      )}

      {feedback && (
        <div role="note" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
          <div className="mb-1 font-semibold text-red-800">{isClient ? "Your feedback" : "Client feedback"}</div>
          <p className="whitespace-pre-wrap text-primary">{feedback.note}</p>
          <p className="mt-1 text-xs text-primary/50">{feedback.decidedBy.name} · {stamp(feedback.createdAt)}</p>
        </div>
      )}

      {awaitingClient && stage && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h2 className="mb-1 text-sm font-semibold text-primary">
            {stage === "PLAN" ? "Step 1 of 2 — review the plan" : "Step 2 of 2 — review the creative"}
          </h2>
          <p className="mb-3 text-xs text-primary/60">
            {stage === "PLAN"
              ? "Check the script, caption, keywords and hashtags below. Approving lets us start producing it."
              : "Check the finished creative below. Approving clears it to be published."}
          </p>
          {stage === "CREATIVE" && (
            <div className="mb-4"><CreativeGallery creatives={creatives} activeRound={0} canRemove={false} /></div>
          )}
          <form action={decideContent} className="grid gap-2 text-sm">
            <input type="hidden" name="id" value={item.id} />
            <textarea name="note" rows={2} aria-label="Notes" placeholder="Notes (required if you're requesting changes)" className="rounded-md border border-neutral px-3 py-2" />
            <div className="flex gap-2">
              <button name="decision" value="APPROVED" className="rounded-md bg-success px-4 py-2 font-medium text-white hover:opacity-90">
                {stage === "PLAN" ? "Approve plan" : "Approve creative"}
              </button>
              <button name="decision" value="CHANGES_REQUESTED" className="rounded-md bg-warning px-4 py-2 font-medium text-white hover:opacity-90">Request changes</button>
            </div>
          </form>
        </div>
      )}

      {canEdit && next.length > 0 && (
        <div className="flex flex-wrap items-start gap-2 text-sm">
          {next.map((to) => {
            const primary =
              to === "CLIENT_REVIEW" || to === "CREATIVE_REVIEW" || to === "PUBLISHED" ||
              (to === "IN_PRODUCTION" && item.status === "APPROVED") || (to === "INTERNAL_REVIEW" && item.status === "DRAFT");
            const cls = primary
              ? "rounded-md bg-primary px-3 py-1.5 font-medium text-white hover:opacity-90"
              : "rounded-md border border-neutral bg-white px-3 py-1.5 hover:border-secondary";
            return (
              <form key={to} action={changeStatus} className="flex items-center gap-2">
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="to" value={to} />
                {to === "PUBLISHED" && (
                  <input name="publishedUrl" type="url" placeholder="Link to live post (optional)" aria-label="Link to live post" className="w-56 rounded-md border border-neutral px-2 py-1.5" />
                )}
                <button className={cls}>{transitionLabel(item.status, to)}</button>
              </form>
            );
          })}
        </div>
      )}

      {locked && !isClient && (
        <p role="note" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          With the client for review — editing is locked so they never approve something that then changes. Use the pull-back button above if you need to edit.
        </p>
      )}

      {showCreatives && !(awaitingClient && stage === "CREATIVE") && (
        <section className="rounded-lg border border-neutral bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-primary">Creative</h2>
          {!isClient && canUpload && inProduction && (
            <div className="mb-5 border-b border-neutral pb-5">
              <CreativeUploader contentId={item.id} hint={creativeHint(item.type)} storageReady={storageConfigured()} />
            </div>
          )}
          {!isClient && !canUpload && inProduction && (
            <p className="mb-3 text-xs text-primary/50">Designers and video editors upload the creative.</p>
          )}
          <CreativeGallery creatives={creatives} activeRound={activeRound} canRemove={!isClient && canUpload} />
        </section>
      )}

      {canEdit && !locked ? (
        <ContentEditor
          item={{
            id: item.id,
            title: item.title,
            type: item.type,
            scheduledFor: item.scheduledFor?.toISOString().slice(0, 10) ?? "",
            scheduledTime: item.scheduledTime ?? "",
            caption: item.caption ?? "",
            objective: item.objective ?? "",
            script: readScript(item.script),
            visualBrief: item.visualBrief ?? "",
            cta: item.cta ?? "",
            seoKeywords: item.seoKeywords,
            hashtags: item.hashtags,
            seoTitle: item.seoTitle ?? "",
            metaDescription: item.metaDescription ?? "",
            slug: item.slug ?? "",
            body: item.body ?? "",
          }}
        />
      ) : (
        <PlanView
          item={{
            type: item.type,
            caption: item.caption,
            objective: item.objective,
            script: readScript(item.script),
            visualBrief: item.visualBrief,
            seoKeywords: item.seoKeywords,
            hashtags: item.hashtags,
            seoTitle: item.seoTitle,
            metaDescription: item.metaDescription,
            slug: item.slug,
            body: item.body,
          }}
        />
      )}

      <section className="rounded-lg border border-neutral bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-primary">Comments</h2>
        <div className="space-y-3">
          {detail.comments.map((c) => (
            <div key={c.id} className="text-sm">
              <div className="text-xs text-primary/50">{c.author.name} · {c.author.role.name === "CLIENT" ? "Client" : "Team"} · {stamp(c.createdAt)}</div>
              <div className="whitespace-pre-wrap text-primary">{c.body}</div>
            </div>
          ))}
          {detail.comments.length === 0 && <p className="text-sm text-primary/50">No comments yet.</p>}
        </div>
        <form action={addComment} className="mt-4 flex gap-2 text-sm">
          <input type="hidden" name="id" value={item.id} />
          <input name="body" required placeholder="Write a comment…" className="flex-1 rounded-md border border-neutral px-3 py-2" />
          <button type="submit" className="rounded-md bg-primary px-4 py-2 font-medium text-white hover:opacity-90">Send</button>
        </form>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-lg border border-neutral bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-primary">Approval history</h2>
          {detail.approvals.map((a) => (
            <div key={a.id} className="mb-2 text-sm">
              <span className="font-medium text-primary">{a.stage === "CREATIVE" ? "Creative" : "Plan"} · {a.decision === "APPROVED" ? "approved" : "changes requested"}</span>
              <span className="text-primary/50"> · {a.decidedBy.name} · {stamp(a.createdAt)}</span>
              {a.note && <div className="text-primary/80">{a.note}</div>}
            </div>
          ))}
          {detail.approvals.length === 0 && <p className="text-sm text-primary/50">No decisions yet.</p>}
        </section>

        {!isClient && (
          <section className="rounded-lg border border-neutral bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-primary">Version history</h2>
            {detail.versions.map((v) => (
              <div key={v.id} className="mb-2 text-sm">
                <span className="font-medium text-primary">v{v.versionNumber}</span>
                <span className="text-primary/50"> · {stamp(v.createdAt)}</span>
                {v.caption && <div className="line-clamp-2 text-primary/70">{v.caption}</div>}
              </div>
            ))}
          </section>
        )}
      </div>

      {canDelete && (
        <form action={deleteContent}>
          <input type="hidden" name="id" value={item.id} />
          <ConfirmButton message="Delete this content item?" className="text-sm text-danger hover:underline">Delete content</ConfirmButton>
        </form>
      )}
    </div>
  );
}
