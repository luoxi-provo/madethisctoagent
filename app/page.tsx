"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Bot,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  FileText,
  Gauge,
  GitBranch,
  Globe2,
  History,
  LayoutDashboard,
  Lightbulb,
  Linkedin,
  LockKeyhole,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Network,
  Pause,
  PencilLine,
  Play,
  Plus,
  Radio,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UsersRound,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ActivityEvent,
  Command,
  MadeThisState,
  MarketingPlan,
  MarketingPlanStep,
  MarketingWorkstream,
  Opportunity,
  Proposal,
} from "@/lib/types";

type Nav = "command" | "playbook" | "activity";

type OnboardingApiResponse = {
  type: "workspace" | "result";
  reply: string;
  state: MadeThisState;
  engine: "cursor-cli";
  researchPending?: boolean;
};

type OnboardingProgress = {
  id: string;
  title: string;
  detail: string;
  status: "active" | "complete" | "error";
};

type MarketResearchStatus = {
  active: boolean;
  elapsed: number;
  events: OnboardingProgress[];
  transcript: string;
  error?: string;
  completedReply?: string;
};

const ONBOARD_HOLD_MS = 10_000;

function upsertProgress(
  current: OnboardingProgress[],
  event: Omit<OnboardingProgress, "status">,
): OnboardingProgress[] {
  const completed = current.map((item) =>
    item.status === "active" ? { ...item, status: "complete" as const } : item,
  );
  const existing = completed.findIndex((item) => item.id === event.id);
  const next = { ...event, status: "active" as const };
  if (existing < 0) return [...completed, next];
  return [...completed.filter((_, index) => index !== existing), next];
}

const actorIcons = {
  agent: Bot,
  user: UsersRound,
  simulator: Radio,
  system: Settings,
};

function shortTime(value: string) {
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(
    new Date(value),
  );
}

function relativeLabel(value?: string) {
  if (!value) return "Not run yet";
  return `Last run ${shortTime(value)}`;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("");
}

function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

function Avatar({ name, warm = false }: { name: string; warm?: boolean }) {
  return <span className={`avatar ${warm ? "avatar-warm" : ""}`}>{initials(name)}</span>;
}

function StatusPill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

