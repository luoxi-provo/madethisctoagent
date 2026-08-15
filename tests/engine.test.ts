import { describe, expect, it } from "vitest";
import { beforeAction, canonicalPayloadHash, commandReducer, evaluatePath } from "../lib/engine";
import { createInitialState } from "../lib/fixtures";
import type { CompanyProfile, MadeThisState, MarketingPlanDraft } from "../lib/types";

const start = new Date("2026-08-15T09:00:00.000Z");
const minute = (offset: number) => new Date(start.getTime() + offset * 60_000);

function firstHeartbeat() {
  return commandReducer(createInitialState(start), { type: "run_heartbeat" }, minute(1));
}

function afterFeedback() {
  const first = firstHeartbeat();
  return commandReducer(
    first,
    {
      type: "reject",
      proposalId: "P-001",
      rationale:
        "Jordan made an intro three weeks ago. Never ask a customer for another intro within 90 days.",
    },
    minute(2),
  );
}

function afterExecution() {
  return commandReducer(
    afterFeedback(),
    { type: "approve_execute", proposalId: "P-002" },
    minute(3),
  );
}

function afterOutcome() {
  return commandReducer(afterExecution(), { type: "inject_positive_outcome" }, minute(4));
}

const marketingPlanDraft: MarketingPlanDraft = {
  title: "Evidence-led launch plan",
  objective: "Create qualified conversations for Patchwork",
  summary: "Use current evidence to align the narrative, campaign, and measurement loop.",
  feedbackQuestion: "Which numbered priority should MadeThis CMO execute?",
  steps: [
    {
      title: "Create the evidence brief",
      description: "Synthesize the current account and relationship evidence.",
      rationale: "The campaign should start from observed buyer signals.",
      workstream: "pipeline",
      actionType: "research_brief",
      expectedOutcome: "One founder-ready evidence brief",
    },
    {
      title: "Analyze the funnel",
      description: "Find conversion gaps in the synthetic funnel.",
      rationale: "Measurement gaps should be known before launch.",
      workstream: "analytics",
      actionType: "funnel_analysis",
      expectedOutcome: "A baseline and a measurable bottleneck",
    },
    {
      title: "Draft the campaign narrative",
      description: "Prepare internal campaign copy for founder review.",
      rationale: "The launch needs one coherent point of view.",
      workstream: "content",
      actionType: "content_draft",
      expectedOutcome: "A review-ready narrative draft",
    },
  ],
};

const companyProfile: CompanyProfile = {
  name: "Signal House",
  website: "https://signal.house/",
  industry: "B2B SaaS",
  category: "Customer intelligence",
  tagline: "Turn customer evidence into the next best move.",
  summary: "Signal House helps small product teams find and act on customer evidence.",
  audience: "Seed-stage product founders",
  businessModel: "Subscription software",
  competitors: ["Dovetail"],
  marketSignals: ["Teams are consolidating research tools", "Founders need faster synthesis"],
  assumptions: ["Founder-led sales is the first channel"],
  sources: [{ title: "Signal House", url: "https://signal.house/" }],
  originalBrief: "We help founders turn interviews into decisions.",
  researchedAt: start.toISOString(),
};

