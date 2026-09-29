import { ContentType, ServiceCategory } from "@prisma/client";

export const SERVICE_ORDER: ServiceCategory[] = [
  "STRATEGY", "BRANDING", "GRAPHIC_DESIGN", "SOCIAL_MEDIA_MARKETING", "CONTENT_CREATION",
  "VIDEO_PRODUCTION", "SEO", "GOOGLE_SEARCH_MARKETING", "META_ADVERTISING", "PERFORMANCE_MARKETING",
  "WEBSITE_DEVELOPMENT", "ECOMMERCE_MARKETING", "MARKETPLACE_MARKETING", "EMAIL_MARKETING",
  "WHATSAPP_MARKETING", "INFLUENCER_MARKETING", "LINKEDIN_B2B_MARKETING", "YOUTUBE_MARKETING",
  "ONLINE_REPUTATION_MANAGEMENT", "CONVERSION_RATE_OPTIMIZATION", "MARKETING_AUTOMATION", "AI_MARKETING",
  "APP_DEVELOPMENT", "ANALYTICS_REPORTING", "DIGITAL_PR", "PERSONAL_BRANDING", "LEAD_GENERATION", "GROWTH_MARKETING",
];

type Catalog = Record<ServiceCategory, { label: string; items: string[] }>;

// Category-level toggles drive the product (nav, calendar, gating). The line items underneath are for
// documentation and proposals only — nothing in the app logic keys off them individually.
export const SERVICE_CATALOG: Catalog = {
  STRATEGY: { label: "Digital Marketing Strategy", items: ["Digital marketing strategy","Brand growth strategy","Marketing roadmap","Competitor analysis","Market research","Target audience research","Customer persona development","Customer journey mapping","Funnel strategy","Go-to-market strategy","Campaign strategy","Channel planning","Marketing budget planning","Digital audit","Website audit","Social media audit","SEO audit","Competitor benchmarking"] },
  BRANDING: { label: "Branding & Brand Identity", items: ["Brand strategy","Brand positioning","Brand naming","Logo design","Logo redesign","Brand identity","Brand guidelines","Typography system","Colour palette","Visual identity","Brand voice","Brand messaging","Tagline development","Corporate identity","Business profile / company profile","Brand presentation","Brand collateral","Packaging design","Marketing collateral","Brand launch campaigns"] },
  GRAPHIC_DESIGN: { label: "Graphic Design & Creative", items: ["Social media post design","Carousel design","Ad creatives","Campaign creatives","Infographics","Presentation design","Brochures","Flyers","Posters","Banners","Catalogue design","Product creatives","E-commerce creatives","Website graphics","Email graphics","YouTube thumbnails","Motion graphics","Creative direction","Art direction"] },
  SOCIAL_MEDIA_MARKETING: { label: "Social Media Marketing", items: ["Instagram marketing","Facebook marketing","LinkedIn marketing","YouTube marketing","X/Twitter marketing","Pinterest marketing","Social media strategy","Social media management","Content calendar","Community management","Engagement management","Social media optimization","Hashtag strategy","Trend monitoring","Social listening","Page optimization","Audience growth","Reputation management"] },
  CONTENT_CREATION: { label: "Content Creation", items: ["Content strategy","Content calendars","Blog writing","Article writing","Website copywriting","Ad copywriting","Social media copy","Caption writing","Email copywriting","Landing-page copy","Product descriptions","Case studies","Whitepapers","E-books","Infographics","Educational content","Thought-leadership content","User-generated content","Storytelling"] },
  VIDEO_PRODUCTION: { label: "Reels & Video Marketing", items: ["Instagram Reels","YouTube Shorts","Promotional videos","Brand films","Product videos","Explainer videos","Corporate videos","Testimonial videos","UGC videos","Video advertisements","Motion graphics","2D animation","3D animation","AI video production","Video editing","Scriptwriting","Storyboarding","Video shoot production","Product photography","Brand photography"] },
  SEO: { label: "SEO — Search Engine Optimization", items: ["Technical SEO","On-page SEO","Off-page SEO","Local SEO","E-commerce SEO","International SEO","Keyword research","Competitor keyword research","SEO content strategy","Content optimization","Meta title optimization","Meta description optimization","Internal linking","Image SEO","Schema markup","Website speed optimization","Core Web Vitals","Link building","Digital PR","Citation building","Google Business Profile optimization","SEO reporting"] },
  GOOGLE_SEARCH_MARKETING: { label: "Google & Search Marketing", items: ["Google Ads","Search campaigns","Display campaigns","Shopping campaigns","Performance Max","YouTube advertising","Remarketing","Search retargeting","Local search advertising","Lead-generation campaigns","Conversion tracking","Landing-page optimization"] },
  META_ADVERTISING: { label: "Meta Advertising", items: ["Facebook Ads","Instagram Ads","Lead-generation ads","Conversion campaigns","Traffic campaigns","Engagement campaigns","Awareness campaigns","Catalogue ads","Dynamic product ads","Retargeting","Lookalike audiences","Custom audiences","Creative testing","A/B testing","Campaign optimization"] },
  PERFORMANCE_MARKETING: { label: "Performance Marketing", items: ["PPC advertising","CPL campaigns","CPA campaigns","ROAS optimization","Lead-generation campaigns","E-commerce performance marketing","Conversion campaigns","Retargeting","Remarketing","Funnel optimization","Media buying","Campaign scaling","Performance reporting"] },
  WEBSITE_DEVELOPMENT: { label: "Website Design & Development", items: ["Website strategy","UI/UX design","Corporate websites","Business websites","Landing pages","Lead-generation websites","WordPress websites","Webflow websites","Shopify websites","Custom websites","E-commerce websites","Website redesign","Mobile-responsive development","CMS development","Website maintenance","Website security","Website speed optimization","Conversion-focused design","API integration","Third-party integrations"] },
  ECOMMERCE_MARKETING: { label: "E-Commerce Marketing", items: ["Shopify development","WooCommerce development","E-commerce SEO","Product-page optimization","Product photography","Product descriptions","Catalogue management","Shopping Ads","Meta catalogue ads","Conversion optimization","Abandoned-cart recovery","E-commerce analytics","Marketplace marketing"] },
  MARKETPLACE_MARKETING: { label: "Marketplace Marketing", items: ["Amazon marketing","Flipkart marketing","Meesho marketing","Myntra marketing","Marketplace SEO","Product listing optimization","A+ content","Catalogue management","Marketplace advertising","Marketplace reputation management"] },
  EMAIL_MARKETING: { label: "Email Marketing", items: ["Email strategy","Newsletter campaigns","Promotional emails","Product launches","Lead nurturing","Welcome sequences","Drip campaigns","Abandoned-cart emails","Customer retention emails","Re-engagement campaigns","Automated email journeys","Email segmentation","Email A/B testing","Email analytics"] },
  WHATSAPP_MARKETING: { label: "WhatsApp Marketing", items: ["WhatsApp Business setup","WhatsApp campaigns","Broadcast marketing","Promotional messages","Lead follow-up","Automated replies","WhatsApp chatbots","WhatsApp catalogue","WhatsApp lead generation","Customer support","WhatsApp CRM integration","WhatsApp automation"] },
  INFLUENCER_MARKETING: { label: "Influencer Marketing", items: ["Influencer strategy","Influencer discovery","Nano influencers","Micro influencers","Macro influencers","Celebrity collaborations","Creator campaigns","UGC campaigns","Influencer negotiation","Campaign management","Influencer reporting","Product seeding"] },
  LINKEDIN_B2B_MARKETING: { label: "LinkedIn & B2B Marketing", items: ["LinkedIn page management","LinkedIn content","Founder branding","Personal branding","LinkedIn Ads","B2B lead generation","Account-based marketing","Employee advocacy","Thought leadership","Corporate positioning"] },
  YOUTUBE_MARKETING: { label: "YouTube Marketing", items: ["YouTube channel strategy","Channel management","Video SEO","YouTube Shorts","Thumbnail design","YouTube scripts","Video production","YouTube Ads","Audience development","YouTube analytics"] },
  ONLINE_REPUTATION_MANAGEMENT: { label: "Online Reputation Management", items: ["ORM strategy","Google review management","Review generation","Review response management","Brand monitoring","Social listening","Search-result reputation","Negative-result monitoring","Brand sentiment analysis","Crisis communication support"] },
  CONVERSION_RATE_OPTIMIZATION: { label: "Conversion Rate Optimization (CRO)", items: ["Website conversion audit","Landing-page optimization","CTA optimization","Lead-form optimization","Checkout optimization","A/B testing","Heatmap analysis","User-behaviour analysis","Funnel analysis","Conversion tracking","UX optimization"] },
  MARKETING_AUTOMATION: { label: "Marketing Automation", items: ["CRM setup","Lead automation","Lead scoring","Automated follow-ups","Email automation","WhatsApp automation","Customer journeys","Sales pipeline automation","Lead distribution","CRM integrations","Workflow automation","AI automation","Chatbot automation"] },
  AI_MARKETING: { label: "AI Marketing Services", items: ["AI content creation","AI copywriting","AI image generation","AI video creation","AI avatars","AI voiceovers","AI chatbots","AI customer support","AI lead qualification","AI marketing automation","AI-powered personalization","AI SEO","AI analytics","AI workflow automation"] },
  APP_DEVELOPMENT: { label: "App Development", items: ["Android app development","iOS app development","Cross-platform apps","Web applications","MVP development","UI/UX for apps","App maintenance","API integration","App analytics","App Store optimization"] },
  ANALYTICS_REPORTING: { label: "Analytics & Reporting", items: ["Google Analytics","Google Tag Manager","Search Console","Meta Pixel","Conversion API","Conversion tracking","Marketing dashboards","Campaign reporting","SEO reporting","Social media reporting","ROI analysis","ROAS analysis","CAC analysis","LTV analysis","Lead-source tracking","Funnel analytics","Customer behaviour analytics"] },
  DIGITAL_PR: { label: "Digital PR", items: ["Online PR","Press releases","Media outreach","Digital publications","Brand stories","Founder PR","Thought leadership","Online brand mentions","Digital PR campaigns","Backlink-focused PR"] },
  PERSONAL_BRANDING: { label: "Personal Branding", items: ["Founder branding","CEO branding","LinkedIn personal branding","Instagram personal branding","Personal content strategy","Founder storytelling","Thought leadership","Podcast positioning","Media positioning","Personal website","Reputation management"] },
  LEAD_GENERATION: { label: "Lead Generation", items: ["B2B lead generation","B2C lead generation","Landing-page campaigns","Lead forms","Google lead campaigns","Meta lead campaigns","LinkedIn lead generation","WhatsApp lead generation","Lead magnets","Webinar campaigns","Appointment generation","Lead nurturing","Lead qualification"] },
  GROWTH_MARKETING: { label: "Sales Funnel & Growth Marketing", items: ["Awareness funnel","Consideration funnel","Conversion funnel","Retention funnel","Lead nurturing","Remarketing funnels","Sales automation","Customer acquisition","Customer retention","Upselling","Cross-selling","Referral marketing","Growth experiments"] },
};

