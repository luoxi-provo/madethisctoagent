export type Mode = "propose" | "autopilot";
export type AgentStatus = "running" | "paused" | "stopped";
export type ProposalStatus =
  | "pending_approval"
  | "approved"
  | "rejected"
  | "snoozed"
  | "executed"
  | "blocked";

export interface ScoreBreakdown {
  fit: number;
  signal: number;
  relationship: number;
  learned: number;
  freshness: number;
  total: number;
}

export interface RelationshipPath {
  id: string;
  name: string;
  initials: string;
  role: string;
  type: "customer" | "former_colleague" | "investor" | "friend";
  strength: number;
  daysSinceFavor: number;
  favorsIn90Days: number;
  evidence: string;
  eligible: boolean;
  blockedBy?: string;
}

export interface Opportunity {
  id: string;
  account: string;
  target: string;
  targetRole: string;
  initials: string;
  signal: string;
  signalType: string;
  signalAge: string;
  fitLabel: "High fit" | "Medium fit" | "Low fit";
  score: ScoreBreakdown;
  paths: RelationshipPath[];
  status: "ready" | "active" | "won" | "watching";
  prospectStatus?: string;
  prospectStage?: "hiring" | "active" | "open" | "warming" | "cold";
  source?: "seed" | "linkedin_search";
  linkedinUrl?: string;
}

export interface Proposal {
  id: string;
  opportunityId: string;
  account: string;
  target: string;
  connector: RelationshipPath;
  playId: string;
  playVersion: number;
  actionType: "direct_intro" | "permission_first_artifact_share";
  channel: "email";
  subject: string;
  message: string;
  payloadHash: string;
  status: ProposalStatus;
  relationshipCost: "Low" | "Medium" | "High";
  expectedEffect: string;
  confidence: number;
  uncertainty: string;
  evidenceIds: string[];
  evidence: Array<{ id: string; label: string; detail: string; source: string }>;
  alternatives: string[];
  changedBecause: string[];
  policyVersionIds: string[];
  contextHash: string;
  createdAt: string;
  expiresAt: string;
  approvalRequired: boolean;
  approvalHash?: string;
  decisionReason?: string;
  editDiff?: { before: string; after: string };
}

export interface PolicyRule {
  id: string;
  version: number;
  text: string;
  relationshipType: RelationshipPath["type"];
  cooldownDays: number;
  owner: "user" | "system";
  status: "active" | "disabled" | "rolled_back";
  provenance: string;
  createdAt: string;
  appliedCount: number;
  lastEffect?: string;
}

export interface Play {
  id: string;
  name: string;
  version: number;
  status: "active" | "rolled_back";
  owner: "system" | "agent" | "user";
  description: string;
  channel: string;
  relationshipCost: "Low" | "Medium" | "High";
  usageCount: number;
  winCount: number;
  previousVersion?: number;
}

export interface PendingChange {
  id: string;
  targetPlayId: string;
  baseVersion: number;
  status: "pending" | "approved" | "rejected";
  title: string;
  rationale: string;
  before: string;
  after: string;
  expectedEffect: string;
  evidenceIds: string[];
  resultVersion?: number;
}

export interface ActivityEvent {
  id: string;
  timestamp: string;
  actor: "agent" | "user" | "simulator" | "system";
  type: string;
  title: string;
  detail: string;
  mode: Mode;
  correlationId?: string;
  tone?: "neutral" | "positive" | "warning";
}

export interface HeartbeatRun {
  id: string;
  trigger: "manual" | "scheduled";
  status: "claimed" | "running" | "completed" | "failed" | "unknown";
  contextHash: string;
  proposalId?: string;
  noActionReason?: string;
  claimedAt: string;
  terminalAt?: string;
}

export interface Outcome {
  id: string;
  executionId: string;
  type: "accepted" | "replied_positive" | "meeting_booked" | "declined";
  timestamp: string;
  synthetic: true;
}

export interface Execution {
  id: string;
  proposalId: string;
  adapter: "simulate_send";
  idempotencyKey: string;
  payloadHash: string;
  status: "completed" | "blocked";
  timestamp: string;
  simulation: true;
  reasonCodes: string[];
}

export interface MarketingWorkstream {
  id: string;
  name: string;
  description: string;
  status: "active" | "monitoring" | "queued";
  cadence: string;
  nextAction: string;
  progress: number;
  accent: "violet" | "orange" | "blue" | "green";
}

