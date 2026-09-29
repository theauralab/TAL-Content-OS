import type { ContentIdea, ContentType, IdeaPriority } from "@prisma/client";
import { TYPE_LABEL } from "@/lib/content";
import { addIdea, deleteIdea, updateIdeaStatus, useIdea } from "@/app/(app)/actions/ideas";
import { ConfirmButton } from "@/components/common/confirm-button";

const PRIORITY_STYLE: Record<IdeaPriority, string> = {
  HIGH: "bg-red-100 text-red-700",
  MEDIUM: "bg-amber-100 text-amber-800",
  LOW: "bg-neutral text-primary/60",
};

/**
 * The "someday" bucket next to the calendar: ideas the team collects whenever they think of them,
 * independent of any date. "Use this idea" turns one into a real draft, pre-filled.
 */
export function IdeaBank({
  brandId,
  ideas,
  creatableTypes,
  canManage,
}: {
  brandId: string;
  ideas: ContentIdea[];
  creatableTypes: ContentType[];
  canManage: boolean;
}) {
  const open = ideas.filter((i) => i.status === "IDEA" || i.status === "PLANNED");
  const used = ideas.filter((i) => i.status === "USED");

  return (
    <details className="rounded-lg border border-neutral bg-white">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-primary">
        💡 Idea bank <span className="font-normal text-primary/50">· {open.length} open</span>
      </summary>
      <div className="space-y-4 border-t border-neutral p-4">
        {canManage && (
          <form action={addIdea} className="grid gap-2 sm:grid-cols-[1fr_9rem_7rem_auto] text-sm">
            <input type="hidden" name="brandId" value={brandId} />
            <input name="title" required placeholder="Idea — a hook, a theme, a trend to try" className="rounded-md border border-neutral px-3 py-2" />
            <select name="contentType" defaultValue="" className="rounded-md border border-neutral px-3 py-2">
              <option value="">Any format</option>
              {Object.entries(TYPE_LABEL).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
            <select name="priority" defaultValue="MEDIUM" className="rounded-md border border-neutral px-3 py-2">
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
            <button type="submit" className="rounded-md bg-primary px-4 py-2 font-medium text-white hover:opacity-90">Add</button>
            <textarea name="notes" rows={2} placeholder="Notes (optional)" className="rounded-md border border-neutral px-3 py-2 sm:col-span-3" />
            <input name="tags" placeholder="Tags, comma separated (optional)" className="rounded-md border border-neutral px-3 py-2" />
          </form>
        )}

        {open.length === 0 ? (
          <p className="text-sm text-primary/50">No ideas parked yet — drop in anything worth trying later.</p>
        ) : (
          <ul className="space-y-2">
            {[...open].sort((a, b) => (a.priority === b.priority ? 0 : a.priority === "HIGH" ? -1 : b.priority === "HIGH" ? 1 : 0)).map((idea) => (
              <li key={idea.id} className="rounded-md border border-neutral p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-primary">{idea.title}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${PRIORITY_STYLE[idea.priority]}`}>{idea.priority}</span>
                      {idea.contentType && <span className="rounded bg-neutral px-1.5 py-0.5 text-[10px] text-primary/70">{TYPE_LABEL[idea.contentType]}</span>}
                      {idea.status === "PLANNED" && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-800">Planned</span>}
                    </div>
                    {idea.notes && <p className="mt-1 whitespace-pre-wrap text-primary/70">{idea.notes}</p>}
                    {idea.tags.length > 0 && <p className="mt-1 text-xs text-primary/40">#{idea.tags.join(" #")}</p>}
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
                      {idea.status === "IDEA" && (
                        <form action={updateIdeaStatus}>
                          <input type="hidden" name="id" value={idea.id} />
                          <input type="hidden" name="status" value="PLANNED" />
                          <button className="text-primary/60 hover:text-primary hover:underline">Mark planned</button>
                        </form>
                      )}
                      <form action={useIdea} className="flex items-center gap-1">
                        <input type="hidden" name="id" value={idea.id} />
                        <input type="date" name="scheduledFor" aria-label="Schedule for" className="rounded border border-neutral px-1.5 py-1" />
                        <button
                          disabled={creatableTypes.length === 0}
                          className="rounded bg-success px-2 py-1 font-medium text-white hover:opacity-90 disabled:opacity-40"
                          title={creatableTypes.length === 0 ? "No enabled service covers a plannable content type" : "Create a draft from this idea"}
                        >
                          Use this idea
                        </button>
                      </form>
                      <form action={deleteIdea}>
                        <input type="hidden" name="id" value={idea.id} />
                        <ConfirmButton message={`Delete the idea "${idea.title}"?`} className="text-danger hover:underline">Delete</ConfirmButton>
                      </form>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {used.length > 0 && (
          <details>
            <summary className="cursor-pointer text-xs text-primary/50">{used.length} used already</summary>
            <ul className="mt-2 space-y-1">
              {used.map((idea) => (
                <li key={idea.id} className="text-xs text-primary/40 line-through">{idea.title}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </details>
  );
}
