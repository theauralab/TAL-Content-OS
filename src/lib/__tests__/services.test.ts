import { describe, expect, it } from "vitest";
import { allowedContentTypes, CONTENT_TYPE_REQUIRES, SERVICE_CATALOG, SERVICE_ORDER, enabledCategories, resolveIdeaContentType } from "@/lib/services";

describe("service catalog", () => {
  it("has all 28 categories, each with a label and at least one line item", () => {
    expect(SERVICE_ORDER).toHaveLength(28);
    for (const c of SERVICE_ORDER) {
      expect(SERVICE_CATALOG[c].label.length).toBeGreaterThan(0);
      expect(SERVICE_CATALOG[c].items.length).toBeGreaterThan(0);
    }
  });
  it("every content type maps to at least one category", () => {
    for (const reqs of Object.values(CONTENT_TYPE_REQUIRES)) expect(reqs.length).toBeGreaterThan(0);
  });
});

describe("allowedContentTypes", () => {
  it("shows everything when the client has never been configured (backward compatible)", () => {
    expect(allowedContentTypes(null)).toHaveLength(14);
    expect(allowedContentTypes({})).toHaveLength(14);
  });
  it("filters to only what's enabled once configured", () => {
    const state = { SOCIAL_MEDIA_MARKETING: { enabled: true, scopeItems: [], notes: null } };
    const types = allowedContentTypes(state);
    expect(types).toContain("INSTAGRAM_CAROUSEL");
    expect(types).not.toContain("EMAIL_CAMPAIGN");
    expect(types).not.toContain("BLOG");
  });
  it("a disabled row counts as off, not as unset", () => {
    const state = { SOCIAL_MEDIA_MARKETING: { enabled: false, scopeItems: [], notes: null }, EMAIL_MARKETING: { enabled: true, scopeItems: [], notes: null } };
    const types = allowedContentTypes(state);
    expect(types).not.toContain("INSTAGRAM_CAROUSEL");
    expect(types).toEqual(["EMAIL_CAMPAIGN"]);
  });
  it("a type with several qualifying categories needs only one of them", () => {
    const state = { VIDEO_PRODUCTION: { enabled: true, scopeItems: [], notes: null } };
    expect(allowedContentTypes(state)).toContain("INSTAGRAM_REEL");
  });
});

describe("enabledCategories", () => {
  it("returns categories in catalog order, enabled only", () => {
    const state = { SEO: { enabled: true, scopeItems: [], notes: null }, STRATEGY: { enabled: true, scopeItems: [], notes: null } };
    expect(enabledCategories(state)).toEqual(["STRATEGY", "SEO"]);
  });
});

describe("resolveIdeaContentType", () => {
  it("keeps the idea's own type when it's still allowed", () => {
    expect(resolveIdeaContentType("BLOG", ["BLOG", "EMAIL_CAMPAIGN"])).toBe("BLOG");
  });
  it("falls back to the first allowed type when the idea's type is no longer covered", () => {
    expect(resolveIdeaContentType("BLOG", ["EMAIL_CAMPAIGN"])).toBe("EMAIL_CAMPAIGN");
  });
  it("falls back when the idea had no type at all", () => {
    expect(resolveIdeaContentType(null, ["INSTAGRAM_REEL"])).toBe("INSTAGRAM_REEL");
  });
  it("returns null when nothing is allowed", () => {
    expect(resolveIdeaContentType("BLOG", [])).toBeNull();
  });
});