export const categoryLabel = (c: ServiceCategory) => SERVICE_CATALOG[c].label;

// A sensible starting point for onboarding a typical content-and-ads client. Editable per client afterwards.
export const DEFAULT_CATEGORIES: ServiceCategory[] = ["SOCIAL_MEDIA_MARKETING", "CONTENT_CREATION", "GRAPHIC_DESIGN"];

/** Which category (any one is enough) unlocks each content type in the calendar's "new content" picker. */
export const CONTENT_TYPE_REQUIRES: Record<ContentType, ServiceCategory[]> = {
  INSTAGRAM_REEL: ["SOCIAL_MEDIA_MARKETING", "VIDEO_PRODUCTION"],
  INSTAGRAM_CAROUSEL: ["SOCIAL_MEDIA_MARKETING"],
  INSTAGRAM_STORY: ["SOCIAL_MEDIA_MARKETING"],
  INSTAGRAM_STATIC: ["SOCIAL_MEDIA_MARKETING"],
  FACEBOOK_POST: ["SOCIAL_MEDIA_MARKETING"],
  LINKEDIN_POST: ["SOCIAL_MEDIA_MARKETING", "LINKEDIN_B2B_MARKETING"],
  YOUTUBE_VIDEO: ["YOUTUBE_MARKETING", "VIDEO_PRODUCTION"],
  YOUTUBE_SHORTS: ["YOUTUBE_MARKETING", "VIDEO_PRODUCTION"],
  PINTEREST_PIN: ["SOCIAL_MEDIA_MARKETING"],
  GOOGLE_BUSINESS_POST: ["SEO", "SOCIAL_MEDIA_MARKETING"],
  REDDIT_CONTENT: ["SOCIAL_MEDIA_MARKETING"],
  QUORA_CONTENT: ["SOCIAL_MEDIA_MARKETING", "CONTENT_CREATION"],
  BLOG: ["SEO", "CONTENT_CREATION"],
  EMAIL_CAMPAIGN: ["EMAIL_MARKETING"],
};

export type ServiceState = Partial<Record<ServiceCategory, { enabled: boolean; scopeItems: string[]; notes: string | null }>>;

/**
 * null/undefined = the client has never had its services configured — every content type stays available
 * so nothing breaks for clients created before this feature existed. Once at least one category has been
 * set, only enabled categories (and any content type with no mapping at all) get through.
 */
export function allowedContentTypes(state: ServiceState | null | undefined): ContentType[] {
  const all = Object.keys(CONTENT_TYPE_REQUIRES) as ContentType[];
  if (!state || Object.keys(state).length === 0) return all;
  return all.filter((t) => {
    const req = CONTENT_TYPE_REQUIRES[t];
    return req.length === 0 || req.some((c) => state[c]?.enabled);
  });
}

export function enabledCategories(state: ServiceState | null | undefined): ServiceCategory[] {
  if (!state) return [];
  return SERVICE_ORDER.filter((c) => state[c]?.enabled);
}

/** Which content type a used idea becomes: its own type if still allowed, else the client's first allowed type. */
export function resolveIdeaContentType(ideaType: ContentType | null | undefined, allowed: ContentType[]): ContentType | null {
  if (ideaType && allowed.includes(ideaType)) return ideaType;
  return allowed[0] ?? null;
}
