import { describe, expect, it } from "vitest";
import {
  searchLinkedInProspects,
  withProspectingFirstStep,
} from "../lib/linkedin-search";
import type { MarketingPlanDraft } from "../lib/types";

const draft: MarketingPlanDraft = {
  title: "Launch plan",
  objective: "Find buyers",
  summary: "Start with prospects.",
  feedbackQuestion: "Which priority?",
  steps: [
    {
      title: "Write copy",
      description: "Draft internal copy",
      rationale: "Need a narrative",
      workstream: "content",
      actionType: "content_draft",
      expectedOutcome: "A draft",
    },
    {
      title: "Measure the funnel",
      description: "Inspect conversion",
      rationale: "Need a baseline",
      workstream: "analytics",
      actionType: "funnel_analysis",
      expectedOutcome: "A bottleneck",
    },
    {
      title: "Evidence brief",
      description: "Synthesize signals",
      rationale: "Need proof",
      workstream: "pipeline",
      actionType: "research_brief",
      expectedOutcome: "A brief",
    },
  ],
};

describe("LinkedIn prospect search skill", () => {
  it("matches healthcare clinic buyers ahead of unrelated accounts", () => {
    const prospects = searchLinkedInProspects({
      audience: "clinics reducing patient no-shows",
      industry: "Healthcare",
      category: "Patient engagement",
    });

    expect(prospects[0]?.company).toMatch(/Clinic|Health|Care/i);
    expect(prospects.some((item) => item.stage === "hiring" || item.stage === "active")).toBe(true);
  });

  it("always places LinkedIn prospecting first in a marketing plan", () => {
    const plan = withProspectingFirstStep(draft, { audience: "seed-stage product founders" });

    expect(plan.steps[0]).toMatchObject({
      actionType: "linkedin_prospect_search",
      workstream: "pipeline",
    });
    expect(plan.steps[0].description).toContain("seed-stage product founders");
    expect(plan.steps.map((step) => step.actionType)[0]).toBe("linkedin_prospect_search");
    expect(plan.steps.filter((step) => step.actionType === "linkedin_prospect_search")).toHaveLength(1);
  });
});
