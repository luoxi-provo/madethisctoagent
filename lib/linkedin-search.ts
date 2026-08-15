import type {
  MarketingPlanDraft,
  MarketingPlanDraftStep,
  Opportunity,
  RelationshipPath,
} from "./types";

export type LinkedInProspectStage = "hiring" | "active" | "open" | "warming" | "cold";

export interface LinkedInProspect {
  id: string;
  name: string;
  title: string;
  company: string;
  headline: string;
  location: string;
  industry: string;
  keywords: string[];
  stage: LinkedInProspectStage;
  statusDetail: string;
  signal: string;
  signalAge: string;
  linkedinUrl: string;
}

const STAGE_LABEL: Record<LinkedInProspectStage, string> = {
  hiring: "Hiring now",
  active: "Active on LinkedIn",
  open: "Open to conversation",
  warming: "Warming",
  cold: "Quiet",
};

const DIRECTORY: LinkedInProspect[] = [
  {
    id: "li-northwell-ops",
    name: "Priya Raman",
    title: "Director of Clinic Operations",
    company: "Northwell Clinics",
    headline: "Reducing no-shows across a 12-site outpatient network",
    location: "New York, NY",
    industry: "Healthcare",
    keywords: ["clinic", "clinics", "patient", "no-show", "no-shows", "healthcare", "outpatient", "operations"],
    stage: "hiring",
    statusDetail: "Hiring a patient-experience lead · posted 3 days ago",
    signal: "Posted a LinkedIn hiring note for a no-show reduction program",
    signalAge: "3 days ago",
    linkedinUrl: "https://www.linkedin.com/in/priya-raman-clinops",
  },
  {
    id: "li-brightside-cmo",
    name: "Elena Voss",
    title: "CMO",
    company: "Brightside Health",
    headline: "Growth for virtual mental-health clinics",
    location: "Austin, TX",
    industry: "Healthcare",
    keywords: ["clinic", "health", "patient", "no-show", "healthcare", "cmo", "growth"],
    stage: "active",
    statusDetail: "Active · shared a thread on missed appointments this week",
    signal: "Published a LinkedIn post about missed appointments and revenue leakage",
    signalAge: "16 hr ago",
    linkedinUrl: "https://www.linkedin.com/in/elena-voss-health",
  },
  {
    id: "li-careloop-founder",
    name: "Marcus Hale",
    title: "Founder & CEO",
    company: "CareLoop",
    headline: "Practice software for independent clinics",
    location: "Chicago, IL",
    industry: "Healthtech",
    keywords: ["clinic", "practice", "patient", "healthcare", "saas", "founder"],
    stage: "open",
    statusDetail: "Open to conversation · profile set to interested in partnerships",
    signal: "Updated LinkedIn to looking for patient-engagement partners",
    signalAge: "2 days ago",
    linkedinUrl: "https://www.linkedin.com/in/marcus-hale-careloop",
  },
  {
    id: "li-linear-pm",
    name: "Sofia Nguyen",
    title: "Head of Product",
    company: "Harborline",
    headline: "Issue tracking and build cadence for product orgs",
    location: "San Francisco, CA",
    industry: "B2B SaaS",
    keywords: ["linear", "issue", "project", "product", "saas", "engineering", "workflow"],
    stage: "hiring",
    statusDetail: "Hiring PMs · company page shows 4 open product roles",
    signal: "Harborline opened product roles and engaged with workflow-tool posts",
    signalAge: "9 hr ago",
    linkedinUrl: "https://www.linkedin.com/in/sofia-nguyen-product",
  },
  {
    id: "li-height-eng",
    name: "Jonah Park",
    title: "VP Engineering",
    company: "Relayboard",
    headline: "Shipping faster without drowning in tickets",
    location: "Seattle, WA",
    industry: "Developer tools",
    keywords: ["linear", "engineering", "issue", "project", "saas", "workflow", "devtools"],
    stage: "active",
    statusDetail: "Active · commented on project-management comparisons",
    signal: "Commented on a LinkedIn thread comparing issue-tracking tools",
    signalAge: "5 hr ago",
    linkedinUrl: "https://www.linkedin.com/in/jonah-park-eng",
  },
  {
    id: "li-research-os",
    name: "Amelia Cho",
    title: "Head of Research",
    company: "Lumen Papers",
    headline: "AI workspace for literature review and evidence synthesis",
    location: "Boston, MA",
    industry: "AI research",
    keywords: ["ai", "research", "workspace", "knowledge", "papers", "evidence", "synthesis"],
    stage: "hiring",
    statusDetail: "Hiring research ops · posted a role yesterday",
    signal: "Posted a LinkedIn role for an AI research workspace lead",
    signalAge: "1 day ago",
    linkedinUrl: "https://www.linkedin.com/in/amelia-cho-research",
  },
  {
    id: "li-notebook-founder",
    name: "Diego Alvarez",
    title: "CEO",
    company: "Quillwell",
    headline: "Building an AI research notebook for operators",
    location: "Remote",
    industry: "AI software",
    keywords: ["ai", "research", "workspace", "notebook", "knowledge", "founder"],
    stage: "open",
    statusDetail: "Open to conversation · asks for category intros in featured",
    signal: "Featured a LinkedIn note asking for research-tool intros",
    signalAge: "4 hr ago",
    linkedinUrl: "https://www.linkedin.com/in/diego-alvarez-quillwell",
  },
  {
    id: "li-signal-house",
    name: "Lena Ortiz",
    title: "Founder",
    company: "Patchwork",
    headline: "Customer evidence into the next GTM move",
    location: "Brooklyn, NY",
    industry: "B2B SaaS",
    keywords: ["research", "evidence", "gtm", "saas", "customer", "intelligence"],
    stage: "active",
    statusDetail: "Active · posting weekly on founder-led sales",
    signal: "Shared a LinkedIn teardown of customer-evidence workflows",
    signalAge: "11 hr ago",
    linkedinUrl: "https://www.linkedin.com/in/lena-ortiz-patchwork",
  },
  {
    id: "li-bluebird-vp",
    name: "Maya Chen",
    title: "VP Product",
    company: "Bluebird",
    headline: "Product research at a fast-growing SaaS company",
    location: "Denver, CO",
    industry: "B2B SaaS",
    keywords: ["product", "research", "saas", "hiring", "insights", "evidence"],
    stage: "hiring",
    statusDetail: "Hiring · 4 research roles live on the company page",
    signal: "Bluebird opened research roles and revisited launch content",
    signalAge: "18 min ago",
    linkedinUrl: "https://www.linkedin.com/in/maya-chen-bluebird",
  },
  {
    id: "li-lattice-research",
    name: "Elliot Kim",
    title: "Head of Research",
    company: "Lattice Labs",
    headline: "Turning qualitative research into product bets",
    location: "Los Angeles, CA",
    industry: "B2B SaaS",
    keywords: ["research", "saas", "insights", "product", "evidence"],
    stage: "active",
    statusDetail: "Active · engaged with a founder research post",
    signal: "Reacted to a LinkedIn post on research-ops tooling",
    signalAge: "2 hr ago",
    linkedinUrl: "https://www.linkedin.com/in/elliot-kim-research",
  },
  {
    id: "li-fintech-growth",
    name: "Nadia Brooks",
    title: "VP Growth",
    company: "Clearledger",
    headline: "Pipeline and partnerships for B2B fintech",
    location: "London, UK",
    industry: "Fintech",
    keywords: ["fintech", "growth", "pipeline", "saas", "b2b", "partnerships"],
    stage: "warming",
    statusDetail: "Warming · viewed similar vendor pages, no public ask yet",
    signal: "Viewed adjacent LinkedIn vendor pages in the last week",
    signalAge: "6 days ago",
    linkedinUrl: "https://www.linkedin.com/in/nadia-brooks-growth",
  },
  {
    id: "li-commerce-ops",
    name: "Chris Okonkwo",
    title: "COO",
    company: "Kite Works",
    headline: "Operations for a distributed commerce team",
    location: "Atlanta, GA",
    industry: "Commerce",
    keywords: ["operations", "commerce", "coo", "workflow"],
    stage: "cold",
    statusDetail: "Quiet · last public post 7 weeks ago",
    signal: "LinkedIn profile is current but activity is stale",
    signalAge: "7 weeks ago",
    linkedinUrl: "https://www.linkedin.com/in/chris-okonkwo-ops",
  },
];

