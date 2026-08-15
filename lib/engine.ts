import { createHash } from "node:crypto";
import { createInitialState } from "./fixtures";
import type {
  ActivityEvent,
  Command,
  MadeThisState,
  MarketingPlan,
  MarketingPlanActionType,
  MarketingPlanDraft,
  MarketingPlanStep,
  Opportunity,
  PolicyRule,
  Proposal,
  RelationshipPath,
} from "./types";
import {
  applyLinkedInProspects,
  prospectSearchSummary,
  searchLinkedInProspects,
  withProspectingFirstStep,
} from "./linkedin-search";

const BASE_COOLDOWN_DAYS = 14;

const PLAN_ACTION_POLICY: Record<
  MarketingPlanActionType,
  { difficulty: MarketingPlanStep["difficulty"]; progress: number; label: string }
> = {
  linkedin_prospect_search: {
    difficulty: "easy",
    progress: 9,
    label: "LinkedIn prospect search completed and buyer status scored",
  },
  research_brief: {
    difficulty: "easy",
    progress: 7,
    label: "Internal research brief prepared from current evidence",
  },
  content_draft: {
    difficulty: "easy",
    progress: 8,
    label: "Internal content draft prepared for founder review",
  },
  campaign_outline: {
    difficulty: "easy",
    progress: 6,
    label: "Internal campaign outline prepared for review",
  },
  funnel_analysis: {
    difficulty: "medium",
    progress: 10,
    label: "Synthetic funnel analysis completed",
  },
  run_heartbeat: {
    difficulty: "medium",
    progress: 5,
    label: "Governed opportunity heartbeat completed",
  },
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function pad(value: number) {
  return String(value).padStart(3, "0");
}

function timestamp(now: Date) {
  return now.toISOString();
}

export function canonicalPayloadHash(
  payload: Pick<Proposal, "target" | "connector" | "channel" | "subject" | "message">,
) {
  const canonical = JSON.stringify({
    target: payload.target,
    connectorId: payload.connector.id,
    channel: payload.channel,
    subject: payload.subject,
    message: payload.message,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function snapshotHash(state: MadeThisState, opportunityId: string) {
  const canonical = JSON.stringify({
    opportunityId,
    rules: state.rules
      .filter((rule) => rule.status === "active")
      .map((rule) => `${rule.id}@${rule.version}`)
      .sort(),
    plays: state.plays
      .filter((play) => play.status === "active")
      .map((play) => `${play.id}@${play.version}`)
      .sort(),
    grant: state.mode === "autopilot" ? state.trustGrant.id : null,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function addEvent(
  state: MadeThisState,
  now: Date,
  event: Omit<ActivityEvent, "id" | "timestamp" | "mode"> & { mode?: ActivityEvent["mode"] },
) {
  state.activity.push({
    ...event,
    id: `evt-${pad(state.activity.length + 1)}`,
    timestamp: timestamp(now),
    mode: event.mode ?? state.mode,
  });
}

function activeCooldownRule(state: MadeThisState, path: RelationshipPath) {
  return state.rules.find(
    (rule) =>
      rule.status === "active" &&
      rule.relationshipType === path.type &&
      path.daysSinceFavor < rule.cooldownDays,
  );
}

export function evaluatePath(
  state: MadeThisState,
  path: RelationshipPath,
): RelationshipPath {
  const evaluated = clone(path);
  evaluated.eligible = true;
  delete evaluated.blockedBy;

  if (!evaluated.evidence) {
    evaluated.eligible = false;
    evaluated.blockedBy = "Missing relationship provenance";
    return evaluated;
  }

  if (evaluated.daysSinceFavor < BASE_COOLDOWN_DAYS) {
    evaluated.eligible = false;
    evaluated.blockedBy = `${BASE_COOLDOWN_DAYS}-day safety cooldown`;
    return evaluated;
  }

  const rule = activeCooldownRule(state, evaluated);
  if (rule) {
    evaluated.eligible = false;
    evaluated.blockedBy = `${rule.cooldownDays}-day ${rule.relationshipType.replace("_", " ")} rule`;
    return evaluated;
  }

  return evaluated;
}

export function applyPolicies(state: MadeThisState, opportunityId: string) {
  const opportunity = state.opportunities.find((item) => item.id === opportunityId);
  if (!opportunity) throw new Error(`Unknown opportunity: ${opportunityId}`);
  opportunity.paths = opportunity.paths.map((item) => evaluatePath(state, item));
  return opportunity;
}

function selectConnector(opportunity: Opportunity) {
  return [...opportunity.paths]
    .filter((item) => item.eligible)
    .sort((a, b) => b.strength - a.strength)[0];
}

function proposalCopy(
  opportunity: Opportunity,
  connector: RelationshipPath,
  companyName: string,
) {
  if (connector.type === "customer") {
    return {
      playId: "direct_intro" as const,
      actionType: "direct_intro" as const,
      subject: `${opportunity.account} × ${companyName}`,
      message: `${connector.name.split(" ")[0]} — would you be comfortable introducing me to ${opportunity.target} at ${opportunity.account}? I made a 45-second teardown of how ${companyName} could help their team. No worries if the timing is not right.`,
      relationshipCost: "Medium" as const,
      expectedEffect: "Estimated 20–35% chance of a warm reply",
      confidence: 74,
    };
  }

  return {
    playId: "permission_first_artifact_share" as const,
    actionType: "permission_first_artifact_share" as const,
    subject: `Useful for ${opportunity.target} at ${opportunity.account}?`,
    message: `${connector.name.split(" ")[0]} — I made a 45-second teardown for ${opportunity.target} at ${opportunity.account}. If it feels genuinely useful, would you be comfortable forwarding it to them? No need to make an introduction.`,
    relationshipCost: "Low" as const,
    expectedEffect: "Estimated 15–28% chance of a qualified reply",
    confidence: 68,
  };
}

function createProposal(state: MadeThisState, opportunity: Opportunity, now: Date) {
  const connector = selectConnector(opportunity);
  if (!connector) throw new Error("No eligible relationship path");
  const copy = proposalCopy(opportunity, connector, state.workspace);
  const play = state.plays.find((item) => item.id === copy.playId && item.status === "active");
  if (!play) throw new Error(`No active play: ${copy.playId}`);

  const id = `P-${pad(state.proposals.length + 1)}`;
  const activeRules = state.rules.filter((rule) => rule.status === "active");
  const changedBecause: string[] = [];
  if (activeRules.length) {
    changedBecause.push(
      `${activeRules[0].id}@${activeRules[0].version}: ${activeRules[0].text}`,
    );
  }
  if (state.outcomes.some((outcome) => outcome.type === "meeting_booked")) {
    changedBecause.push(
      "Y-003: artifact-first through a former colleague produced one meeting (low sample)",
    );
  }

  const proposalBase = {
    id,
    opportunityId: opportunity.id,
    account: opportunity.account,
    target: opportunity.target,
    connector,
    playId: copy.playId,
    playVersion: play.version,
    actionType: copy.actionType,
    channel: "email" as const,
    subject: copy.subject,
    message: copy.message,
    status: "pending_approval" as const,
    relationshipCost: copy.relationshipCost,
    expectedEffect: copy.expectedEffect,
    confidence: copy.confidence,
    uncertainty:
      "Estimate is directional and based on synthetic evidence; observed sample size is low.",
    evidenceIds: [
      `SIG-${opportunity.id === "opp-bluebird" ? "022" : "031"}`,
      `REL-${connector.id}`,
    ],
    evidence: [
      {
        id: `SIG-${opportunity.id === "opp-bluebird" ? "022" : "031"}`,
        label: opportunity.signalType,
        detail: `${opportunity.signal} · ${opportunity.signalAge}`,
        source: "Synthetic public + first-party signal",
      },
      {
        id: `REL-${connector.id}`,
        label: "Relationship evidence",
        detail: `${connector.name} · ${connector.strength}/100 · last favor ${connector.daysSinceFavor} days ago`,
        source: connector.evidence,
      },
    ],
    alternatives: opportunity.paths
      .filter((item) => item.id !== connector.id)
      .map((item) =>
        item.eligible
          ? `${item.name}: lower relationship strength (${item.strength}/100)`
          : `${item.name}: excluded by ${item.blockedBy}`,
      ),
    changedBecause,
    policyVersionIds: activeRules.map((rule) => `${rule.id}@${rule.version}`),
    contextHash: snapshotHash(state, opportunity.id),
    createdAt: timestamp(now),
    expiresAt: new Date(now.getTime() + 2 * 60 * 60_000).toISOString(),
    approvalRequired: true,
  };
  const proposal: Proposal = {
    ...proposalBase,
    payloadHash: canonicalPayloadHash(proposalBase),
  };

  state.proposals.push(proposal);
  state.activeProposalId = proposal.id;
  opportunity.status = "active";
  state.activeOpportunityId = opportunity.id;
  play.usageCount += 1;
  return proposal;
}

function compileFeedbackRule(
  state: MadeThisState,
  proposal: Proposal,
  rationale: string,
  now: Date,
) {
  const asksForCustomerRule = /customer/i.test(rationale) && /intro/i.test(rationale);
  const dayMatches = [...rationale.matchAll(/(\d{2,3})\s*days?/gi)];
  const explicitDays = dayMatches.map((match) => Number(match[1])).find((value) => value >= 15);
  const directiveIsClear = /never|do not|don't|avoid/i.test(rationale);

  if (asksForCustomerRule && explicitDays && directiveIsClear) {
    const rule: PolicyRule = {
      id: `R-${pad(state.rules.length + 1)}`,
      version: 1,
      text: `Never ask a customer for another introduction within ${explicitDays} days.`,
      relationshipType: "customer",
      cooldownDays: explicitDays,
      owner: "user",
      status: "active",
      provenance: `${proposal.id} rejection by ${state.founder}: “${rationale}”`,
      createdAt: timestamp(now),
      appliedCount: 0,
    };
    state.rules.push(rule);
    return rule;
  }

  state.pendingChanges.push({
    id: `C-${pad(state.pendingChanges.length + 1)}`,
    targetPlayId: proposal.playId,
    baseVersion: proposal.playVersion,
    status: "pending",
    title: "Clarify feedback before changing behavior",
    rationale,
    before: "Current play remains active",
    after: "Candidate adjustment needs explicit scope and directive",
    expectedEffect: "No behavioral change until reviewed",
    evidenceIds: [proposal.id],
  });
  return undefined;
}

export interface GateDecision {
  decision: "continue" | "require_approval" | "block";
  reasonCodes: string[];
  authority?: "exact_approval" | "trust_grant";
}

export function beforeAction(
  state: MadeThisState,
  proposal: Proposal,
  now = new Date(),
): GateDecision {
  try {
    const reasons: string[] = [];
    if (state.status !== "running") reasons.push(`agent_${state.status}`);
    if (new Date(proposal.expiresAt) <= now) reasons.push("proposal_expired");
    if (state.sentToday >= state.dailyCap) reasons.push("daily_cap_reached");
    if (state.executions.some((execution) => execution.proposalId === proposal.id)) {
      reasons.push("duplicate_execution");
    }
    if (canonicalPayloadHash(proposal) !== proposal.payloadHash) reasons.push("payload_hash_mismatch");

    const currentPath = evaluatePath(state, proposal.connector);
    if (!currentPath.eligible) reasons.push("current_policy_blocked_connector");

    if (reasons.length) return { decision: "block", reasonCodes: reasons };
    if (proposal.approvalHash === proposal.payloadHash) {
      return { decision: "continue", reasonCodes: [], authority: "exact_approval" };
    }

    const grant = state.trustGrant;
    const grantMatches =
      state.mode === "autopilot" &&
      grant.active &&
      grant.adapter === "simulate_send" &&
      grant.actionType === proposal.actionType &&
      grant.allowedRelationshipTypes.includes(proposal.connector.type) &&
      proposal.relationshipCost === grant.maxRelationshipCost &&
      state.sentToday < grant.dailyCap &&
      new Date(grant.expiresAt) > now;

    if (grantMatches) {
      return { decision: "continue", reasonCodes: [], authority: "trust_grant" };
    }
    return { decision: "require_approval", reasonCodes: ["exact_approval_required"] };
  } catch {
    return { decision: "block", reasonCodes: ["before_action_failed_closed"] };
  }
}

function executeProposal(state: MadeThisState, proposal: Proposal, now: Date) {
  const gate = beforeAction(state, proposal, now);
  const executionId = `X-${pad(state.executions.length + 1)}`;
  addEvent(state, now, {
    actor: "system",
    type: "action.gated",
    title:
      gate.decision === "continue"
        ? `beforeAction authorized ${proposal.id}`
        : `beforeAction ${gate.decision.replace("_", " ")}`,
    detail:
      gate.decision === "continue"
        ? `Authority: ${gate.authority?.replace("_", " ")} · payload ${proposal.payloadHash.slice(0, 8)}…`
        : gate.reasonCodes.join(", "),
    correlationId: executionId,
    tone: gate.decision === "continue" ? "positive" : "warning",
  });

  if (gate.decision !== "continue") {
    if (gate.decision === "block") proposal.status = "blocked";
    state.lastNotice = {
      tone: "warning",
      message:
        gate.decision === "require_approval"
          ? "This exact action still needs approval."
          : `Execution blocked: ${gate.reasonCodes.join(", ")}`,
    };
    return gate;
  }

  state.executions.push({
    id: executionId,
    proposalId: proposal.id,
    adapter: "simulate_send",
    idempotencyKey: `simulate_send:${proposal.id}:${proposal.payloadHash}`,
    payloadHash: proposal.payloadHash,
    status: "completed",
    timestamp: timestamp(now),
    simulation: true,
    reasonCodes: [],
  });
  proposal.status = "executed";
  state.sentToday += 1;
  if (state.phase !== "second_cycle") state.phase = "sent";
  addEvent(state, now, {
    actor: "simulator",
    type: "action.executed",
    title: `Simulated email sent to ${proposal.connector.name}`,
    detail: `afterAction stored ${executionId} and its audit event atomically · no live communication occurred.`,
    correlationId: executionId,
    tone: "positive",
  });
  state.lastNotice = {
    tone: "success",
    message: `Simulated send complete. Receipt ${executionId} is in the activity trail.`,
  };
  return gate;
}

function runHeartbeat(state: MadeThisState, now: Date) {
  if (state.status !== "running") {
    state.lastNotice = { tone: "warning", message: `MadeThis CMO is ${state.status}. Resume it first.` };
    return;
  }
  if (state.heartbeatLocked) {
    state.lastNotice = { tone: "warning", message: "A heartbeat is already running." };
    return;
  }

  const pending = state.proposals.find((proposal) => proposal.status === "pending_approval");
  if (pending) {
    state.activeProposalId = pending.id;
    state.lastNotice = { tone: "info", message: `${pending.id} is waiting for a decision.` };
    return;
  }

  const heartbeatId = `H-${pad(state.heartbeatRuns.length + 1)}`;
  const opportunityId = state.phase === "outcome_recorded" ? "opp-northstar" : "opp-bluebird";
  const contextHash = snapshotHash(state, opportunityId);
  state.heartbeatLocked = true;
  state.heartbeatRuns.push({
    id: heartbeatId,
    trigger: "manual",
    status: "running",
    contextHash,
    claimedAt: timestamp(now),
  });
  addEvent(state, now, {
    actor: "system",
    type: "heartbeat.claimed",
    title: `${heartbeatId} claimed an isolated context`,
    detail: `Snapshot ${contextHash.slice(0, 10)}… · active policies and eligible play versions only.`,
    correlationId: heartbeatId,
  });

  try {
    const opportunity = applyPolicies(state, opportunityId);
    const proposal = createProposal(state, opportunity, now);
    const run = state.heartbeatRuns.at(-1)!;
    run.status = "completed";
    run.proposalId = proposal.id;
    run.terminalAt = timestamp(now);
    state.lastHeartbeatAt = timestamp(now);
    state.phase = opportunityId === "opp-northstar" ? "second_cycle" : "proposal_pending";
    state.heartbeatLocked = false;
    addEvent(state, now, {
      actor: "agent",
      type: "proposal.created",
      title: `${proposal.id}: ${proposal.actionType === "direct_intro" ? "Direct introduction" : "Permission-first share"} via ${proposal.connector.name}`,
      detail: `${opportunity.account} ranked ${opportunity.score.total}/100 · selected ${proposal.playId}@${proposal.playVersion}.`,
      correlationId: heartbeatId,
      tone: "positive",
    });
    addEvent(state, now, {
      actor: "system",
      type: "heartbeat.completed",
      title: `${heartbeatId} completed with ${proposal.id}`,
      detail: "At most one proposal was created and the run receipt is terminal.",
      correlationId: heartbeatId,
    });
    state.lastNotice = {
      tone: "success",
      message: `${proposal.account} is the best opportunity. Review ${proposal.id}.`,
    };

    if (state.mode === "autopilot") executeProposal(state, proposal, now);
  } catch (error) {
    const run = state.heartbeatRuns.at(-1)!;
    run.status = "failed";
    run.terminalAt = timestamp(now);
    state.heartbeatLocked = false;
    state.lastNotice = {
      tone: "warning",
      message: error instanceof Error ? error.message : "Heartbeat failed safely.",
    };
  }
}

function rejectProposal(
  state: MadeThisState,
  proposalId: string,
  rationale: string,
  now: Date,
) {
  const proposal = state.proposals.find((item) => item.id === proposalId);
  if (!proposal || proposal.status !== "pending_approval") {
    throw new Error("Only a pending proposal can be rejected");
  }
  if (!rationale.trim()) throw new Error("A rejection rationale is required");
  proposal.status = "rejected";
  proposal.decisionReason = rationale.trim();
  addEvent(state, now, {
    actor: "user",
    type: "proposal.rejected",
    title: `${state.founder} rejected ${proposal.id}`,
    detail: rationale.trim(),
    correlationId: proposal.id,
    tone: "warning",
  });
  const rule = compileFeedbackRule(state, proposal, rationale.trim(), now);
  if (rule) {
    addEvent(state, now, {
      actor: "system",
      type: "policy.activated",
      title: `${rule.id}@1 activated from an exact directive`,
      detail: `${rule.text} Scope: all customer connectors.`,
      correlationId: proposal.id,
      tone: "positive",
    });
  }

  const opportunity = applyPolicies(state, proposal.opportunityId);
  if (rule) {
    const blocked = opportunity.paths.find((item) => item.id === proposal.connector.id);
    rule.appliedCount += blocked?.eligible ? 0 : 1;
    rule.lastEffect = blocked?.eligible
      ? undefined
      : `${proposal.connector.name} excluded from ${opportunity.account}`;
  }
  const next = createProposal(state, opportunity, now);
  state.phase = "reranked";
  addEvent(state, now, {
    actor: "agent",
    type: "opportunity.reranked",
    title: `Re-ranked ${opportunity.account}: ${next.connector.name} is now the safest path`,
    detail: `${proposal.connector.name} is ineligible; switched to ${next.playId}@${next.playVersion} with ${next.relationshipCost.toLowerCase()} relationship cost.`,
    correlationId: next.id,
    tone: "positive",
  });
  state.lastNotice = {
    tone: "success",
    message: `${rule ? "Rule activated" : "Feedback saved for review"}. The next action changed immediately.`,
  };
}

function approveAndExecute(state: MadeThisState, proposalId: string, now: Date) {
  const proposal = state.proposals.find((item) => item.id === proposalId);
  if (!proposal || proposal.status !== "pending_approval") {
    throw new Error("Only a pending proposal can be approved");
  }
  proposal.approvalHash = proposal.payloadHash;
  proposal.status = "approved";
  addEvent(state, now, {
    actor: "user",
    type: "proposal.approved",
    title: `${state.founder} approved ${proposal.id}`,
    detail: `Exact payload ${proposal.payloadHash.slice(0, 8)}… approved for simulator only.`,
    correlationId: proposal.id,
    tone: "positive",
  });
  executeProposal(state, proposal, now);
}

function editProposal(state: MadeThisState, proposalId: string, message: string, now: Date) {
  const proposal = state.proposals.find((item) => item.id === proposalId);
  if (!proposal || proposal.status !== "pending_approval") {
    throw new Error("Only a pending proposal can be edited");
  }
  if (!message.trim()) throw new Error("Message cannot be empty");
  const before = proposal.message;
  proposal.message = message.trim();
  proposal.payloadHash = canonicalPayloadHash(proposal);
  delete proposal.approvalHash;
  proposal.editDiff = { before, after: proposal.message };
  addEvent(state, now, {
    actor: "user",
    type: "proposal.edited",
    title: `${proposal.id} payload edited; approval required`,
    detail: `The canonical hash changed to ${proposal.payloadHash.slice(0, 8)}….`,
    correlationId: proposal.id,
  });
  state.lastNotice = {
    tone: "info",
    message: "Draft updated. Review and approve the exact revised payload.",
  };
}

function injectPositiveOutcome(state: MadeThisState, now: Date) {
  const proposal = [...state.proposals]
    .reverse()
    .find(
      (item) =>
        item.opportunityId === "opp-bluebird" &&
        item.playId === "permission_first_artifact_share" &&
        item.status === "executed",
    );
  if (!proposal) throw new Error("Execute the Bluebird artifact share before recording an outcome");
  const execution = state.executions.find((item) => item.proposalId === proposal.id);
  if (!execution) throw new Error("Execution receipt is missing");
  if (state.outcomes.some((item) => item.executionId === execution.id)) {
    state.lastNotice = { tone: "info", message: "This outcome fixture was already recorded." };
    return;
  }

  const outcomeTypes = ["accepted", "replied_positive", "meeting_booked"] as const;
  outcomeTypes.forEach((type, index) => {
    state.outcomes.push({
      id: `Y-${pad(state.outcomes.length + 1)}`,
      executionId: execution.id,
      type,
      timestamp: new Date(now.getTime() + index * 1_000).toISOString(),
      synthetic: true,
    });
  });
  const opportunity = state.opportunities.find((item) => item.id === proposal.opportunityId)!;
  opportunity.status = "won";
  const play = state.plays.find((item) => item.id === proposal.playId)!;
  play.winCount += 1;
  state.pendingChanges.push({
    id: `C-${pad(state.pendingChanges.length + 1)}`,
    targetPlayId: play.id,
    baseVersion: play.version,
    status: "pending",
    title: "Prefer artifact-first for similar hiring signals",
    rationale: "One accepted share led to a positive reply and a meeting through a former colleague.",
    before: "Artifact-first is an equal-weight eligible play",
    after: "Use artifact-first as a low-confidence tiebreaker for hiring signals",
    expectedEffect: "Lower social cost when two warm paths score within five points",
    evidenceIds: ["Y-001", "Y-002", "Y-003"],
  });
  state.phase = "outcome_recorded";
  state.workstreams.find((item) => item.id === "pipeline")!.progress = 92;
  state.workstreams.find((item) => item.id === "content")!.nextAction =
    "Draft a research-hiring insight from the winning teardown";
  addEvent(state, now, {
    actor: "simulator",
    type: "outcome.recorded",
    title: "Maya replied and booked a meeting",
    detail: "Synthetic funnel: connector accepted → positive reply → meeting booked.",
    correlationId: execution.id,
    tone: "positive",
  });
  addEvent(state, now, {
    actor: "system",
    type: "performance.updated",
    title: `${play.id}@${play.version} performance updated`,
    detail: "1 meeting from 1 observed execution · low sample. Inferred expansion remains pending.",
    correlationId: "C-001",
    tone: "positive",
  });
  state.lastNotice = {
    tone: "success",
    message: "Meeting booked. The result will inform the next heartbeat, with a low-sample warning.",
  };
}

function decideChange(
  state: MadeThisState,
  changeId: string,
  decision: "approved" | "rejected",
  now: Date,
) {
  const change = state.pendingChanges.find((item) => item.id === changeId);
  if (!change || change.status !== "pending") throw new Error("Pending change not found");
  change.status = decision;
  const play = state.plays.find((item) => item.id === change.targetPlayId);
  if (decision === "approved" && play) {
    const previous = play.version;
    play.previousVersion = previous;
    play.version += 1;
    play.owner = "user";
    change.resultVersion = play.version;
  }
  addEvent(state, now, {
    actor: "user",
    type: `change.${decision}`,
    title: `${change.id} ${decision}`,
    detail:
      decision === "approved" && play
        ? `Created immutable ${play.id}@${play.version}; version ${play.previousVersion} remains available for rollback.`
        : "The proposed inference remains in history and does not affect behavior.",
    correlationId: change.id,
    tone: decision === "approved" ? "positive" : "neutral",
  });
}

export function marketingPlanDifficulty(actionType: MarketingPlanActionType) {
  return PLAN_ACTION_POLICY[actionType].difficulty;
}

function executeMarketingPlanStep(
  state: MadeThisState,
  plan: MarketingPlan,
  step: MarketingPlanStep,
  authority: "user" | "autopilot",
  now: Date,
  subagent?: MarketingPlanStep["subagent"],
) {
  if (step.status === "completed") {
    state.lastNotice = {
      tone: "info",
      message: `${plan.id} priority ${step.priority} is already complete.`,
    };
    return;
  }

  plan.selectedStepId = step.id;
  if (state.status !== "running") {
    step.status = "blocked";
    step.executionNote = `MadeThis CMO is ${state.status}; resume it before executing plan work.`;
    addEvent(state, now, {
      actor: authority === "autopilot" ? "agent" : "user",
      type: "marketing_plan.step_blocked",
      title: `${plan.id} priority ${step.priority} blocked`,
      detail: step.executionNote,
      correlationId: step.id,
      tone: "warning",
    });
    state.lastNotice = { tone: "warning", message: step.executionNote };
    return;
  }

  const policy = PLAN_ACTION_POLICY[step.actionType];
  if (authority === "autopilot" && policy.difficulty !== "easy") {
    step.status = "blocked";
    step.executionNote = "Autopilot can advance only code-approved easy internal plan work.";
    addEvent(state, now, {
      actor: "system",
      type: "marketing_plan.step_blocked",
      title: `${plan.id} priority ${step.priority} exceeded Autopilot scope`,
      detail: step.executionNote,
      correlationId: step.id,
      tone: "warning",
    });
    state.lastNotice = { tone: "warning", message: step.executionNote };
    return;
  }

  if (step.actionType === "run_heartbeat") runHeartbeat(state, now);
  let linkedInNote = "";
  if (step.actionType === "linkedin_prospect_search") {
    const prospects = searchLinkedInProspects(state.companyProfile);
    state.opportunities = applyLinkedInProspects(state.opportunities, prospects);
    linkedInNote = prospectSearchSummary(prospects);
    if (prospects[0]) {
      state.activeOpportunityId = `opp-${prospects[0].id}`;
      applyPolicies(state, state.activeOpportunityId);
    }
    addEvent(state, now, {
      actor: "agent",
      type: "linkedin.prospects_scored",
      title: "LinkedIn prospect status scored",
      detail: linkedInNote,
      correlationId: step.id,
      tone: "positive",
    });
  }

  step.status = "completed";
  step.completedAt = timestamp(now);
  step.executionNote = linkedInNote
    ? `${policy.label}. ${linkedInNote} No live LinkedIn messages were sent.`
    : `${policy.label}. No live external action was taken.`;
  if (subagent) {
    step.subagent = subagent;
    step.executionNote = `${step.executionNote} Subagent ${subagent.name}: ${subagent.summary}`;
    addEvent(state, now, {
      actor: "agent",
      type: "subagent.completed",
      title: `Spawned ${subagent.name} for priority ${step.priority}`,
      detail: subagent.statusRead,
      correlationId: step.id,
      tone: "positive",
    });
  }
  const workstream = state.workstreams.find((item) => item.id === step.workstream);
  if (workstream) {
    workstream.progress = Math.min(100, workstream.progress + policy.progress);
    workstream.nextAction = `Review output: ${step.title}`;
  }
  plan.status = plan.steps.every((item) => item.status === "completed")
    ? "completed"
    : "in_progress";
  addEvent(state, now, {
    actor: authority === "autopilot" ? "agent" : "user",
    type: "marketing_plan.step_completed",
    title: `${plan.id} priority ${step.priority} completed`,
    detail: `${step.title} · ${step.executionNote}`,
    correlationId: step.id,
    tone: "positive",
  });
  state.lastNotice = {
    tone: "success",
    message: `${plan.id} priority ${step.priority} is complete. Review the diagram for the next move.`,
  };
}

function createMarketingPlan(state: MadeThisState, draft: MarketingPlanDraft, now: Date) {
  const normalized = withProspectingFirstStep(draft, state.companyProfile);
  if (normalized.steps.length < 3 || normalized.steps.length > 5) {
    throw new Error("A marketing plan must contain three to five priorities");
  }
  if (!normalized.steps.some((step) => marketingPlanDifficulty(step.actionType) === "easy")) {
    throw new Error("A marketing plan must include at least one safe easy priority");
  }

  const id = `MP-${pad(state.marketingPlans.length + 1)}`;
  const plan: MarketingPlan = {
    id,
    title: normalized.title,
    objective: normalized.objective,
    summary: normalized.summary,
    feedbackQuestion: normalized.feedbackQuestion,
    status: "awaiting_choice",
    source: "cursor-cli",
    createdAt: timestamp(now),
    steps: normalized.steps.map((step, index) => ({
      ...step,
      id: `${id}-S${index + 1}`,
      priority: index + 1,
      difficulty: marketingPlanDifficulty(step.actionType),
      status: "ready",
    })),
  };
  state.marketingPlans.push(plan);
  state.activeMarketingPlanId = plan.id;
  addEvent(state, now, {
    actor: "agent",
    type: "marketing_plan.created",
    title: `${plan.id}: ${plan.title}`,
    detail: `${plan.steps.length} priorities ranked for “${plan.objective}”.`,
    correlationId: plan.id,
    tone: "positive",
  });

  if (state.mode === "autopilot") {
    const easyStep = plan.steps.find((step) => step.difficulty === "easy");
    if (easyStep) {
      plan.autoExecutedStepId = easyStep.id;
      executeMarketingPlanStep(state, plan, easyStep, "autopilot", now);
      return;
    }
  }

  state.lastNotice = {
    tone: "info",
    message: `${plan.id} is prioritized. Choose which step to execute in the CMO chat.`,
  };
}

function planCanBeReplaced(plan?: MarketingPlan) {
  return Boolean(
    plan &&
      plan.status === "awaiting_choice" &&
      !plan.selectedStepId &&
      !plan.autoExecutedStepId &&
      plan.steps.every((step) => step.status === "ready"),
  );
}

function replaceMarketingPlan(state: MadeThisState, draft: MarketingPlanDraft, now: Date) {
  const active = state.marketingPlans.find((item) => item.id === state.activeMarketingPlanId);
  if (!planCanBeReplaced(active)) return;
  const normalized = withProspectingFirstStep(draft, state.companyProfile);
  if (normalized.steps.length < 3 || normalized.steps.length > 5) {
    throw new Error("A marketing plan must contain three to five priorities");
  }
  if (!normalized.steps.some((step) => marketingPlanDifficulty(step.actionType) === "easy")) {
    throw new Error("A marketing plan must include at least one safe easy priority");
  }
  active!.title = normalized.title;
  active!.objective = normalized.objective;
  active!.summary = normalized.summary;
  active!.feedbackQuestion = normalized.feedbackQuestion;
  active!.steps = normalized.steps.map((step, index) => ({
    ...step,
    id: `${active!.id}-S${index + 1}`,
    priority: index + 1,
    difficulty: marketingPlanDifficulty(step.actionType),
    status: "ready",
  }));
  addEvent(state, now, {
    actor: "agent",
    type: "marketing_plan.updated",
    title: `${active!.id}: ${active!.title}`,
    detail: `Market evidence refreshed ${active!.steps.length} priorities for “${active!.objective}”.`,
    correlationId: active!.id,
    tone: "positive",
  });
}

function applyMarketEvidence(
  state: MadeThisState,
  profile: CompanyProfile,
  draft: MarketingPlanDraft,
  now: Date,
) {
  const originalBrief = state.companyProfile?.originalBrief ?? profile.originalBrief;
  const researchedAt = state.companyProfile?.researchedAt ?? profile.researchedAt;
  state.companyProfile = clone({ ...profile, originalBrief, researchedAt });
  state.workspace = profile.name;
  addEvent(state, now, {
    actor: "agent",
    type: "market.evidence_updated",
    title: `Market evidence updated ${profile.name}`,
    detail: `Checked public market sources and refreshed the ${profile.category} brief.`,
    tone: "positive",
  });
  replaceMarketingPlan(state, draft, now);
  state.lastNotice = {
    tone: "success",
    message: `Market evidence updated the ${profile.name} brief and GTM plan.`,
  };
}

export function commandReducer(
  input: MadeThisState,
  command: Command,
  now = new Date(),
): MadeThisState {
  if (command.type === "reset") return createInitialState(now);
  if (command.type === "new_user") {
    const fresh = createInitialState(now);
    fresh.workspace = "New company";
    fresh.founder = "You";
    fresh.proposals = [];
    fresh.rules = [];
    fresh.pendingChanges = [];
    fresh.activity = [];
    fresh.heartbeatRuns = [];
    fresh.executions = [];
    fresh.outcomes = [];
    fresh.marketingPlans = [];
    delete fresh.activeProposalId;
    delete fresh.activeMarketingPlanId;
    delete fresh.lastNotice;
    return fresh;
  }
  if (command.type === "onboard_company") {
    const fresh = createInitialState(now);
    fresh.workspace = command.profile.name;
    fresh.founder = "You";
    fresh.companyProfile = clone(command.profile);
    fresh.marketingPlans = [];
    fresh.activity = [];
    addEvent(fresh, now, {
      actor: "agent",
      type: "company.researched",
      title: `${command.profile.name} workspace created`,
      detail: `Opened the ${command.profile.name} workspace from the company brief. Market evidence can still be checked in the background.`,
      tone: "positive",
    });
    createMarketingPlan(fresh, command.draft, now);
    fresh.lastNotice = {
      tone: "info",
      message: `${command.profile.name} workspace is open. Market evidence is still being checked.`,
    };
    return fresh;
  }
  const state = clone(input);

  switch (command.type) {
    case "run_heartbeat":
      runHeartbeat(state, now);
      break;
    case "reject":
      rejectProposal(state, command.proposalId, command.rationale, now);
      break;
    case "edit":
      editProposal(state, command.proposalId, command.message, now);
      break;
    case "approve_execute":
      approveAndExecute(state, command.proposalId, now);
      break;
    case "snooze": {
      const proposal = state.proposals.find((item) => item.id === command.proposalId);
      if (!proposal || proposal.status !== "pending_approval") {
        throw new Error("Only a pending proposal can be snoozed");
      }
      proposal.status = "snoozed";
      addEvent(state, now, {
        actor: "user",
        type: "proposal.snoozed",
        title: `${proposal.id} snoozed`,
        detail: "No outbound action was taken.",
        correlationId: proposal.id,
      });
      state.lastNotice = { tone: "info", message: "Proposal snoozed. Nothing was sent." };
      break;
    }
    case "inject_positive_outcome":
      injectPositiveOutcome(state, now);
      break;
    case "toggle_pause":
      state.status = state.status === "running" ? "paused" : "running";
      addEvent(state, now, {
        actor: "user",
        type: `agent.${state.status}`,
        title: `MadeThis CMO ${state.status}`,
        detail:
          state.status === "paused"
            ? "New work and execution are blocked; queued state is preserved."
            : "Heartbeat and simulator execution are available again.",
        tone: state.status === "paused" ? "warning" : "positive",
      });
      break;
    case "stop":
      state.status = "stopped";
      state.proposals.forEach((proposal) => {
        if (proposal.status === "pending_approval" || proposal.status === "approved") {
          proposal.status = "blocked";
        }
      });
      addEvent(state, now, {
        actor: "user",
        type: "agent.stopped",
        title: "MadeThis CMO stopped",
        detail: "All unexecuted proposals were cancelled. Explicit resume is required.",
        tone: "warning",
      });
      break;
    case "set_mode":
      state.mode = command.mode;
      addEvent(state, now, {
        actor: "user",
        type: "mode.changed",
        title: `${command.mode === "autopilot" ? "Autopilot" : "Propose"} mode enabled`,
        detail:
          command.mode === "autopilot"
            ? "Only low-cost simulated artifact shares to former colleagues may execute automatically."
            : "Every outbound action now requires exact approval.",
        tone: "neutral",
      });
      break;
    case "apply_market_evidence":
      applyMarketEvidence(state, command.profile, command.draft, now);
      break;
    case "create_marketing_plan":
      createMarketingPlan(state, command.draft, now);
      break;
    case "execute_plan_step": {
      const plan = state.marketingPlans.find((item) => item.id === command.planId);
      const step = plan?.steps.find((item) => item.id === command.stepId);
      if (!plan || !step) throw new Error("Marketing plan priority not found");
      executeMarketingPlanStep(state, plan, step, "user", now, command.subagent);
      break;
    }
    case "disable_rule": {
      const rule = state.rules.find((item) => item.id === command.ruleId);
      if (!rule) throw new Error("Rule not found");
      rule.status = "disabled";
      state.opportunities.forEach((opportunity) => applyPolicies(state, opportunity.id));
      addEvent(state, now, {
        actor: "user",
        type: "policy.disabled",
        title: `${rule.id}@${rule.version} disabled`,
        detail: "The audit record remains, but the rule no longer filters relationship paths.",
        correlationId: rule.id,
      });
      break;
    }
    case "enable_rule": {
      const rule = state.rules.find((item) => item.id === command.ruleId);
      if (!rule) throw new Error("Rule not found");
      rule.status = "active";
      state.opportunities.forEach((opportunity) => applyPolicies(state, opportunity.id));
      addEvent(state, now, {
        actor: "user",
        type: "policy.activated",
        title: `${rule.id}@${rule.version} restored`,
        detail: "The user-authored cooldown is active again.",
        correlationId: rule.id,
      });
      break;
    }
    case "decide_change":
      decideChange(state, command.changeId, command.decision, now);
      break;
    case "rollback_play": {
      const play = state.plays.find((item) => item.id === command.playId);
      if (!play || !play.previousVersion) throw new Error("No prior play version to restore");
      const rolledBack = play.version;
      play.version = play.previousVersion;
      delete play.previousVersion;
      addEvent(state, now, {
        actor: "user",
        type: "play.rolled_back",
        title: `${play.id} rolled back to version ${play.version}`,
        detail: `Version ${rolledBack} remains in the immutable change history.`,
        correlationId: play.id,
      });
      break;
    }
  }

  return state;
}