function Onboarding({
  researching,
  elapsed,
  agentEvents,
  agentTranscript,
  error,
  onSubmit,
}: {
  researching: boolean;
  elapsed: number;
  agentEvents: OnboardingProgress[];
  agentTranscript: string;
  error?: string;
  onSubmit: (message: string) => void;
}) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const eventsRef = useRef<HTMLDivElement>(null);
  const latestEvent = agentEvents.at(-1);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const container = eventsRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [agentEvents, agentTranscript]);

  function beginResearch() {
    const message = input.trim();
    if (!message || researching) return;
    onSubmit(message);
  }

  const suggestions = [
    "We help clinics reduce patient no-shows",
    "We’re launching an AI research workspace",
    "https://linear.app",
  ];

  return (
    <main className="onboarding-shell">
      <header className="onboarding-brand" aria-label="MadeThis CMO">
        <BrandMark />
        <div><strong>MadeThis</strong><span>CMO</span></div>
      </header>

      <section className="onboarding-stage" aria-labelledby="onboarding-title">
        <div className="onboarding-intro">
          <span className="onboarding-kicker"><span /> Your go-to-market agent</span>
          <h1 id="onboarding-title">I’m your CMO.<br />{" "}Let’s work out your marketing.</h1>
          <p>
            Tell me what you’re building or paste your website. I’ll identify the company,
            open the workspace, and keep checking market evidence in the background.
          </p>
        </div>

        <form
          className={`onboarding-composer ${researching ? "is-researching" : ""}`}
          aria-busy={researching}
          onSubmit={(event) => {
            event.preventDefault();
            beginResearch();
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                beginResearch();
              }
            }}
            placeholder="We make..."
            aria-label="Introduce your company or paste its website"
            readOnly={researching}
            rows={4}
          />
          <footer>
            <span>
              {researching ? (
                <>
                  <Radio size={14} />{" "}
                  {elapsed < 10
                    ? `Live briefing · workspace opens in ${10 - elapsed}s`
                    : latestEvent?.title ?? "Opening your workspace"}
                </>
              ) : (
                <>
                  <Globe2 size={14} /> Website research included
                </>
              )}
            </span>
            <button type="submit" disabled={!input.trim() || researching} aria-label="Research company and build plan">
              {researching ? <><span className="spinner" /> Working · {elapsed}s</> : <>Build my plan <ArrowRight size={15} /></>}
            </button>
          </footer>
        </form>

        {(researching || agentEvents.length > 0 || agentTranscript) && (
          <section className="onboarding-agent-output" aria-label="Live CMO agent output" aria-live="polite">
            <header>
              <div><span className="live-dot" /><strong>{latestEvent?.title ?? "Live CMO output"}</strong></div>
              <time>{researching ? `${elapsed}s · working` : "paused"}</time>
            </header>
            <div className="onboarding-agent-events" ref={eventsRef}>
              {agentEvents.map((event) => (
                <div className={`onboarding-agent-event is-${event.status}`} key={event.id}>
                  <span className="agent-event-status">
                    {event.status === "complete" ? <Check size={12} /> : event.status === "error" ? <AlertTriangle size={12} /> : <span className="spinner dark" />}
                  </span>
                  <div><strong>{event.title}</strong><small>{event.detail}</small></div>
                </div>
              ))}
              {agentTranscript && (
                <div className="onboarding-agent-transcript">
                  <strong>Live CMO notes</strong>
                  <p>{agentTranscript}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {error && <div className="onboarding-error"><AlertTriangle size={15} /> {error}</div>}

        {!researching && (
          <div className="onboarding-suggestions" aria-label="Example company introductions">
            <span>Try an example</span>
            <div>
              {suggestions.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => setInput(suggestion)}>
                  {suggestion} <ArrowRight size={12} />
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <footer className="onboarding-footer">
        <span><ShieldCheck size={13} /> Your workspace stays private</span>
        <span>Powered by Cursor Agent CLI</span>
      </footer>
    </main>
  );
}

function MarketResearchBanner({ research }: { research: MarketResearchStatus }) {
  const latest = research.events.at(-1);
  return (
    <section className="market-research-banner" aria-label="Live market evidence" aria-live="polite">
      <header>
        <div>
          <span className="live-dot" />
          <strong>{latest?.title ?? "Checking market evidence"}</strong>
        </div>
        <time>{research.active ? `${research.elapsed}s · working` : research.error ? "paused" : "updated"}</time>
      </header>
      <p>{latest?.detail ?? "Reviewing public company and category sources"}</p>
      {research.transcript && <small>{research.transcript}</small>}
      {research.error && (
        <div className="market-research-error">
          <AlertTriangle size={13} /> {research.error}
        </div>
      )}
    </section>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof Target;
  label: string;
  value: string;
  detail: string;
  tone: string;
}) {
  return (
    <article className="metric-card">
      <div className={`metric-icon metric-${tone}`}>
        <Icon size={18} strokeWidth={2} />
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </article>
  );
}

function WorkstreamCard({ stream }: { stream: MarketingWorkstream }) {
  const iconMap = {
    pipeline: Network,
    content: FileText,
    lifecycle: UsersRound,
    analytics: BarChart3,
  };
  const Icon = iconMap[stream.id as keyof typeof iconMap] ?? Sparkles;
  return (
    <article className="workstream-card">
      <div className="workstream-head">
        <span className={`stream-icon stream-${stream.accent}`}>
          <Icon size={17} />
        </span>
        <StatusPill tone={stream.status === "active" ? "green" : "gray"}>
          <CircleDot size={9} fill="currentColor" /> {stream.status}
        </StatusPill>
      </div>
      <h3>{stream.name}</h3>
      <p>{stream.description}</p>
      <div className="stream-progress">
        <span style={{ width: `${stream.progress}%` }} />
      </div>
      <div className="stream-footer">
        <span>{stream.nextAction}</span>
        <small>{stream.cadence}</small>
      </div>
    </article>
  );
}

function OpportunityRow({
  opportunity,
  active,
  onOpen,
}: {
  opportunity: Opportunity;
  active: boolean;
  onOpen: () => void;
}) {
  const winner = [...opportunity.paths].sort((a, b) => b.strength - a.strength)[0];
  return (
    <button className={`opportunity-row ${active ? "is-active" : ""}`} onClick={onOpen}>
      <span className="company-avatar">{opportunity.initials}</span>
      <span className="opportunity-copy">
        <span className="opportunity-title">
          <strong>{opportunity.account}</strong>
          <StatusPill tone={opportunity.fitLabel === "High fit" ? "violet" : "gray"}>
            {opportunity.fitLabel}
          </StatusPill>
          {opportunity.prospectStatus && (
            <StatusPill tone={opportunity.prospectStage === "cold" ? "gray" : "green"}>
              {opportunity.source === "linkedin_search" ? <Linkedin size={10} /> : null}
              {opportunity.prospectStatus}
            </StatusPill>
          )}
        </span>
        <span>{opportunity.signal}</span>
        <small>
          {opportunity.target} · {opportunity.targetRole} · {winner?.name} · {opportunity.signalAge}
        </small>
      </span>
      <span className="score-ring" style={{ "--score": opportunity.score.total } as React.CSSProperties}>
        {opportunity.score.total}
      </span>
      <ChevronRight size={17} className="row-chevron" />
    </button>
  );
}

function EmptyNextMove({ onRun, busy }: { onRun: () => void; busy: boolean }) {
  return (
    <div className="next-empty">
      <div className="signal-orbit">
        <span className="orbit-one" />
        <span className="orbit-two" />
        <Zap size={25} />
      </div>
      <div>
        <StatusPill tone="violet">
          <Radio size={10} /> fresh signal
        </StatusPill>
        <h2>Bluebird is showing timely buying intent</h2>
        <p>
          MadeThis CMO found a high-fit account with three warm paths. Run a heartbeat to let it
          choose the safest action and explain the tradeoff.
        </p>
        <button className="button button-primary" onClick={onRun} disabled={busy}>
          {busy ? <span className="spinner" /> : <Sparkles size={16} />}
          {busy ? "Thinking…" : "Run heartbeat"}
        </button>
      </div>
    </div>
  );
}

function ActiveNextMove({ proposal, onReview }: { proposal: Proposal; onReview: () => void }) {
  const complete = proposal.status === "executed";
  return (
    <div className="next-active">
      <div className="next-active-top">
        <div>
          <StatusPill tone={complete ? "green" : "amber"}>
            {complete ? <CheckCircle2 size={11} /> : <Clock3 size={11} />}
            {complete ? "simulated send complete" : "your decision"}
          </StatusPill>
          <h2>
            {proposal.actionType === "direct_intro" ? "Ask for an introduction" : "Share the teardown"}{" "}
            <span>via {proposal.connector.name}</span>
          </h2>
        </div>
        <span className={`relationship-cost cost-${proposal.relationshipCost.toLowerCase()}`}>
          {proposal.relationshipCost} social cost
        </span>
      </div>
      <div className="path-line">
        <Avatar name="You" />
        <span />
        <Avatar name={proposal.connector.name} warm />
        <span />
        <Avatar name={proposal.target} />
        <div className="path-names">
          <small>You</small>
          <small>{proposal.connector.name.split(" ")[0]}</small>
          <small>{proposal.target.split(" ")[0]}</small>
        </div>
      </div>
      <p className="proposal-summary">
        <strong>{proposal.account}</strong> is timely, and {proposal.connector.name} is the safest
        permissible path. MadeThis CMO selected <code>{proposal.playId}@{proposal.playVersion}</code>.
      </p>
      {proposal.changedBecause.length > 0 && (
        <div className="changed-because">
          <GitBranch size={15} />
          <span>
            <strong>Changed because</strong> {proposal.changedBecause.join(" · ")}
          </span>
        </div>
      )}
      <div className="next-actions">
        <button className="button button-primary" onClick={onReview}>
          {complete ? <History size={16} /> : <ShieldCheck size={16} />}
          {complete ? "View receipt" : "Review proposal"}
        </button>
        <div className="confidence-copy">
          <strong>{proposal.confidence}% confidence</strong>
          <span>{proposal.expectedEffect}</span>
        </div>
      </div>
    </div>
  );
}

function MeetingWon({ onRun, busy }: { onRun: () => void; busy: boolean }) {
  return (
    <div className="meeting-won">
      <span className="won-icon"><CalendarCheck size={26} /></span>
      <div>
        <StatusPill tone="green"><Sparkles size={11} /> learning captured</StatusPill>
        <h2>Maya booked a meeting. Now prove the learning.</h2>
        <p>
          The 90-day customer rule is active, and the artifact-first play has one positive result
          with a low-sample warning. Northstar is ready for the next cycle.
        </p>
        <button className="button button-primary" onClick={onRun} disabled={busy}>
          {busy ? <span className="spinner" /> : <ArrowRight size={16} />}
          Run next heartbeat
        </button>
      </div>
    </div>
  );
}

function ActivityMini({ events }: { events: ActivityEvent[] }) {
  return (
    <div className="mini-timeline">
      {[...events].reverse().slice(0, 5).map((event) => {
        const Icon = actorIcons[event.actor];
        return (
          <div className="mini-event" key={event.id}>
            <span className={`event-dot event-${event.tone ?? "neutral"}`}><Icon size={12} /></span>
            <div>
              <strong>{event.title}</strong>
              <small>{shortTime(event.timestamp)} · {event.actor}</small>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MarketingPlanDiagram({ plan }: { plan: MarketingPlan }) {
  const autoStep = plan.steps.find((step) => step.id === plan.autoExecutedStepId);

  return (
    <article className="panel plan-diagram" aria-labelledby="marketing-plan-title">
      <div className="panel-heading plan-heading">
        <div>
          <span className="section-kicker"><GitBranch size={13} /> GTM execution map</span>
          <h2 id="marketing-plan-title">{plan.title}</h2>
        </div>
        <StatusPill tone={plan.status === "completed" ? "green" : "violet"}>
          {plan.status.replaceAll("_", " ")}
        </StatusPill>
      </div>
      <div className="plan-diagram-body">
        <div className="plan-brief">
          <span>Objective</span>
          <strong>{plan.objective}</strong>
          <p>{plan.summary}</p>
        </div>
        {autoStep && (
          <div className="plan-auto-note">
            <Sparkles size={14} />
            <span><strong>Autopilot advanced priority {autoStep.priority}</strong>{autoStep.title} · internal work only</span>
          </div>
        )}
        <div className="plan-flow" role="list" aria-label="Prioritized marketing plan">
          {plan.steps.map((step, index) => (
            <div className="plan-flow-node" key={step.id} role="listitem">
              <article className={`plan-step plan-step-${step.status} ${step.id === plan.autoExecutedStepId ? "is-auto" : ""}`}>
                <div className="plan-step-top">
                  <span className="plan-priority">{String(step.priority).padStart(2, "0")}</span>
                  <span className={`plan-status plan-status-${step.status}`}>
                    {step.status === "completed" && <Check size={10} />}
                    {step.status}
                  </span>
                </div>
                <small>{step.workstream} · {step.difficulty}{step.subagent ? ` · ${step.subagent.name}` : ""}</small>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
                <footer><Target size={11} /> {step.subagent?.statusRead ?? step.expectedOutcome}</footer>
              </article>
              {index < plan.steps.length - 1 && <ArrowRight className="plan-connector" size={16} aria-hidden="true" />}
            </div>
          ))}
        </div>
        <div className="plan-choice-note">
          <MessageSquare size={13} />
          {plan.status === "awaiting_choice"
            ? "Choose a numbered priority in the CMO chat. The CMO spawns a subagent to do that one task."
            : "The diagram updates as each governed priority advances."}
        </div>
      </div>
    </article>
  );
}

function CommandCenter({
  state,
  busy,
  command,
  openProposal,
  openActivity,
  marketResearch,
}: {
  state: MadeThisState;
  busy: boolean;
  command: (command: Command) => void;
  openProposal: () => void;
  openActivity: () => void;
  marketResearch?: MarketResearchStatus;
}) {
  const activeProposal = state.proposals.find((item) => item.id === state.activeProposalId);
  const activeMarketingPlan = state.marketingPlans.find(
    (item) => item.id === state.activeMarketingPlanId,
  );
  const meetingBooked = state.outcomes.some((item) => item.type === "meeting_booked");
  const profile = state.companyProfile;
  const topOpportunities = [...state.opportunities]
    .filter((item) => item.score.total >= 65)
    .sort((a, b) => b.score.total - a.score.total)
    .slice(0, 4);
  const tasksDone = Math.min(12, state.activity.filter((event) => event.type !== "workspace.seeded").length);

  return (
    <>
      <section className="hero-row">
        <div>
          <p className="eyebrow">{profile?.industry ?? "Go-to-market"} · command center</p>
          <h1>A sharper path to market for {profile?.name ?? state.workspace}.</h1>
          <p className="hero-subtitle">
            {profile?.tagline ?? "Your CMO is watching the market and moving the best marketing work forward."}
          </p>
        </div>
        <div className="hero-actions">
          <button
            className="button button-secondary"
            onClick={() => command({ type: "toggle_pause" })}
            disabled={busy}
          >
            {state.status === "running" ? <Pause size={15} /> : <Play size={15} />}
            {state.status === "running" ? "Pause CMO" : "Resume CMO"}
          </button>
          <button
            className="button button-primary"
            onClick={() => command({ type: "run_heartbeat" })}
            disabled={busy || state.status !== "running"}
          >
            {busy ? <span className="spinner" /> : <Zap size={15} />}
            Run heartbeat
          </button>
        </div>
      </section>

      {state.lastNotice && (
        <div className={`notice notice-${state.lastNotice.tone}`}>
          {state.lastNotice.tone === "success" ? <CheckCircle2 size={16} /> : <Lightbulb size={16} />}
          <span>{state.lastNotice.message}</span>
          <small>SIMULATION</small>
        </div>
      )}

      {(marketResearch?.active || marketResearch?.error) && (
        <MarketResearchBanner research={marketResearch} />
      )}

      {state.mode === "autopilot" && (
        <section className="autopilot-disclosure" aria-label="Active Autopilot authority">
          <span className="autopilot-shield"><ShieldCheck size={17} /></span>
          <div>
            <strong>Autopilot is narrowly scoped</strong>
            <p>
              Simulator only · permission-first artifact shares · former colleagues · low social
              cost · {state.sentToday}/{state.trustGrant.dailyCap} actions used today
            </p>
          </div>
          <StatusPill tone="green"><LockKeyhole size={10} /> grant active</StatusPill>
        </section>
      )}

      {activeMarketingPlan && <MarketingPlanDiagram plan={activeMarketingPlan} />}

      {profile && (
        <section className="company-brief-bar" aria-label="Company research brief">
          <div>
            <span>Ideal customer</span>
            <strong>{profile.audience}</strong>
          </div>
          <div>
            <span>Business model</span>
            <strong>{profile.businessModel}</strong>
          </div>
          <div>
            <span>Market read</span>
            <strong>{profile.marketSignals[0]}</strong>
          </div>
          {profile.website && (
            <a href={profile.website} target="_blank" rel="noreferrer">
              <Globe2 size={14} /> Source site
            </a>
          )}
        </section>
      )}

      <section className="metrics-grid">
        <MetricCard
          icon={Target}
          label="Qualified pipeline"
          value={meetingBooked ? "$48k" : "$32k"}
          detail={meetingBooked ? "+$16k influenced" : "4 high-intent accounts"}
          tone="violet"
        />
        <MetricCard
          icon={Gauge}
          label="Relationship capital"
          value="87%"
          detail="Healthy · 1 path protected"
          tone="green"
        />
        <MetricCard
          icon={CheckCircle2}
          label="Work advanced"
          value={`${tasksDone}`}
          detail="Across 4 workstreams"
          tone="orange"
        />
        <MetricCard
          icon={CalendarCheck}
          label="Meetings influenced"
          value={meetingBooked ? "1" : "0"}
          detail={meetingBooked ? "From a warm share" : "Learning loop ready"}
          tone="blue"
        />
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-main">
          <article className="panel next-panel">
            <div className="panel-heading">
              <div>
                <span className="section-kicker"><Sparkles size={13} /> CMO recommendation</span>
                <h2>Next best move</h2>
              </div>
              <button className="icon-button" aria-label="More options"><MoreHorizontal size={18} /></button>
            </div>
            {state.phase === "ready" && (
              <EmptyNextMove onRun={() => command({ type: "run_heartbeat" })} busy={busy} />
            )}
            {state.phase === "outcome_recorded" && <MeetingWon onRun={() => command({ type: "run_heartbeat" })} busy={busy} />}
            {activeProposal && state.phase !== "outcome_recorded" && (
              <ActiveNextMove proposal={activeProposal} onReview={openProposal} />
            )}
          </article>

          <div className="section-heading-row">
            <div>
              <span className="section-kicker">Always-on coverage</span>
              <h2>Your marketing engine</h2>
            </div>
            <span className="section-note"><Radio size={12} /> 4 workstreams monitored</span>
          </div>
          <section className="workstreams-grid">
            {state.workstreams.map((stream) => <WorkstreamCard key={stream.id} stream={stream} />)}
          </section>
        </div>

        <aside className="dashboard-aside">
          <article className="panel queue-panel">
            <div className="panel-heading compact">
              <div>
                <span className="section-kicker">
                  {state.opportunities.some((item) => item.source === "linkedin_search")
                    ? "LinkedIn prospect status"
                    : "Live opportunity scan"}
                </span>
                <h2>Priority accounts</h2>
              </div>
              <StatusPill tone="gray">{state.opportunities.length} tracked</StatusPill>
            </div>
            <div className="opportunity-list">
              {topOpportunities.map((opportunity) => (
                <OpportunityRow
                  key={opportunity.id}
                  opportunity={opportunity}
                  active={opportunity.id === state.activeOpportunityId}
                  onOpen={openProposal}
                />
              ))}
            </div>
          </article>

          <article className="panel pulse-panel">
            <div className="panel-heading compact">
              <div>
                <span className="section-kicker">Decision ledger</span>
                <h2>Recent activity</h2>
              </div>
              <button className="text-button" onClick={openActivity}>View all <ChevronRight size={14} /></button>
            </div>
            <ActivityMini events={state.activity} />
          </article>

          <article className="cmo-note">
            <span><Lightbulb size={16} /></span>
            <div>
              <strong>CMO lens</strong>
              <p>
                The strongest path is not always the right path. I’m optimizing for durable growth,
                not activity volume.
              </p>
            </div>
          </article>
        </aside>
      </section>
    </>
  );
}

function Playbook({ state, busy, command }: { state: MadeThisState; busy: boolean; command: (command: Command) => void }) {
  return (
    <section className="surface-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Memory you can govern</p>
          <h1>Marketing playbook</h1>
          <p>Every rule is attributable. Every inferred change waits for you. Every version can be reversed.</p>
        </div>
        <StatusPill tone="green"><ShieldCheck size={12} /> policy perimeter active</StatusPill>
      </div>

      <div className="playbook-layout">
        <div className="playbook-main">
          <article className="panel playbook-section">
            <div className="panel-heading compact">
              <div>
                <span className="section-kicker">Deterministic guardrails</span>
                <h2>Active policies</h2>
              </div>
              <span className="count-badge">{state.rules.filter((rule) => rule.status === "active").length}</span>
            </div>
            {state.rules.length === 0 ? (
              <div className="empty-memory">
                <ShieldCheck size={23} />
                <div><strong>No learned policies yet</strong><p>Reject a proposal with a clear directive to teach the CMO.</p></div>
              </div>
            ) : (
              <div className="memory-list">
                {state.rules.map((rule) => (
                  <div className="memory-row" key={rule.id}>
                    <span className="memory-icon"><LockKeyhole size={16} /></span>
                    <div>
                      <div className="memory-title">
                        <strong>{rule.text}</strong>
                        <StatusPill tone={rule.status === "active" ? "green" : "gray"}>{rule.status}</StatusPill>
                      </div>
                      <p>Scope: all {rule.relationshipType.replace("_", " ")} connectors · user-owned</p>
                      <small>{rule.id}@{rule.version} · {rule.provenance}</small>
                      {rule.lastEffect && <span className="effect-line"><GitBranch size={12} /> Last effect: {rule.lastEffect}</span>}
                    </div>
                    <button
                      className="button button-small"
                      disabled={busy}
                      onClick={() => command({
                        type: rule.status === "active" ? "disable_rule" : "enable_rule",
                        ruleId: rule.id,
                      })}
                    >
                      {rule.status === "active" ? "Disable" : "Restore"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="panel playbook-section">
            <div className="panel-heading compact">
              <div>
                <span className="section-kicker">Typed procedural memory</span>
                <h2>GTM plays</h2>
              </div>
              <span className="count-badge">{state.plays.length}</span>
            </div>
            <div className="play-cards">
              {state.plays.map((play) => (
                <div className="play-card" key={play.id}>
                  <div className="play-card-head">
                    <span className="play-icon"><BookOpenCheck size={17} /></span>
                    <div><strong>{play.name}</strong><small>{play.id}@{play.version}</small></div>
                    <StatusPill tone="violet">{play.relationshipCost} cost</StatusPill>
                  </div>
                  <p>{play.description}</p>
                  <div className="play-stats">
                    <span><strong>{play.usageCount}</strong> uses</span>
                    <span><strong>{play.winCount}</strong> meetings</span>
                    <span><strong>{play.winCount ? "Low sample" : "No data"}</strong> confidence</span>
                  </div>
                  {play.previousVersion && (
                    <button className="text-button" disabled={busy} onClick={() => command({ type: "rollback_play", playId: play.id })}>
                      <History size={13} /> Roll back to v{play.previousVersion}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </article>

          <article className="panel playbook-section">
            <div className="panel-heading compact">
              <div>
                <span className="section-kicker">Agent inference · never auto-activated</span>
                <h2>Pending changes</h2>
              </div>
              <span className="count-badge attention">{state.pendingChanges.filter((item) => item.status === "pending").length}</span>
            </div>
            {state.pendingChanges.length === 0 ? (
              <div className="empty-memory"><Sparkles size={23} /><div><strong>No strategy changes waiting</strong><p>Outcome-derived suggestions will appear here as semantic diffs.</p></div></div>
            ) : state.pendingChanges.map((change) => (
              <div className="change-card" key={change.id}>
                <div className="change-header">
                  <div><StatusPill tone={change.status === "pending" ? "amber" : "green"}>{change.status}</StatusPill><h3>{change.title}</h3></div>
                  <small>{change.id} · base {change.targetPlayId}@{change.baseVersion}</small>
                </div>
                <p>{change.rationale}</p>
                <div className="semantic-diff">
                  <div><span>BEFORE</span><p>{change.before}</p></div>
                  <ArrowRight size={16} />
                  <div><span>AFTER</span><p>{change.after}</p></div>
                </div>
                <div className="change-footer">
                  <small><Lightbulb size={12} /> Expected: {change.expectedEffect}</small>
                  {change.status === "pending" && (
                    <div>
                      <button className="button button-small" disabled={busy} onClick={() => command({ type: "decide_change", changeId: change.id, decision: "rejected" })}>Reject</button>
                      <button className="button button-small button-dark" disabled={busy} onClick={() => command({ type: "decide_change", changeId: change.id, decision: "approved" })}><Check size={13} /> Approve v2</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </article>
        </div>

        <aside className="playbook-aside">
          <article className="panel grant-card">
            <div className="grant-icon"><ShieldCheck size={20} /></div>
            <span className="section-kicker">Autopilot authority</span>
            <h2>Narrow sandbox grant</h2>
            <p>MadeThis CMO can act alone only when every field below matches.</p>
            <dl>
              <div><dt>Adapter</dt><dd>Simulator only</dd></div>
              <div><dt>Action</dt><dd>Artifact share</dd></div>
              <div><dt>Audience</dt><dd>Former colleagues</dd></div>
              <div><dt>Social cost</dt><dd>Low only</dd></div>
              <div><dt>Daily cap</dt><dd>{state.trustGrant.dailyCap} sends</dd></div>
              <div><dt>Quiet hours</dt><dd>{state.trustGrant.quietHours}</dd></div>
            </dl>
            <div className="grant-footer"><span className="live-dot" /> Active · revocable</div>
          </article>
          <article className="trust-note"><LockKeyhole size={17} /><p><strong>Code owns authority.</strong> The model can recommend and draft. It cannot approve itself, broaden a grant, or bypass a policy.</p></article>
        </aside>
      </div>
    </section>
  );
}

function ActivityTrail({ state }: { state: MadeThisState }) {
  return (
    <section className="surface-page">
      <div className="page-heading">
        <div><p className="eyebrow">Reconstruct every decision</p><h1>Activity trail</h1><p>Evidence, authority, actions, outcomes, and learning share one durable timeline.</p></div>
        <div className="activity-stats"><span><strong>{state.activity.length}</strong> events</span><span><strong>{state.heartbeatRuns.length}</strong> runs</span><span><strong>{state.executions.length}</strong> receipts</span></div>
      </div>
      <div className="activity-layout">
        <article className="panel full-timeline">
          {[...state.activity].reverse().map((event, index) => {
            const Icon = actorIcons[event.actor];
            return (
              <div className="timeline-event" key={event.id}>
                <div className="timeline-rail"><span className={`event-dot event-${event.tone ?? "neutral"}`}><Icon size={14} /></span>{index < state.activity.length - 1 && <i />}</div>
                <div className="timeline-content">
                  <div><strong>{event.title}</strong><time>{shortTime(event.timestamp)}</time></div>
                  <p>{event.detail}</p>
                  <small>{event.id} · {event.actor} · {event.mode}{event.correlationId ? ` · ${event.correlationId}` : ""}</small>
                </div>
              </div>
            );
          })}
        </article>
        <aside>
          <article className="panel audit-card"><span className="audit-icon"><ShieldCheck size={21} /></span><h2>Audit integrity</h2><p>Every simulated action is linked to a heartbeat, proposal, authority decision, canonical payload hash, and execution receipt.</p><ul><li><Check size={13} /> Append-only event sequence</li><li><Check size={13} /> Exact payload approval</li><li><Check size={13} /> Correlated pre/post gates</li><li><Check size={13} /> Synthetic outcomes labeled</li></ul></article>
          <article className="panel runs-card"><span className="section-kicker">Heartbeat ledger</span><h2>Recent runs</h2>{state.heartbeatRuns.length === 0 ? <p>No heartbeat has run yet.</p> : [...state.heartbeatRuns].reverse().map((run) => <div className="run-row" key={run.id}><span><strong>{run.id}</strong><small>{run.contextHash.slice(0, 10)}…</small></span><StatusPill tone={run.status === "completed" ? "green" : "amber"}>{run.status}</StatusPill></div>)}</article>
        </aside>
      </div>
    </section>
  );
}

type ChatMessage = {
  id: string;
  role: "agent" | "user";
  content: string;
  receipt?: string;
  planId?: string;
  tone?: "normal" | "error";
};

type ChatApiResponse = {
  reply: string;
  requestedAction: string;
  actionReceipt?: string;
  marketingPlan?: MarketingPlan;
  state: MadeThisState;
  engine: "cursor-cli";
};

function ChatPlanFeedback({
  plan,
  executingStepId,
  thinking,
  onExecute,
}: {
  plan: MarketingPlan;
  executingStepId?: string;
  thinking: boolean;
  onExecute: (plan: MarketingPlan, step: MarketingPlanStep) => void;
}) {
  return (
    <section className="chat-plan-feedback" aria-label={`${plan.id} execution choices`}>
      <div>
        <strong>{plan.steps.length} ranked priorities</strong>
        <small>{plan.feedbackQuestion}</small>
      </div>
      <div className="chat-plan-actions">
        {plan.steps.map((step) => (
          <button
            key={step.id}
            type="button"
            className={step.status === "completed" ? "is-complete" : ""}
            disabled={step.status === "completed" || Boolean(executingStepId) || thinking}
            onClick={() => onExecute(plan, step)}
            aria-label={`Execute priority ${step.priority}: ${step.title}`}
          >
            <span>{step.status === "completed" ? <Check size={11} /> : String(step.priority).padStart(2, "0")}</span>
            <span><strong>{step.title}</strong><small>{step.workstream} · {step.difficulty}{executingStepId === step.id ? " · spawning subagent" : ""}</small></span>
            {executingStepId === step.id ? <span className="spinner dark" /> : <ChevronRight size={13} />}
          </button>
        ))}
      </div>
    </section>
  );
}

function ChatRail({
  state,
  open,
  close,
  onStateChange,
  marketResearch,
}: {
  state: MadeThisState;
  open: boolean;
  close: () => void;
  onStateChange: (state: MadeThisState) => void;
  marketResearch?: MarketResearchStatus;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const profile = state.companyProfile;
    if (!profile) return [];
    return [
      {
        id: "company-introduction",
        role: "user",
        content: profile.originalBrief,
      },
      {
        id: "welcome",
        role: "agent",
        content: marketResearch?.active
          ? `I’ve opened the ${profile.name} workspace from your brief. I’m still checking market evidence and will update the plan. Priority 1 is finding prospect clients; I can spawn a subagent to do that task.`
          : `I’ve mapped ${profile.name} in ${profile.category}. The first plan is on the canvas now. Priority 1 is finding prospect clients; I can spawn a subagent to do that task.`,
        planId: state.activeMarketingPlanId,
      },
    ];
  });
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [executingStepId, setExecutingStepId] = useState<string>();
  const [connection, setConnection] = useState<"ready" | "working" | "error">("ready");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const latestResearch = marketResearch?.events.at(-1);
  const agentWorking = Boolean(thinking || executingStepId || marketResearch?.active);
  const workingLabel = thinking
    ? "Answering your message"
    : executingStepId
      ? "Spawning a subagent for this priority"
      : latestResearch
        ? `${latestResearch.title}${latestResearch.detail ? ` · ${latestResearch.detail}` : ""}`
        : "Checking market evidence";
  const connectionStatus = connection === "error" && !agentWorking ? "error" : agentWorking ? "working" : "ready";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, thinking, executingStepId, state.activeMarketingPlanId, marketResearch?.transcript, agentWorking, workingLabel]);

  useEffect(() => {
    const reply = marketResearch?.completedReply;
    if (!reply || marketResearch?.active) return;
    setMessages((current) => {
      if (current.some((message) => message.id === "market-evidence")) return current;
      return [
        ...current,
        {
          id: "market-evidence",
          role: "agent",
          content: reply,
          planId: state.activeMarketingPlanId,
        },
      ];
    });
  }, [marketResearch?.active, marketResearch?.completedReply, state.activeMarketingPlanId]);

  async function sendMessage(prefilled?: string) {
    const content = (prefilled ?? input).trim();
    if (!content || thinking) return;
    const history = messages.slice(-12).map(({ role, content: previousContent }) => ({
      role,
      content: previousContent,
    }));
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content },
    ]);
    setInput("");
    setThinking(true);
    setConnection("working");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, history }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Cursor Agent CLI could not answer");
      const result = body as ChatApiResponse;
      onStateChange(result.state);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "agent",
          content: result.reply,
          receipt: result.actionReceipt,
          planId: result.marketingPlan?.id,
        },
      ]);
      setConnection("ready");
    } catch (caught) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "agent",
          content:
            caught instanceof Error
              ? caught.message
              : "I couldn’t reach the Cursor Agent CLI runtime. Please try again.",
          tone: "error",
        },
      ]);
      setConnection("error");
    } finally {
      setThinking(false);
    }
  }

  async function executePriority(plan: MarketingPlan, step: MarketingPlanStep) {
    if (thinking || executingStepId) return;
    setExecutingStepId(step.id);
    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: `Execute priority ${step.priority}: ${step.title}.`,
      },
    ]);
    try {
      const response = await fetch("/api/plan-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, stepId: step.id }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "The plan priority could not be executed.");
      const nextState = body.state as MadeThisState;
      onStateChange(nextState);
      const nextPlan = nextState.marketingPlans.find((item) => item.id === plan.id);
      const nextStep = nextPlan?.steps.find((item) => item.id === step.id);
      const subagentLine = nextStep?.subagent
        ? ` I spawned the ${nextStep.subagent.name} subagent to do this task.`
        : "";
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "agent",
          content:
            nextStep?.status === "completed"
              ? `Priority ${step.priority} is complete.${subagentLine} I updated the execution map and the ${step.workstream} workstream.`
              : `Priority ${step.priority} is ${nextStep?.status ?? "not available"}. ${nextStep?.executionNote ?? "Review the dashboard notice before retrying."}`,
          receipt: nextStep?.executionNote,
        },
      ]);
    } catch (caught) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "agent",
          content: caught instanceof Error ? caught.message : "The plan priority could not be executed.",
          tone: "error",
        },
      ]);
    } finally {
      setExecutingStepId(undefined);
    }
  }

  const activeProposal = state.proposals.find((item) => item.id === state.activeProposalId);
  const activeOpportunity = state.opportunities.find((item) => item.id === state.activeOpportunityId);
  const activeMarketingPlan = state.marketingPlans.find(
    (item) => item.id === state.activeMarketingPlanId,
  );

  return (
    <aside className={`chat-rail ${open ? "chat-rail-open" : ""}`} aria-label="MadeThis CMO conversation">
      <header className="chat-header">
        <div className={`chat-agent-avatar ${agentWorking ? "is-working" : ""}`}><BrandMark /></div>
        <div>
          <strong>MadeThis CMO</strong>
          <span className={`chat-connection chat-connection-${connectionStatus}`}>
            <i />
            {connectionStatus === "working"
              ? `CMO is working${marketResearch?.active ? ` · ${marketResearch.elapsed}s` : ""}`
              : connectionStatus === "error"
                ? "Cursor CLI · error"
                : "Cursor CLI · ready"}
          </span>
        </div>
        <button className="chat-mobile-close" aria-label="Close conversation" onClick={close}><X size={18} /></button>
      </header>

      <section className="chat-context" aria-label="Current agent context">
        <span className="chat-context-label">Current focus</span>
        <div>
          <span className="company-avatar">{activeMarketingPlan ? "MP" : activeOpportunity?.initials ?? "BC"}</span>
          <p>
            <strong>{activeMarketingPlan?.title ?? activeOpportunity?.account ?? "Bluebird"}</strong>
            <small>{activeMarketingPlan ? `${activeMarketingPlan.id} · ${activeMarketingPlan.status.replaceAll("_", " ")}` : activeProposal ? `${activeProposal.id} · ${activeProposal.status.replaceAll("_", " ")}` : "Signal ready for review"}</small>
          </p>
          <span className="chat-score">{activeMarketingPlan?.steps.length ?? activeOpportunity?.score.total ?? 87}</span>
        </div>
      </section>

      <div className="chat-messages" aria-live="polite">
        {messages.map((message) => {
          const messagePlan = message.planId
            ? state.marketingPlans.find((item) => item.id === message.planId)
            : undefined;
          return (
            <div className={`chat-message chat-message-${message.role} ${message.tone === "error" ? "chat-message-error" : ""}`} key={message.id}>
              {message.role === "agent" && <span className="message-agent-mark"><Sparkles size={13} /></span>}
              <div>
                <span>{message.role === "agent" ? "CMO" : "You"}</span>
                <p>{message.content}</p>
                {message.receipt && <small className="chat-action-receipt"><ShieldCheck size={11} /> {message.receipt}</small>}
                {messagePlan && <ChatPlanFeedback plan={messagePlan} executingStepId={executingStepId} thinking={thinking} onExecute={executePriority} />}
              </div>
            </div>
          );
        })}
        {activeMarketingPlan && !messages.some((message) => message.planId === activeMarketingPlan.id) && (
          <div className="chat-message chat-message-agent">
            <span className="message-agent-mark"><Sparkles size={13} /></span>
            <div>
              <span>CMO · active plan</span>
              <p>
                {activeMarketingPlan.autoExecutedStepId
                  ? "Autopilot completed the highest-ranked easy internal priority. Choose another priority when you’re ready."
                  : "Your ranked marketing plan is ready. Choose the priority you want me to execute."}
              </p>
              <ChatPlanFeedback plan={activeMarketingPlan} executingStepId={executingStepId} thinking={thinking} onExecute={executePriority} />
            </div>
          </div>
        )}
        {thinking && <div className="chat-message chat-message-agent"><span className="message-agent-mark"><Sparkles size={13} /></span><div><span>CMO</span><p className="typing-dots"><i /><i /><i /></p></div></div>}
        {marketResearch?.active && !thinking && (
          <div className="chat-message chat-message-agent">
            <span className="message-agent-mark"><Sparkles size={13} /></span>
            <div>
              <span>CMO · still working</span>
              <p>{workingLabel}</p>
              {marketResearch.transcript && <small className="chat-action-receipt">{marketResearch.transcript}</small>}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-prompts" aria-label="Suggested prompts">
        {["Build a marketing plan", "What should we do next?", "Explain this recommendation"].map((prompt) => (
          <button key={prompt} onClick={() => sendMessage(prompt)} disabled={thinking}>{prompt}</button>
        ))}
      </div>

      {agentWorking && (
        <div className="chat-working" role="status" aria-live="polite">
          <span className="spinner dark" />
          <div>
            <strong>CMO is still working</strong>
            <small>{workingLabel}</small>
          </div>
          <span className="typing-dots" aria-hidden="true"><i /><i /><i /></span>
        </div>
      )}

      <form className={`chat-composer ${agentWorking ? "is-working" : ""}`} onSubmit={(event) => { event.preventDefault(); sendMessage(); }}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              sendMessage();
            }
          }}
          placeholder={agentWorking ? "You can still message the CMO while it works..." : "Tell your CMO what to do..."}
          aria-label="Message MadeThis CMO"
          rows={3}
        />
        <div>
          <span>
            {agentWorking ? (
              <><span className="live-dot" /> CMO is still working</>
            ) : (
              <><Sparkles size={11} /> Cursor has your company context</>
            )}
          </span>
          <button type="submit" className="composer-send" aria-label="Send message" disabled={!input.trim() || thinking}><ArrowRight size={16} /></button>
        </div>
      </form>
      <footer className="chat-footer"><ShieldCheck size={12} /> Actions still pass policy and approval gates</footer>
    </aside>
  );
}

function ProposalDrawer({
  proposal,
  state,
  busy,
  close,
  command,
}: {
  proposal: Proposal;
  state: MadeThisState;
  busy: boolean;
  close: () => void;
  command: (command: Command) => void;
}) {
  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [decision, setDecision] = useState<"none" | "reject" | "edit">("none");
  const [rationale, setRationale] = useState(
    "Jordan made an intro three weeks ago. Never ask a customer for another intro within 90 days.",
  );
  const [editedMessage, setEditedMessage] = useState(proposal.message);
  const opportunity = state.opportunities.find((item) => item.id === proposal.opportunityId)!;
  const executed = proposal.status === "executed";

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const background = Array.from(document.querySelectorAll<HTMLElement>(".main-shell, .sidebar"));
    const previousOverflow = document.body.style.overflow;
    background.forEach((element) => element.setAttribute("inert", ""));
    document.body.style.overflow = "hidden";
    const focusFrame = requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => {
      cancelAnimationFrame(focusFrame);
      background.forEach((element) => element.removeAttribute("inert"));
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  function containFocus(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      drawerRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter((element) => element.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="drawer-backdrop" role="dialog" aria-modal="true" aria-label={`Proposal ${proposal.id}`}>
      <button className="drawer-scrim" tabIndex={-1} onClick={close} aria-label="Close proposal" />
      <aside className="proposal-drawer" ref={drawerRef} onKeyDown={containFocus}>
        <header className="drawer-header">
          <div><span className="section-kicker">Proposal receipt · {proposal.id}</span><h2>{proposal.account} via {proposal.connector.name}</h2></div>
          <div><StatusPill tone="amber"><Radio size={10} /> simulation</StatusPill><button className="icon-button" ref={closeButtonRef} onClick={close} aria-label="Close proposal receipt"><X size={18} /></button></div>
        </header>
        <div className="drawer-body">
          <section className="receipt-hero">
            <div className="receipt-path"><Avatar name={proposal.connector.name} warm /><span><small>ASK</small><strong>{proposal.connector.name}</strong><em>{proposal.connector.role}</em></span><ArrowRight size={19} /><Avatar name={proposal.target} /><span><small>TARGET</small><strong>{proposal.target}</strong><em>{opportunity.targetRole}, {proposal.account}</em></span></div>
            <div className="receipt-badges"><StatusPill tone={proposal.relationshipCost === "Low" ? "green" : "amber"}>{proposal.relationshipCost} social cost</StatusPill><StatusPill tone="gray">{proposal.confidence}% confidence</StatusPill><StatusPill tone={executed ? "green" : "violet"}>{proposal.status.replace("_", " ")}</StatusPill></div>
          </section>

          {proposal.changedBecause.length > 0 && <section className="reason-panel"><GitBranch size={17} /><div><strong>Changed because</strong>{proposal.changedBecause.map((reason) => <p key={reason}>{reason}</p>)}</div></section>}

          <section className="receipt-section"><div className="receipt-title"><span>01</span><div><strong>Why now, why this path</strong><p>Decision evidence, not hidden reasoning</p></div></div><p className="receipt-explanation">{opportunity.signal}. {proposal.connector.name} is the highest-strength eligible path after applying relationship recency and active policy.</p><div className="evidence-grid">{proposal.evidence.map((item) => <div className="evidence-card" key={item.id}><span>{item.id}</span><strong>{item.label}</strong><p>{item.detail}</p><small>{item.source}</small></div>)}</div></section>

          <section className="receipt-section"><div className="receipt-title"><span>02</span><div><strong>Exact outbound payload</strong><p>Any edit creates a new hash and needs approval</p></div></div><div className="message-preview"><div><span>TO</span><strong>{proposal.connector.name} · {proposal.channel}</strong></div><div><span>SUBJECT</span><strong>{proposal.subject}</strong></div><p>{proposal.message}</p><footer><LockKeyhole size={12} /> payload {proposal.payloadHash.slice(0, 12)}…</footer></div>{proposal.editDiff && <div className="edit-notice"><PencilLine size={14} /> Payload edited. Previous approval is invalid; the revised hash must be approved.</div>}</section>

          <section className="receipt-section"><div className="receipt-title"><span>03</span><div><strong>Score and alternatives</strong><p>Transparent configuration-owned weights</p></div></div><div className="score-bars">{(["fit", "signal", "relationship", "learned", "freshness"] as const).map((key) => <div key={key}><span>{key}</span><i><b style={{ width: `${opportunity.score[key]}%` }} /></i><strong>{opportunity.score[key]}</strong></div>)}</div><div className="alternatives"><strong>Alternatives considered</strong>{proposal.alternatives.map((alternative) => <p key={alternative}><ChevronRight size={13} /> {alternative}</p>)}</div></section>

          <section className="receipt-section"><div className="receipt-title"><span>04</span><div><strong>Authority and guardrails</strong><p>Checked again immediately before execution</p></div></div><div className="guardrail-grid"><span><Check size={13} /> Simulator only</span><span><Check size={13} /> Evidence sourced</span><span><Check size={13} /> Daily cap {state.sentToday}/{state.dailyCap}</span><span><Check size={13} /> Proposal unexpired</span><span><Check size={13} /> No private signal in copy</span><span><Check size={13} /> Payload hash locked</span></div><p className="uncertainty"><AlertTriangle size={14} /> {proposal.uncertainty}</p></section>
        </div>

        <footer className="drawer-footer">
          {decision === "reject" && (
            <div className="decision-editor"><label htmlFor="rejection">Teach MadeThis CMO what was wrong</label><textarea id="rejection" value={rationale} onChange={(event) => setRationale(event.target.value)} /><div><button className="button button-secondary" onClick={() => setDecision("none")}>Cancel</button><button className="button button-danger" disabled={busy || !rationale.trim()} onClick={() => command({ type: "reject", proposalId: proposal.id, rationale })}>Reject & apply rule</button></div></div>
          )}
          {decision === "edit" && (
            <div className="decision-editor"><label htmlFor="message-edit">Edit the exact message</label><textarea id="message-edit" value={editedMessage} onChange={(event) => setEditedMessage(event.target.value)} /><div><button className="button button-secondary" onClick={() => setDecision("none")}>Cancel</button><button className="button button-dark" disabled={busy || !editedMessage.trim()} onClick={() => command({ type: "edit", proposalId: proposal.id, message: editedMessage })}>Save revised payload</button></div></div>
          )}
          {decision === "none" && !executed && proposal.status === "pending_approval" && (
            <><div className="secondary-decisions"><button className="button button-quiet" disabled={busy} onClick={() => command({ type: "snooze", proposalId: proposal.id })}><Clock3 size={15} /> Snooze</button><button className="button button-quiet" disabled={busy} onClick={() => setDecision("edit")}><PencilLine size={15} /> Edit</button><button className="button button-quiet danger-text" disabled={busy} onClick={() => setDecision("reject")}><X size={15} /> Reject</button></div><button className="button button-primary approve-button" disabled={busy} onClick={() => command({ type: "approve_execute", proposalId: proposal.id })}>{busy ? <span className="spinner" /> : <Send size={16} />} Approve & simulate send</button></>
          )}
          {executed && <div className="executed-footer"><CheckCircle2 size={18} /><span><strong>Execution complete</strong> No live message was sent. The correlated simulator receipt is in Activity.</span>{proposal.opportunityId === "opp-bluebird" && proposal.playId === "permission_first_artifact_share" && !state.outcomes.length && <button className="button button-primary" disabled={busy} onClick={() => command({ type: "inject_positive_outcome" })}><Sparkles size={15} /> Simulate positive outcome</button>}</div>}
        </footer>
      </aside>
    </div>
  );
}

function LoadingState() {
  return <div className="loading-screen"><BrandMark /><strong>MadeThis CMO</strong><span className="spinner dark" /></div>;
}

export default function Home() {
  const [state, setState] = useState<MadeThisState>();
  const [nav, setNav] = useState<Nav>("command");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [marketResearch, setMarketResearch] = useState<MarketResearchStatus>({
    active: false,
    elapsed: 0,
    events: [],
    transcript: "",
  });
  const onboardAbort = useRef<AbortController | undefined>(undefined);
  const pendingWorkspace = useRef<MadeThisState | undefined>(undefined);
  const onboardHoldElapsed = useRef(false);
  const onboardHoldTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function clearOnboardHold() {
    if (onboardHoldTimer.current) window.clearTimeout(onboardHoldTimer.current);
    onboardHoldTimer.current = undefined;
    onboardHoldElapsed.current = false;
    pendingWorkspace.current = undefined;
  }

  function revealWorkspace(next: MadeThisState) {
    pendingWorkspace.current = next;
    if (onboardHoldElapsed.current) setState(next);
  }

  useEffect(() => {
    fetch("/api/state", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load the workspace");
        return response.json() as Promise<MadeThisState>;
      })
      .then(setState)
      .catch((caught: Error) => setError(caught.message));
  }, []);

  useEffect(() => {
    if (!marketResearch.active) return;
    const timer = window.setInterval(() => {
      setMarketResearch((current) => ({ ...current, elapsed: current.elapsed + 1 }));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [marketResearch.active]);

  const activeProposal = useMemo(
    () => state?.proposals.find((item) => item.id === state.activeProposalId),
    [state],
  );

  async function startOnboard(message: string) {
    onboardAbort.current?.abort();
    clearOnboardHold();
    const controller = new AbortController();
    onboardAbort.current = controller;
    setError(undefined);
    setMarketResearch({ active: true, elapsed: 0, events: [], transcript: "" });
    onboardHoldTimer.current = window.setTimeout(() => {
      onboardHoldElapsed.current = true;
      if (pendingWorkspace.current) setState(pendingWorkspace.current);
    }, ONBOARD_HOLD_MS);
    let openedWorkspace = false;
    try {
      const response = await fetch("/api/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error ?? "I couldn’t research that company yet.");
      }
      if (!response.body) throw new Error("The research stream did not start.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finishedResearch = false;

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as
            | ({ type: "progress" } & Omit<OnboardingProgress, "status">)
            | { type: "transcript"; text: string }
            | OnboardingApiResponse
            | { type: "error"; message: string }
            | { type: "research_error"; message: string };
          if (event.type === "progress") {
            setMarketResearch((current) => ({
              ...current,
              events: upsertProgress(current.events, event),
            }));
          } else if (event.type === "transcript") {
            setMarketResearch((current) => ({ ...current, transcript: event.text }));
          } else if (event.type === "error") {
            throw new Error(event.message);
          } else if (event.type === "research_error") {
            setMarketResearch((current) => ({
              ...current,
              active: false,
              error: event.message,
              events: current.events.map((item, index) => ({
                ...item,
                status: index === current.events.length - 1 ? ("error" as const) : item.status,
              })),
            }));
            return;
          } else if (event.type === "workspace" || event.type === "result") {
            openedWorkspace = true;
            revealWorkspace(event.state);
            if (event.type === "result") {
              finishedResearch = true;
              setMarketResearch((current) => ({
                ...current,
                active: false,
                completedReply: event.reply,
                events: current.events.map((item) => ({ ...item, status: "complete" as const })),
              }));
            }
          }
        }
        if (done) break;
      }
      if (!openedWorkspace) throw new Error("The research stream ended before the company workspace was ready.");
      if (!finishedResearch) {
        setMarketResearch((current) => ({
          ...current,
          active: false,
          error: current.error ?? "Market evidence stopped before the plan was updated.",
        }));
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      const message = caught instanceof Error ? caught.message : "I couldn’t research that company yet.";
      setMarketResearch((current) => ({
        ...current,
        active: false,
        error: message,
        events: current.events.map((item, index) => ({
          ...item,
          status: index === current.events.length - 1 ? ("error" as const) : "complete" as const,
        })),
      }));
      if (!openedWorkspace) setError(message);
    }
  }

  async function command(nextCommand: Command): Promise<MadeThisState | undefined> {
    if (nextCommand.type === "new_user" || nextCommand.type === "reset") {
      onboardAbort.current?.abort();
      clearOnboardHold();
      setMarketResearch({ active: false, elapsed: 0, events: [], transcript: "" });
    }
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextCommand),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Command failed");
      const nextState = body as MadeThisState;
      setState(nextState);
      if (nextCommand.type === "run_heartbeat") setDrawerOpen(true);
      if (nextCommand.type === "reset" || nextCommand.type === "new_user") {
        setDrawerOpen(false);
        setNav("command");
        setChatOpen(false);
      }
      return nextState;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
    return undefined;
  }

  if (!state) return <LoadingState />;
  if (!state.companyProfile) {
    return (
      <Onboarding
        researching={marketResearch.active}
        elapsed={marketResearch.elapsed}
        agentEvents={marketResearch.events}
        agentTranscript={marketResearch.transcript}
        error={marketResearch.error ?? error}
        onSubmit={startOnboard}
      />
    );
  }

  const companyInitials = initials(state.companyProfile.name).slice(0, 2);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand"><BrandMark /><div><strong>MadeThis</strong><span>CMO</span></div><button className="mobile-close" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}><X size={18} /></button></div>
        <div className="workspace-chip"><span>{companyInitials}</span><div><strong>{state.companyProfile.name}</strong><small>{state.companyProfile.category}</small></div><ChevronRight size={14} /></div>
        <nav>
          <span className="nav-label">Operate</span>
          <button className={nav === "command" ? "active" : ""} onClick={() => { setNav("command"); setSidebarOpen(false); }}><LayoutDashboard size={17} /> Command center</button>
          <button className={nav === "playbook" ? "active" : ""} onClick={() => { setNav("playbook"); setSidebarOpen(false); }}><BookOpenCheck size={17} /> Playbook{state.pendingChanges.some((item) => item.status === "pending") && <i>{state.pendingChanges.filter((item) => item.status === "pending").length}</i>}</button>
          <button className={nav === "activity" ? "active" : ""} onClick={() => { setNav("activity"); setSidebarOpen(false); }}><Activity size={17} /> Activity</button>
          <span className="nav-label nav-spaced">Marketing OS</span>
          <button onClick={() => setNav("command")}><Network size={17} /> Pipeline <small>active</small></button>
          <button onClick={() => setNav("command")}><FileText size={17} /> Content</button>
          <button onClick={() => setNav("command")}><UsersRound size={17} /> Lifecycle</button>
          <button onClick={() => setNav("command")}><TrendingUp size={17} /> Insights</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="agent-card"><div><span className="agent-orb"><Sparkles size={15} /></span><span><strong>CMO online</strong><small>{relativeLabel(state.lastHeartbeatAt)}</small></span></div><span className="live-dot" /></div>
          <button className="sidebar-link"><Settings size={16} /> Settings</button>
          <button className="sidebar-link new-user-button" onClick={() => command({ type: "new_user" })} disabled={busy}><Plus size={16} /> New User</button>
          <div className="user-row"><Avatar name={state.founder} /><div><strong>{state.founder}</strong><small>Founder</small></div><MoreHorizontal size={16} /></div>
        </div>
      </aside>

      {sidebarOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}

      <main className="main-shell">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={19} /></button>
          <div className="breadcrumbs"><span>{state.companyProfile.name}</span><ChevronRight size={13} /><strong>{nav === "command" ? "Command center" : nav === "playbook" ? "Playbook" : "Activity"}</strong></div>
          <div className="topbar-status">{marketResearch.active && <StatusPill tone="violet"><Radio size={10} /> checking market evidence</StatusPill>}<StatusPill tone="amber"><Radio size={10} /> simulation</StatusPill><div className="mode-switch" aria-label="Agent mode"><button className={state.mode === "propose" ? "active" : ""} onClick={() => command({ type: "set_mode", mode: "propose" })}>Propose</button><button className={state.mode === "autopilot" ? "active" : ""} onClick={() => command({ type: "set_mode", mode: "autopilot" })}><Sparkles size={11} /> Autopilot</button></div><span className={`agent-health health-${state.status}`}><i /> {state.status}</span><button className={`chat-toggle ${marketResearch.active ? "is-working" : ""}`} onClick={() => setChatOpen(true)} aria-label={marketResearch.active ? "Open CMO conversation, agent is still working" : "Open CMO conversation"}>{marketResearch.active ? <span className="live-dot" /> : <MessageSquare size={16} />}<span>{marketResearch.active ? "CMO working" : "Ask CMO"}</span></button></div>
        </header>
        <div className="page-content">
          {error && <div className="error-banner"><AlertTriangle size={16} /> {error}<button aria-label="Dismiss error" onClick={() => setError(undefined)}><X size={14} /></button></div>}
          {nav === "command" && <CommandCenter state={state} busy={busy} command={command} openProposal={() => activeProposal && setDrawerOpen(true)} openActivity={() => setNav("activity")} marketResearch={marketResearch} />}
          {nav === "playbook" && <Playbook state={state} busy={busy} command={command} />}
          {nav === "activity" && <ActivityTrail state={state} />}
        </div>
      </main>

      {chatOpen && <button className="chat-scrim" aria-label="Close CMO conversation" onClick={() => setChatOpen(false)} />}
      <ChatRail
        key={state.companyProfile.originalBrief}
        state={state}
        open={chatOpen}
        close={() => setChatOpen(false)}
        onStateChange={setState}
        marketResearch={marketResearch}
      />

      {drawerOpen && activeProposal && <ProposalDrawer key={`${activeProposal.id}:${activeProposal.payloadHash}`} proposal={activeProposal} state={state} busy={busy} close={() => setDrawerOpen(false)} command={command} />}
    </div>
  );
}
