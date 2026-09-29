"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendMessage, type ChatResult } from "@/app/(app)/actions/chat";

export type ChatMessage = { id: string; body: string; createdAt: string; senderName: string; mine: boolean };

export function ChatThread({ clientId, messages, placeholder }: { clientId: string; messages: ChatMessage[]; placeholder: string }) {
  const [state, action, pending] = useActionState<ChatResult, FormData>(sendMessage, null);
  const formRef = useRef<HTMLFormElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <div className="flex h-[32rem] flex-col rounded-lg border border-neutral bg-white">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && <p className="text-center text-sm text-primary/40">{placeholder}</p>}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.mine ? "bg-primary text-white" : "bg-background text-primary"}`}>
              {!m.mine && <div className="mb-0.5 text-xs font-semibold opacity-70">{m.senderName}</div>}
              <div className="whitespace-pre-wrap">{m.body}</div>
              <div className={`mt-1 text-[10px] ${m.mine ? "text-white/60" : "text-primary/40"}`}>
                {new Date(m.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form ref={formRef} action={action} className="flex items-end gap-2 border-t border-neutral p-3">
        <input type="hidden" name="clientId" value={clientId} />
        <textarea
          name="body"
          rows={1}
          required
          maxLength={4000}
          placeholder="Write a message…"
          aria-label="Message"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) e.currentTarget.form?.requestSubmit();
          }}
          className="flex-1 resize-none rounded-md border border-neutral px-3 py-2 text-sm"
        />
        <button type="submit" disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60">
          {pending ? "…" : "Send"}
        </button>
      </form>
      {state && !state.ok && <p role="alert" className="px-3 pb-2 text-xs text-danger">{state.message}</p>}
    </div>
  );
}
