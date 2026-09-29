import { PrismaClient, RoleName } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: "the-aura-lab" },
    update: {},
    create: { name: "The Aura Lab", slug: "the-aura-lab" },
  });

  const roles = await Promise.all(
    Object.values(RoleName).map((name) =>
      prisma.role.upsert({
        where: { organizationId_name: { organizationId: org.id, name } },
        update: {},
        create: { organizationId: org.id, name },
      })
    )
  );
  const superAdminRole = roles.find((r) => r.name === "SUPER_ADMIN")!;
  const clientRole = roles.find((r) => r.name === "CLIENT")!;

  const seedPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!seedPassword || seedPassword.length < 12) {
    throw new Error("Set SEED_ADMIN_PASSWORD (12+ chars) in .env before seeding");
  }
  const passwordHash = await bcrypt.hash(seedPassword, 10);

  await prisma.user.upsert({
    where: { email: "admin@theauralab.com" },
    update: {},
    create: {
      organizationId: org.id,
      name: "Siddarth",
      email: "admin@theauralab.com",
      passwordHash,
      roleId: superAdminRole.id,
    },
  });

  const client = await prisma.client.upsert({
    where: { id: "seed-client-neend" },
    update: {},
    create: {
      id: "seed-client-neend",
      organizationId: org.id,
      name: "NEEND Mattress",
      createdBy: "seed",
    },
  });

  await prisma.brand.upsert({
    where: { id: "seed-brand-neend" },
    update: {},
    create: { id: "seed-brand-neend", clientId: client.id, name: "NEEND" },
  });

  // Sample day plan: a reel, carousel, two stories and a blog on the same day.
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + 3);
  day.setUTCHours(0, 0, 0, 0);
  const samples = [
    {
      id: "seed-content-reel", type: "INSTAGRAM_REEL" as const, title: "3 sleep mistakes ruining your back", scheduledTime: "18:00", status: "CLIENT_REVIEW" as const,
      caption: "Waking up with a stiff back? These three habits could be why.\n\nSave this for tonight.",
      seoKeywords: ["best mattress for back pain", "sleep posture"], hashtags: ["backpain", "sleeptips", "neend"],
      script: { hook: "Your mattress might be the reason your back hurts.", cta: "Follow for better sleep",
        blocks: [
          { title: "Mistake 1", copy: "Sleeping on a sagging mattress", visual: "Side-on shot of a sagging mattress", duration: "0:05" },
          { title: "Mistake 2", copy: "Too many pillows", visual: "Stack of pillows, neck angle overlay", duration: "0:05" },
        ] },
    },
    {
      id: "seed-content-carousel", type: "INSTAGRAM_CAROUSEL" as const, title: "Mattress buying checklist", scheduledTime: "12:00", status: "INTERNAL_REVIEW" as const,
      caption: "Buying a mattress? Swipe through the checklist.", seoKeywords: ["mattress buying guide"], hashtags: ["mattress", "buyingguide"],
      script: { hook: "Read this before you buy a mattress", cta: "Save for later",
        blocks: [
          { title: "Cover", copy: "The 5-point mattress checklist", visual: "Brand teal background", duration: "" },
          { title: "Firmness", copy: "Match firmness to your sleeping position", visual: "Icon set", duration: "" },
        ] },
    },
    {
      id: "seed-content-story-1", type: "INSTAGRAM_STORY" as const, title: "Poll: side sleeper or back sleeper?", scheduledTime: "09:00", status: "DRAFT" as const,
      caption: null, seoKeywords: [], hashtags: [],
      script: { hook: "", cta: "", blocks: [{ title: "Poll", copy: "Side sleeper or back sleeper?", visual: "Poll sticker", duration: "" }] },
    },
    {
      id: "seed-content-story-2", type: "INSTAGRAM_STORY" as const, title: "Reel reminder story", scheduledTime: "18:15", status: "DRAFT" as const,
      caption: null, seoKeywords: [], hashtags: [],
      script: { hook: "", cta: "Watch the reel", blocks: [{ title: "Reshare", copy: "New reel is live", visual: "Reshare the reel", duration: "" }] },
    },
    {
      id: "seed-content-blog", type: "BLOG" as const, title: "How to choose a mattress for back pain", scheduledTime: null, status: "DRAFT" as const,
      caption: "New on the blog: how to choose a mattress for back pain.", seoKeywords: ["mattress for back pain", "orthopedic mattress"], hashtags: [],
      script: { hook: "", cta: "Book a free sleep consult", blocks: [{ title: "Why mattresses cause back pain", copy: "Support vs. comfort", visual: "", duration: "" }] },
    },
  ];
  for (const c of samples) {
    await prisma.contentItem.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id, brandId: "seed-brand-neend", type: c.type, status: c.status, title: c.title, caption: c.caption,
        scheduledFor: day, scheduledTime: c.scheduledTime, seoKeywords: c.seoKeywords, hashtags: c.hashtags,
        script: c.script, createdBy: "seed",
        versions: { create: { versionNumber: 1, caption: c.caption, createdBy: "seed" } },
      },
    });
  }

  // Sample items further down the pipeline so the second client gate can be tried straight away.
  await prisma.contentItem.upsert({
    where: { id: "seed-content-static" },
    update: {},
    create: {
      id: "seed-content-static", brandId: "seed-brand-neend", type: "INSTAGRAM_STATIC", status: "CREATIVE_REVIEW",
      title: "Sleep better tonight — offer post", caption: "Two nights, one better sleep. Link in bio.",
      seoKeywords: ["orthopedic mattress"], hashtags: ["neend", "sleepbetter"], scheduledFor: day, scheduledTime: "20:00",
      script: { hook: "", cta: "Shop now", blocks: [] }, creativeRound: 1, createdBy: "seed",
      versions: { create: { versionNumber: 1, caption: "Two nights, one better sleep. Link in bio.", createdBy: "seed" } },
      creatives: { create: { id: "seed-creative-static", round: 1, kind: "LINK", fileName: "Offer post (sample link)", linkUrl: "https://example.com/offer-post", uploadedBy: "seed" } },
    },
  });
  await prisma.contentItem.upsert({
    where: { id: "seed-content-approved" },
    update: {},
    create: {
      id: "seed-content-approved", brandId: "seed-brand-neend", type: "INSTAGRAM_CAROUSEL", status: "APPROVED",
      title: "5 signs your mattress is too old", caption: "Swipe to see if it's time for a change.",
      seoKeywords: ["when to replace mattress"], hashtags: ["mattress", "sleep"], scheduledFor: day,
      script: { hook: "Is your mattress past its prime?", cta: "Save this", blocks: [{ title: "Sign 1", copy: "Visible sagging", visual: "", duration: "" }] },
      createdBy: "seed",
      versions: { create: { versionNumber: 1, caption: "Swipe to see if it's time for a change.", createdBy: "seed" } },
    },
  });

  // Services this seed client has bought — drives what content types they can plan.
  await prisma.clientService.createMany({
    data: [
      { clientId: "seed-client-neend", category: "SOCIAL_MEDIA_MARKETING", enabled: true, scopeItems: ["Instagram marketing", "Content calendar", "Community management"] },
      { clientId: "seed-client-neend", category: "CONTENT_CREATION", enabled: true, scopeItems: ["Blog writing", "Caption writing"] },
      { clientId: "seed-client-neend", category: "GRAPHIC_DESIGN", enabled: true, scopeItems: ["Social media post design", "Carousel design"] },
      { clientId: "seed-client-neend", category: "SEO", enabled: true, scopeItems: ["On-page SEO", "Keyword research"] },
      { clientId: "seed-client-neend", category: "PERFORMANCE_MARKETING", enabled: false, scopeItems: [] },
    ],
    skipDuplicates: true,
  });

  // A couple of parked ideas so the idea bank isn't empty on first login.
  await prisma.contentIdea.createMany({
    data: [
      { id: "seed-idea-1", brandId: "seed-brand-neend", title: "Customer testimonial series — 3 reels", contentType: "INSTAGRAM_REEL", priority: "HIGH", tags: ["ugc", "testimonial"], createdBy: "seed" },
      { id: "seed-idea-2", brandId: "seed-brand-neend", title: "Blog: How memory foam affects back pain", contentType: "BLOG", priority: "MEDIUM", tags: ["seo"], createdBy: "seed", notes: "Target keyword: memory foam back pain" },
    ],
    skipDuplicates: true,
  });

  await prisma.user.upsert({
    where: { email: "client@neend.com" },
    update: {},
    create: {
      organizationId: org.id,
      name: "NEEND Contact",
      email: "client@neend.com",
      passwordHash,
      roleId: clientRole.id,
      clientId: client.id,
    },
  });

  console.log("Seeded. Login as admin@theauralab.com with SEED_ADMIN_PASSWORD");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
