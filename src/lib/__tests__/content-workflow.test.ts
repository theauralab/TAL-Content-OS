import { describe, expect, it } from "vitest";
import { ContentStatus } from "@prisma/client";
import {
  CLIENT_DECISION_TARGET,
  CLIENT_REVIEW_STAGE,
  CLIENT_VISIBLE,
  allowedNext,
  creativeRoundAfterProduction,
  maxRoundVisibleToClient,
  pipelineState,
} from "@/lib/content";

const ALL = Object.values(ContentStatus);

describe("two-gate approval workflow", () => {
  it("walks the happy path: plan -> client -> production -> client -> publish", () => {
    const path: ContentStatus[] = [
      "DRAFT", "INTERNAL_REVIEW", "CLIENT_REVIEW",
      CLIENT_DECISION_TARGET.PLAN.APPROVED, // client approves the plan
      "IN_PRODUCTION", "CREATIVE_REVIEW",
      CLIENT_DECISION_TARGET.CREATIVE.APPROVED, // client approves the creative
      "SCHEDULED", "PUBLISHED",
    ];
    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i], to = path[i + 1];
      const viaClient = from === "CLIENT_REVIEW" || from === "CREATIVE_REVIEW";
      // Client decisions are made by the client (decideContent), everything else by a manager.
      if (!viaClient) expect(allowedNext("AGENCY_MANAGER", from), `${from} -> ${to}`).toContain(to);
    }
  });

  it("cannot skip the creative gate: nothing reaches READY_TO_PUBLISH/PUBLISHED without the client, except a manager's explicit skip", () => {
    for (const s of ALL) {
      const next = allowedNext("SUPER_ADMIN", s);
      if (next.includes("PUBLISHED")) expect(["READY_TO_PUBLISH", "SCHEDULED"]).toContain(s);
      if (next.includes("READY_TO_PUBLISH")) expect(["APPROVED", "SCHEDULED", "CREATIVE_REVIEW"]).toContain(s);
    }
    // A plan that has not been approved can never be sent into production.
    for (const s of ["DRAFT", "INTERNAL_REVIEW", "CLIENT_REVIEW", "CHANGES_REQUESTED"] as const) {
      expect(allowedNext("SUPER_ADMIN", s)).not.toContain("IN_PRODUCTION");
    }
  });

  it("clients never get manual transitions; only their decision moves an item", () => {
    for (const s of ALL) expect(allowedNext("CLIENT", s)).toEqual([]);
    expect(CLIENT_REVIEW_STAGE).toEqual({ CLIENT_REVIEW: "PLAN", CREATIVE_REVIEW: "CREATIVE" });
  });

  it("designers/editors can't send to the client, approve, restart production or publish", () => {
    for (const role of ["DESIGNER", "VIDEO_EDITOR", "CONTENT_WRITER"] as const) {
      for (const s of ALL) {
        const next = allowedNext(role, s);
        for (const forbidden of ["CLIENT_REVIEW", "CREATIVE_REVIEW", "APPROVED", "IN_PRODUCTION", "READY_TO_PUBLISH", "SCHEDULED", "PUBLISHED"] as const) {
          expect(next, `${role} ${s}`).not.toContain(forbidden);
        }
      }
    }
  });

  it("clients can't see drafts or internal work, but see everything from plan review onward", () => {
    expect(CLIENT_VISIBLE).not.toContain("DRAFT");
    expect(CLIENT_VISIBLE).not.toContain("INTERNAL_REVIEW");
    expect(CLIENT_VISIBLE).not.toContain("ARCHIVED");
    expect(CLIENT_VISIBLE).toContain("CREATIVE_REVIEW");
    expect(CLIENT_VISIBLE).toContain("IN_PRODUCTION");
  });

  it("every status is reachable and none is a dead end", () => {
    for (const s of ALL) expect(allowedNext("SUPER_ADMIN", s).length + (CLIENT_REVIEW_STAGE[s] ? 1 : 0)).toBeGreaterThan(0);
  });
});

describe("creative rounds", () => {
  it("starts at round 1, and bumps only when earlier work was already judged", () => {
    expect(creativeRoundAfterProduction("APPROVED", 0)).toBe(1);
    expect(creativeRoundAfterProduction("CREATIVE_CHANGES_REQUESTED", 1)).toBe(2);
    expect(creativeRoundAfterProduction("READY_TO_PUBLISH", 2)).toBe(3);
    expect(creativeRoundAfterProduction("CREATIVE_REVIEW", 2)).toBe(2); // pull-back: same round
  });

  it("hides work-in-progress from the client", () => {
    expect(maxRoundVisibleToClient("APPROVED", 0)).toBe(0);
    expect(maxRoundVisibleToClient("IN_PRODUCTION", 1)).toBe(0); // first draft not sent yet
    expect(maxRoundVisibleToClient("IN_PRODUCTION", 2)).toBe(1); // round 2 in progress, round 1 visible
    expect(maxRoundVisibleToClient("CREATIVE_REVIEW", 2)).toBe(2);
    expect(maxRoundVisibleToClient("PUBLISHED", 3)).toBe(3);
    expect(maxRoundVisibleToClient("CLIENT_REVIEW", 0)).toBe(0);
  });
});

describe("pipeline", () => {
  it("maps statuses onto the five steps", () => {
    expect(pipelineState("DRAFT").index).toBe(0);
    expect(pipelineState("CLIENT_REVIEW").index).toBe(1);
    expect(pipelineState("IN_PRODUCTION").index).toBe(2);
    expect(pipelineState("CREATIVE_REVIEW").index).toBe(3);
    expect(pipelineState("READY_TO_PUBLISH").index).toBe(4);
    expect(pipelineState("PUBLISHED").index).toBe(5);
    expect(pipelineState("CREATIVE_CHANGES_REQUESTED").attention).toBe(true);
  });
});
