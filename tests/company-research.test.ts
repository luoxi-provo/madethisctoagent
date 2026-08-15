import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  buildMarketEvidencePrompt,
  identifyCompanyFromBrief,
  starterMarketingPlan,
} from "../lib/company-research";

const researchedAt = "2026-08-15T20:00:00.000Z";

describe("company identification before market evidence", () => {
  it("opens a workspace from the founder brief without waiting for web research", () => {
    const profile = identifyCompanyFromBrief(
      "We help clinics reduce patient no-shows",
      researchedAt,
    );

    expect(profile.name).toBe("Your company");
    expect(profile.audience).toContain("clinics");
    expect(profile.originalBrief).toBe("We help clinics reduce patient no-shows");
    expect(profile.marketSignals.length).toBeGreaterThan(0);
    expect(profile.assumptions[0]).toContain("market evidence is still being checked");
  });

  it("uses the website title and hostname when a snapshot is already in hand", () => {
    const profile = identifyCompanyFromBrief("Issue tracking for product teams", researchedAt, {
      url: "https://linear.app/",
      title: "Linear | Issue tracking you’ll enjoy using",
      description: "Linear streamlines issues, projects, and product roadmaps.",
      text: "Linear is a purpose-built tool for planning and building products.",
    });

    expect(profile.name).toBe("Linear");
    expect(profile.website).toBe("https://linear.app/");
    expect(profile.sources[0]?.url).toBe("https://linear.app/");
    expect(profile.tagline).toContain("Linear streamlines issues");
  });

  it("reads a named product out of the brief", () => {
    const profile = identifyCompanyFromBrief(
      "We're building Patchwork, an AI research workspace",
      researchedAt,
    );
    expect(profile.name).toBe("Patchwork");
  });

  it("creates a starter plan that still starts with LinkedIn prospecting", () => {
    const profile = identifyCompanyFromBrief("We help clinics reduce patient no-shows", researchedAt);
    const plan = starterMarketingPlan(profile);

    expect(plan.steps[0]?.actionType).toBe("linkedin_prospect_search");
    expect(plan.steps.length).toBeGreaterThanOrEqual(3);
    expect(plan.steps.length).toBeLessThanOrEqual(5);
    expect(plan.summary).toContain("market evidence");
  });

  it("asks the later Cursor turn to enrich evidence instead of restarting identification", () => {
    const profile = identifyCompanyFromBrief("We help clinics reduce patient no-shows", researchedAt);
    const prompt = buildMarketEvidencePrompt("We help clinics reduce patient no-shows", profile);

    expect(prompt).toContain("Do not restart company identification");
    expect(prompt).toContain("<identified_company>");
    expect(prompt).toContain("linkedin_prospect_search");
  });
});