export type MarketingPlanActionType =
  | "linkedin_prospect_search"
  | "research_brief"
  | "content_draft"
  | "campaign_outline"
  | "funnel_analysis"
  | "run_heartbeat";

export type MarketingPlanStepStatus = "ready" | "completed" | "blocked";

export interface MarketingPlanDraftStep {
  title: string;
  description: string;
  rationale: string;
  workstream: "pipeline" | "content" | "lifecycle" | "analytics";
  actionType: MarketingPlanActionType;
  expectedOutcome: string;
}

export interface MarketingPlanDraft {
  title: string;
  objective: string;
  summary: string;
  feedbackQuestion: string;
  steps: MarketingPlanDraftStep[];
}

export interface MarketingPlanStep extends MarketingPlanDraftStep {
  id: string;
  priority: number;
  difficulty: "easy" | "medium";
  status: MarketingPlanStepStatus;
  executionNote?: string;
  completedAt?: string;
  subagent?: {
    name: string;
    summary: string;
    findings: string[];
    statusRead: string;
  };
}

export interface MarketingPlan {
  id: string;
  title: string;
  objective: string;
  summary: string;
  feedbackQuestion: string;
  status: "awaiting_choice" | "in_progress" | "completed";
  source: "cursor-cli";
  createdAt: string;
  steps: MarketingPlanStep[];
  selectedStepId?: string;
  autoExecutedStepId?: string;
}

export interface CompanyResearchSource {
  title: string;
  url: string;
}

export interface CompanyProfile {
  name: string;
  website?: string;
  industry: string;
  category: string;
  tagline: string;
  summary: string;
  audience: string;
  businessModel: string;
  competitors: string[];
  marketSignals: string[];
  assumptions: string[];
  sources: CompanyResearchSource[];
  originalBrief: string;
  researchedAt: string;
}

export interface MadeThisState {
  schemaVersion: 1;
  productName: "MadeThis CMO";
  workspace: string;
  founder: string;
  companyProfile?: CompanyProfile;
  mode: Mode;
  status: AgentStatus;
  phase:
    | "ready"
    | "proposal_pending"
    | "reranked"
    | "sent"
    | "outcome_recorded"
    | "second_cycle";
  simulation: true;
  dailyCap: number;
  sentToday: number;
  heartbeatLocked: boolean;
  lastHeartbeatAt?: string;
  nextHeartbeatLabel: string;
  activeOpportunityId: string;
  opportunities: Opportunity[];
  proposals: Proposal[];
  activeProposalId?: string;
  rules: PolicyRule[];
  plays: Play[];
  pendingChanges: PendingChange[];
  activity: ActivityEvent[];
  heartbeatRuns: HeartbeatRun[];
  executions: Execution[];
  outcomes: Outcome[];
  workstreams: MarketingWorkstream[];
  marketingPlans: MarketingPlan[];
  activeMarketingPlanId?: string;
  trustGrant: {
    id: string;
    active: boolean;
    adapter: "simulate_send";
    actionType: "permission_first_artifact_share";
    allowedRelationshipTypes: RelationshipPath["type"][];
    maxRelationshipCost: "Low";
    dailyCap: number;
    expiresAt: string;
    quietHours: string;
  };
  lastNotice?: { tone: "success" | "warning" | "info"; message: string };
}

export type Command =
  | { type: "reset" }
  | { type: "new_user" }
  | { type: "onboard_company"; profile: CompanyProfile; draft: MarketingPlanDraft }
  | { type: "apply_market_evidence"; profile: CompanyProfile; draft: MarketingPlanDraft }
  | { type: "run_heartbeat" }
  | { type: "reject"; proposalId: string; rationale: string }
  | { type: "edit"; proposalId: string; message: string }
  | { type: "approve_execute"; proposalId: string }
  | { type: "snooze"; proposalId: string }
  | { type: "inject_positive_outcome" }
  | { type: "toggle_pause" }
  | { type: "stop" }
  | { type: "set_mode"; mode: Mode }
  | { type: "create_marketing_plan"; draft: MarketingPlanDraft }
  | {
      type: "execute_plan_step";
      planId: string;
      stepId: string;
      subagent?: {
        name: string;
        summary: string;
        findings: string[];
        statusRead: string;
      };
    }
  | { type: "disable_rule"; ruleId: string }
  | { type: "enable_rule"; ruleId: string }
  | { type: "decide_change"; changeId: string; decision: "approved" | "rejected" }
  | { type: "rollback_play"; playId: string };
