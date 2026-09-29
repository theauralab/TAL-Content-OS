"use client";

import { useState } from "react";

// Chip input: Enter / comma / Tab adds, pasting "a, b, c" adds all, Backspace on empty removes the last.
export function TagInput({
  values,
  onChange,
  placeholder,
  prefix = "",
  clean,
  softLimit,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  prefix?: string;
  clean: (raw: string) => string;
  softLimit?: number;
}) {
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const parts = raw.split(/[,\n]+/).map(clean).filter(Boolean);
    if (parts.length === 0) return;
    const seen = new Set(values.map((v) => v.toLowerCase()));
    const merged = [...values];
    for (const p of parts) {
      if (!seen.has(p.toLowerCase())) {
        seen.add(p.toLowerCase());
        merged.push(p);
      }
    }
    onChange(merged);
    setDraft("");
  }

  const over = softLimit !== undefined && values.length > softLimit;

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 rounded-md border border-neutral bg-white p-2 focus-within:border-secondary">
        {values.map((v, i) => (
          <span key={v} className="inline-flex items-center gap-1 rounded bg-background px-2 py-0.5 text-xs text-primary">
            {i === 0 && prefix === "" ? <span title="Primary keyword" className="font-semibold text-secondary">★</span> : null}
            {prefix}
            {v}
            <button
              type="button"
              aria-label={`Remove ${v}`}
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="text-primary/40 hover:text-danger"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "," || (e.key === "Tab" && draft.trim())) {
              e.preventDefault();
              commit(draft);
            } else if (e.key === "Backspace" && !draft && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (/[,\n#]/.test(text)) {
              e.preventDefault();
              commit(text.replace(/#/g, ","));
            }
          }}
          onBlur={() => commit(draft)}
          placeholder={values.length ? "" : placeholder}
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none"
        />
      </div>
      {softLimit !== undefined && (
        <p className={`mt-1 text-xs ${over ? "text-warning" : "text-primary/50"}`}>
          {values.length} / {softLimit} recommended for this platform
        </p>
      )}
    </div>
  );
}