function tokens(...values: Array<string | undefined>) {
  return values
    .flatMap((value) => (value ?? "").toLowerCase().split(/[^a-z0-9]+/))
    .filter((token) => token.length > 2);
}

function scoreProspect(prospect: LinkedInProspect, query: string[]) {
  const haystack = new Set(
    tokens(prospect.company, prospect.title, prospect.headline, prospect.industry, ...prospect.keywords),
  );
  let score = 0;
  for (const token of query) {
    if (haystack.has(token)) score += 6;
  }
  if (prospect.stage === "hiring") score += 8;
  if (prospect.stage === "active" || prospect.stage === "open") score += 5;
  if (prospect.stage === "warming") score += 2;
  return score;
}

function initials(name: string, company: string) {
  const fromName = name
    .split(" ")
    .map((part) => part[0])
    .join("");
  return fromName.slice(0, 2) || company.slice(0, 2).toUpperCase();
}

function connector(
  id: string,
  name: string,
  role: string,
  type: RelationshipPath["type"],
  strength: number,
  daysSinceFavor: number,
): RelationshipPath {
  return {
    id,
    name,
    initials: initials(name, name),
    role,
    type,
    strength,
    daysSinceFavor,
    favorsIn90Days: daysSinceFavor < 90 ? 1 : 0,
    evidence: `LinkedIn relationship graph · ${strength}/100 strength`,
    eligible: true,
  };
}

