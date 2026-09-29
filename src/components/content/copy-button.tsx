"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          window.prompt("Copy this text:", text);
        }
      }}
      className={className ?? "rounded-md border border-neutral bg-white px-3 py-1 text-xs hover:border-secondary"}
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}
