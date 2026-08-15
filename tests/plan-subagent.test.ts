import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("../lib/store", () => ({
  dispatch: vi.fn(),
  getState: vi.fn(),
}));
vi.mock("../lib/cursor-cmo", () => ({
  runCursorStructured: vi.fn(),
}));
import {
  buildPlanTaskPrompt,
  localPlanTaskResult,
  parsePlanTaskOutput,
  subagentNameForStep,
} from "../lib/plan-subagent";
import type { MarketingPlan } from "../lib/types";

const plan: MarketingPlan = {
  id: "MP-001",
  title: "Launch plan",
  objective: "Find buyers",
  summary: "Start with prospects.",
  feedbackQuestion: "Which priority?",
  status: "awaiting_choice",
  source: "cursor-cli",
  createdAt: "2026-08-15T09:00:00.000Z",
  steps: [
    {
      id: "MP-001-S1",
      priority: 1,
      title: "Find prospect clients on LinkedIn",
      description: "Search LinkedIn professional data",
      rationale: "Know the buyers first",
      workstream: "pipeline",
      actionType: "linkedin_prospect_search",
      expectedOutcome: "A ranked prospect list",
      difficulty: "easy",
      status: "ready",
    },
  ],
};

describe("CMO plan-task subagent", () => {
  it("routes LinkedIn prospecting to the linkedin-prospector subagent", () => {
    expect(subagentNameForStep(plan.steps[0])).toBe("linkedin-prospector");
    expect(subagentNameForStep({ actionType: "content_draft" })).toBe("plan-task");
  });

  it("asks the spawned subagent to complete only the assigned priority", () => {
    const prompt = buildPlanTaskPrompt(plan, plan.steps[0], {
      name: "CareLoop",
      industry: "Healthtech",
      category: "Clinic operations",
      audience: "independent clinics",
      tagline: "Fewer no-shows",
      summary: "Patient engagement software",
      competitors: ["Phreesia"],
      marketSignals: ["Clinics are losing revenue to no-shows"],
      assumptions: [],
      sources: [],
      originalBrief: "We help clinics reduce patient no-shows",
      researchedAt: plan.createdAt,
    });

    expect(prompt).toContain("linkedin-prospector");
    expect(prompt).toContain("complete exactly one marketing-plan priority");
    expect(prompt).toContain("do not spawn another subagent");
    expect(prompt).toContain("Do not log into LinkedIn or scrape linkedin.com");
    expect(prompt).toContain("linkedin_prospect_search");
  });

  it("accepts a bounded subagent result", () => {
    expect(
      parsePlanTaskOutput(
        JSON.stringify({
          summary: "Found hiring clinic operators.",
          findings: ["Northwell Clinics is hiring"],
          statusRead: "Two prospects are hiring; one is actively posting.",
        }),
      ),
    ).toMatchObject({ summary: "Found hiring clinic operators." });

    expect(() =>
      parsePlanTaskOutput(
        JSON.stringify({
          summary: "Done",
          findings: ["ok"],
          statusRead: "ok",
          shellCommand: "curl linkedin.com",
        }),
      ),
    ).toThrow();
  });

  it("falls back to the local LinkedIn directory when the CLI times out", () => {
    const result = localPlanTaskResult(plan.steps[0], {
      name: "CareLoop",
      industry: "Healthtech",
      category: "Clinic operations",
      audience: "independent clinics",
      tagline: "Fewer no-shows",
      summary: "Patient engagement software",
      competitors: ["Phreesia"],
      marketSignals: ["Clinics are losing revenue to no-shows"],
      assumptions: [],
      sources: [],
      originalBrief: "We help clinics reduce patient no-shows",
      researchedAt: plan.createdAt,
    });

    expect(result.name).toBe("linkedin-prospector");
    expect(result.summary.length).toBeGreaterThan(10);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.statusRead).toContain("Top prospect status");
  });
});