export function searchLinkedInProspects(profile?: { name?: string; industry?: string; category?: string; audience?: string; tagline?: string; summary?: string; competitors?: string[] }, limit = 6): LinkedInProspect[] {
  const query = tokens(
    profile?.name,
    profile?.industry,
    profile?.category,
    profile?.audience,
    profile?.tagline,
    profile?.summary,
    ...(profile?.competitors ?? []),
    ...(profile ? [] : ["saas", "product", "research", "gtm"]),
  );
  return [...DIRECTORY]
    .map((prospect) => ({ prospect, score: scoreProspect(prospect, query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.prospect.company.localeCompare(b.prospect.company))
    .slice(0, limit)
    .map((item) => item.prospect);
}

export function prospectingPlanStep(profile?: { audience?: string }): MarketingPlanDraftStep {
  const audience = profile?.audience?.replace(/\.$/, "") || "likely buyers";
  return {
    title: "Find prospect clients on LinkedIn",
    description: `Search LinkedIn professional data for ${audience} and score whether each prospect is hiring, active, open, warming, or quiet.`,
    rationale: "The first GTM move is always knowing who the buyers are and the current status of those prospect clients.",
    workstream: "pipeline",
    actionType: "linkedin_prospect_search",
    expectedOutcome: "A ranked prospect list with current LinkedIn status for each account",
  };
}

export function withProspectingFirstStep(
  draft: MarketingPlanDraft,
  profile?: { audience?: string },
): MarketingPlanDraft {
  const first = prospectingPlanStep(profile);
  const rest = draft.steps.filter((step) => step.actionType !== "linkedin_prospect_search");
  return { ...draft, steps: [first, ...rest].slice(0, 5) };
}

export function linkedInProspectsToOpportunities(prospects: LinkedInProspect[]): Opportunity[] {
  return prospects.map((prospect, index) => {
    const fit = index < 2 ? 90 : index < 4 ? 78 : 64;
    const stageBoost = prospect.stage === "hiring" || prospect.stage === "active" ? 8 : 0;
    return {
      id: `opp-${prospect.id}`,
      account: prospect.company,
      target: prospect.name,
      targetRole: prospect.title,
      initials: initials(prospect.name, prospect.company),
      signal: prospect.signal,
      signalType: `LinkedIn · ${STAGE_LABEL[prospect.stage]}`,
      signalAge: prospect.signalAge,
      fitLabel: fit >= 85 ? "High fit" : fit >= 70 ? "Medium fit" : "Low fit",
      score: {
        fit,
        signal: 70 + stageBoost,
        relationship: 62,
        learned: 50,
        freshness: prospect.stage === "cold" ? 28 : 88,
        total: Math.min(99, fit - 4 + stageBoost),
      },
      paths: [
        connector(
          `${prospect.id}-colleague`,
          index % 2 === 0 ? "Sam Rivera" : "Devon Ellis",
          "Former colleague",
          "former_colleague",
          81 - index,
          164,
        ),
        connector(
          `${prospect.id}-friend`,
          index % 2 === 0 ? "Noa Williams" : "Lucas Reed",
          "Industry connection",
          "friend",
          64 - index,
          210,
        ),
      ],
      status: prospect.stage === "cold" ? "watching" : "ready",
      prospectStatus: prospect.statusDetail,
      prospectStage: prospect.stage,
      source: "linkedin_search",
      linkedinUrl: prospect.linkedinUrl,
    };
  });
}

export function applyLinkedInProspects(
  opportunities: Opportunity[],
  prospects: LinkedInProspect[],
): Opportunity[] {
  const found = linkedInProspectsToOpportunities(prospects);
  const foundAccounts = new Set(found.map((item) => item.account.toLowerCase()));
  const remainder = opportunities.filter(
    (item) => item.source !== "linkedin_search" && !foundAccounts.has(item.account.toLowerCase()),
  );
  return [...found, ...remainder];
}

export function prospectSearchSummary(prospects: LinkedInProspect[]) {
  if (!prospects.length) return "No matching LinkedIn prospects were in the current directory.";
  const counts = prospects.reduce<Record<string, number>>((acc, prospect) => {
    acc[prospect.stage] = (acc[prospect.stage] ?? 0) + 1;
    return acc;
  }, {});
  const status = Object.entries(counts)
    .map(([stage, count]) => `${count} ${STAGE_LABEL[stage as LinkedInProspectStage].toLowerCase()}`)
    .join(", ");
  const names = prospects
    .slice(0, 3)
    .map((prospect) => `${prospect.name} at ${prospect.company}`)
    .join("; ");
  return `Found ${prospects.length} prospect clients (${status}). Top matches: ${names}.`;
}