describe("MadeThis CMO deterministic marketing loop", () => {
  it("creates a company workspace and its first ranked visual plan", () => {
    const state = commandReducer(
      createInitialState(start),
      { type: "onboard_company", profile: companyProfile, draft: marketingPlanDraft },
      minute(1),
    );

    expect(state.workspace).toBe("Signal House");
    expect(state.companyProfile).toEqual(companyProfile);
    expect(state.activeMarketingPlanId).toBe("MP-001");
    expect(state.activity.map((event) => event.type)).toEqual([
      "company.researched",
      "marketing_plan.created",
    ]);
  });

  it("forgets the prior company and all communicated agent state for a new user", () => {
    let state = commandReducer(
      createInitialState(start),
      { type: "onboard_company", profile: companyProfile, draft: marketingPlanDraft },
      minute(1),
    );
    state = commandReducer(state, { type: "run_heartbeat" }, minute(2));
    state = commandReducer(state, { type: "new_user" }, minute(3));

    expect(state.companyProfile).toBeUndefined();
    expect(state.workspace).toBe("New company");
    expect(state.marketingPlans).toEqual([]);
    expect(state.proposals).toEqual([]);
    expect(state.activity).toEqual([]);
    expect(state.outcomes).toEqual([]);
  });

  it("stores a Cursor plan as a ranked governed execution map in Propose mode", () => {
    const state = commandReducer(
      createInitialState(start),
      { type: "create_marketing_plan", draft: marketingPlanDraft },
      minute(1),
    );

    expect(state.activeMarketingPlanId).toBe("MP-001");
    expect(state.marketingPlans[0]).toMatchObject({
      id: "MP-001",
      status: "awaiting_choice",
      source: "cursor-cli",
    });
    expect(state.marketingPlans[0].steps.map((step) => ({
      id: step.id,
      priority: step.priority,
      difficulty: step.difficulty,
      status: step.status,
    }))).toEqual([
      { id: "MP-001-S1", priority: 1, difficulty: "easy", status: "ready" },
      { id: "MP-001-S2", priority: 2, difficulty: "medium", status: "ready" },
      { id: "MP-001-S3", priority: 3, difficulty: "easy", status: "ready" },
    ]);
    expect(state.executions).toHaveLength(0);
  });

  it("executes a founder-selected plan priority and updates its workstream", () => {
    const planned = commandReducer(
      createInitialState(start),
      { type: "create_marketing_plan", draft: marketingPlanDraft },
      minute(1),
    );
    const beforeProgress = planned.workstreams.find((item) => item.id === "content")!.progress;
    const state = commandReducer(
      planned,
      { type: "execute_plan_step", planId: "MP-001", stepId: "MP-001-S3" },
      minute(2),
    );

    expect(state.marketingPlans[0]).toMatchObject({
      status: "in_progress",
      selectedStepId: "MP-001-S3",
    });
    expect(state.marketingPlans[0].steps[2]).toMatchObject({
      status: "completed",
      difficulty: "easy",
    });
    expect(state.marketingPlans[0].steps[2].executionNote).toContain(
      "No live external action was taken",
    );
    expect(state.workstreams.find((item) => item.id === "content")!.progress).toBe(
      beforeProgress + 8,
    );
    expect(state.activity.some((item) => item.type === "marketing_plan.step_completed")).toBe(true);
  });

  it("lets Autopilot advance only the highest-ranked code-approved easy priority", () => {
    let state = createInitialState(start);
    state = commandReducer(state, { type: "set_mode", mode: "autopilot" }, minute(1));
    state = commandReducer(
      state,
      {
        type: "create_marketing_plan",
        draft: {
          ...marketingPlanDraft,
          steps: [
            {
              ...marketingPlanDraft.steps[1],
              title: "Run the analysis first",
            },
            marketingPlanDraft.steps[0],
            marketingPlanDraft.steps[2],
          ],
        },
      },
      minute(2),
    );

    const plan = state.marketingPlans[0];
    expect(plan.autoExecutedStepId).toBe("MP-001-S2");
    expect(plan.steps.map((step) => step.status)).toEqual(["ready", "completed", "ready"]);
    expect(plan.steps[0].difficulty).toBe("medium");
    expect(plan.steps[1].difficulty).toBe("easy");
    expect(state.executions).toHaveLength(0);
    expect(state.lastNotice?.message).toContain("priority 2 is complete");
  });

  it("blocks plan execution while the CMO is paused and keeps an audit reason", () => {
    let state = commandReducer(
      createInitialState(start),
      { type: "create_marketing_plan", draft: marketingPlanDraft },
      minute(1),
    );
    state.status = "paused";
    state = commandReducer(
      state,
      { type: "execute_plan_step", planId: "MP-001", stepId: "MP-001-S1" },
      minute(2),
    );

    expect(state.marketingPlans[0].steps[0]).toMatchObject({ status: "blocked" });
    expect(state.marketingPlans[0].steps[0].executionNote).toContain("paused");
    expect(state.activity.some((item) => item.type === "marketing_plan.step_blocked")).toBe(true);
  });

  it("creates exactly one first proposal and terminal heartbeat receipt", () => {
    const state = firstHeartbeat();

    expect(state.proposals).toHaveLength(1);
    expect(state.proposals[0]).toMatchObject({
      id: "P-001",
      account: "Bluebird",
      connector: { name: "Jordan Lee" },
      playId: "direct_intro",
      playVersion: 1,
      status: "pending_approval",
    });
    expect(state.heartbeatRuns[0]).toMatchObject({ status: "completed", proposalId: "P-001" });
    expect(state.heartbeatRuns[0].contextHash).toHaveLength(64);
  });

  it("compiles the exact rationale into a scoped active rule and reranks", () => {
    const state = afterFeedback();
    const bluebird = state.opportunities.find((item) => item.id === "opp-bluebird")!;
    const jordan = bluebird.paths.find((item) => item.id === "person-jordan")!;
    const second = state.proposals.find((item) => item.id === "P-002")!;

    expect(state.rules).toHaveLength(1);
    expect(state.rules[0]).toMatchObject({
      id: "R-001",
      owner: "user",
      status: "active",
      relationshipType: "customer",
      cooldownDays: 90,
    });
    expect(jordan).toMatchObject({ eligible: false, blockedBy: "90-day customer rule" });
    expect(second).toMatchObject({
      connector: { name: "Sam Rivera" },
      playId: "permission_first_artifact_share",
      relationshipCost: "Low",
    });
    expect(second.changedBecause[0]).toContain("R-001@1");
  });

  it("keeps vague feedback pending instead of activating broad policy", () => {
    const state = commandReducer(
      firstHeartbeat(),
      { type: "reject", proposalId: "P-001", rationale: "The timing feels off." },
      minute(2),
    );

    expect(state.rules).toHaveLength(0);
    expect(state.pendingChanges[0]).toMatchObject({
      status: "pending",
      title: "Clarify feedback before changing behavior",
    });
  });

  it("changes the canonical payload hash and requires approval after an edit", () => {
    const state = afterFeedback();
    const before = state.proposals.find((item) => item.id === "P-002")!;
    const edited = commandReducer(
      state,
      { type: "edit", proposalId: "P-002", message: `${before.message} Thanks!` },
      minute(3),
    );
    const proposal = edited.proposals.find((item) => item.id === "P-002")!;

    expect(proposal.payloadHash).not.toBe(before.payloadHash);
    expect(proposal.approvalHash).toBeUndefined();
    expect(proposal.status).toBe("pending_approval");
    expect(beforeAction(edited, proposal, minute(3)).decision).toBe("require_approval");
  });

  it("fails closed when the payload no longer matches its canonical hash", () => {
    const state = afterFeedback();
    const proposal = state.proposals.find((item) => item.id === "P-002")!;
    proposal.approvalHash = proposal.payloadHash;
    proposal.message = `${proposal.message} Silent mutation`;

    const gate = beforeAction(state, proposal, minute(3));
    expect(canonicalPayloadHash(proposal)).not.toBe(proposal.payloadHash);
    expect(gate).toMatchObject({ decision: "block" });
    expect(gate.reasonCodes).toContain("payload_hash_mismatch");
  });

  it("blocks execution while paused", () => {
    const state = afterFeedback();
    state.status = "paused";
    const proposal = state.proposals.find((item) => item.id === "P-002")!;
    proposal.approvalHash = proposal.payloadHash;

    expect(beforeAction(state, proposal, minute(3))).toMatchObject({
      decision: "block",
      reasonCodes: expect.arrayContaining(["agent_paused"]),
    });
  });

  it("stores one approval, one simulator receipt, and correlated gate events", () => {
    const state = afterExecution();
    const proposal = state.proposals.find((item) => item.id === "P-002")!;

    expect(proposal.status).toBe("executed");
    expect(state.executions).toHaveLength(1);
    expect(state.executions[0]).toMatchObject({
      adapter: "simulate_send",
      simulation: true,
      status: "completed",
    });
    expect(state.sentToday).toBe(1);
    expect(state.activity.some((item) => item.type === "proposal.approved")).toBe(true);
    expect(state.activity.some((item) => item.type === "action.gated")).toBe(true);
    expect(state.activity.some((item) => item.type === "action.executed")).toBe(true);
  });

  it("blocks a duplicate execution with the same proposal identity", () => {
    const state = afterExecution();
    const proposal = state.proposals.find((item) => item.id === "P-002")!;
    const gate = beforeAction(state, proposal, minute(4));

    expect(gate.decision).toBe("block");
    expect(gate.reasonCodes).toContain("duplicate_execution");
  });

  it("blocks at the daily action cap", () => {
    const state = afterFeedback();
    state.sentToday = state.dailyCap;
    const proposal = state.proposals.find((item) => item.id === "P-002")!;
    proposal.approvalHash = proposal.payloadHash;

    expect(beforeAction(state, proposal, minute(3)).reasonCodes).toContain("daily_cap_reached");
  });

  it("does not let Autopilot authorize a direct introduction", () => {
    let state = createInitialState(start);
    state = commandReducer(state, { type: "set_mode", mode: "autopilot" }, minute(1));
    state = commandReducer(state, { type: "run_heartbeat" }, minute(2));

    expect(state.proposals[0]).toMatchObject({
      actionType: "direct_intro",
      status: "pending_approval",
    });
    expect(state.executions).toHaveLength(0);
    expect(state.lastNotice?.message).toContain("still needs approval");
  });

  it("requires exact approval when the Autopilot grant is expired", () => {
    const state = afterFeedback();
    state.mode = "autopilot";
    state.trustGrant.expiresAt = minute(2).toISOString();
    const proposal = state.proposals.find((item) => item.id === "P-002")!;

    expect(beforeAction(state, proposal, minute(3))).toMatchObject({
      decision: "require_approval",
      reasonCodes: ["exact_approval_required"],
    });
  });

  it("requires exact approval when the connector is outside the Autopilot audience", () => {
    const state = afterFeedback();
    state.mode = "autopilot";
    const proposal = state.proposals.find((item) => item.id === "P-002")!;
    proposal.connector.type = "investor";

    expect(beforeAction(state, proposal, minute(3))).toMatchObject({
      decision: "require_approval",
      reasonCodes: ["exact_approval_required"],
    });
  });

  it("records the full synthetic funnel once and stages inferred learning", () => {
    const once = afterOutcome();
    const twice = commandReducer(once, { type: "inject_positive_outcome" }, minute(5));

    expect(once.outcomes.map((item) => item.type)).toEqual([
      "accepted",
      "replied_positive",
      "meeting_booked",
    ]);
    expect(once.plays.find((item) => item.id === "permission_first_artifact_share")?.winCount).toBe(1);
    expect(once.pendingChanges[0]).toMatchObject({ status: "pending", baseVersion: 1 });
    expect(twice.outcomes).toHaveLength(3);
    expect(twice.plays.find((item) => item.id === "permission_first_artifact_share")?.winCount).toBe(1);
  });

  it("uses both lessons on the Northstar autopilot cycle", () => {
    let state = afterOutcome();
    state = commandReducer(state, { type: "set_mode", mode: "autopilot" }, minute(5));
    state = commandReducer(state, { type: "run_heartbeat" }, minute(6));

    const proposal = state.proposals.find((item) => item.id === "P-003")!;
    const northstar = state.opportunities.find((item) => item.id === "opp-northstar")!;
    expect(northstar.paths.find((item) => item.id === "person-priya")).toMatchObject({
      eligible: false,
      blockedBy: "90-day customer rule",
    });
    expect(proposal).toMatchObject({
      connector: { name: "Devon Ellis", type: "former_colleague" },
      playId: "permission_first_artifact_share",
      status: "executed",
    });
    expect(proposal.changedBecause).toHaveLength(2);
    expect(proposal.changedBecause.join(" ")).toContain("R-001@1");
    expect(proposal.changedBecause.join(" ")).toContain("one meeting");
    expect(state.executions).toHaveLength(2);
  });

  it("restores eligibility when the user disables the learned rule", () => {
    const state = commandReducer(
      afterOutcome(),
      { type: "disable_rule", ruleId: "R-001" },
      minute(5),
    );
    const northstar = state.opportunities.find((item) => item.id === "opp-northstar")!;
    const priya = northstar.paths.find((item) => item.id === "person-priya")!;

    expect(state.rules[0].status).toBe("disabled");
    expect(priya.eligible).toBe(true);
    expect(evaluatePath(state, priya).eligible).toBe(true);
  });

  it("creates a new play version on approval and restores the prior version on rollback", () => {
    let state = commandReducer(
      afterOutcome(),
      { type: "decide_change", changeId: "C-001", decision: "approved" },
      minute(5),
    );
    const approved = state.plays.find((item) => item.id === "permission_first_artifact_share")!;
    expect(approved).toMatchObject({ version: 2, previousVersion: 1, owner: "user" });
    expect(state.pendingChanges[0]).toMatchObject({ status: "approved", resultVersion: 2 });

    state = commandReducer(
      state,
      { type: "rollback_play", playId: "permission_first_artifact_share" },
      minute(6),
    );
    expect(state.plays.find((item) => item.id === "permission_first_artifact_share")?.version).toBe(1);
    expect(state.activity.some((item) => item.type === "play.rolled_back")).toBe(true);
  });

  it("does not create another proposal while one is pending or the heartbeat is locked", () => {
    const pending = firstHeartbeat();
    const unchanged = commandReducer(pending, { type: "run_heartbeat" }, minute(2));
    expect(unchanged.proposals).toHaveLength(1);
    expect(unchanged.heartbeatRuns).toHaveLength(1);

    const locked: MadeThisState = createInitialState(start);
    locked.heartbeatLocked = true;
    const stillLocked = commandReducer(locked, { type: "run_heartbeat" }, minute(1));
    expect(stillLocked.proposals).toHaveLength(0);
    expect(stillLocked.heartbeatRuns).toHaveLength(0);
  });

  it("never exposes a non-simulator execution adapter", () => {
    const state = afterExecution();
    expect(new Set(state.executions.map((item) => item.adapter))).toEqual(new Set(["simulate_send"]));
    expect(state.executions.every((item) => item.simulation)).toBe(true);
  });
});
