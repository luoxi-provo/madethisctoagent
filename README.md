# MadeThis CMO

MadeThis CMO is a go-to-market agent for early-stage companies. A new user starts in a focused conversation, introduces the company or pastes its URL, and gets a researched company profile plus a ranked visual marketing plan. The resulting workspace continuously watches strategy, content, lifecycle, insights, pipeline, and partnerships, then moves the safest high-leverage work forward.

The application uses a three-part operator layout: persistent navigation on the left, the governed marketing dashboard in the middle, and a MadeThis-style CMO conversation rail on the right. The chat can explain recommendations, build a ranked 3–5 step marketing plan, collect the founder's priority choice, and request governed heartbeat, Pause, Resume, or Autopilot commands without bypassing the existing action perimeter. A generated plan appears as a synchronized execution diagram in the middle dashboard and as actionable feedback beside the chat response.

The memorable product behavior is not generated copy. It is judgment: MadeThis CMO treats relationship capital as a budget it cannot silently spend.

## Run locally

Requirements: Node.js 22+, npm, and an installed Cursor Agent CLI.

```bash
npm install
cursor-agent login
npm run dev
```

Open the printed local URL and introduce a company. If the brief contains a public URL, MadeThis CMO safely fetches the page before the agent researches the company and category. The dashboard is backed by synthetic people, companies, signals, and outcomes. The right-side conversation is real: each turn runs the authenticated Cursor Agent CLI on the server. Set `MADETHIS_CURSOR_BIN` if `cursor-agent` is not on the server PATH, or `MADETHIS_CURSOR_MODEL` to select an available model explicitly.

Useful commands:

```bash
npm test        # deterministic agent and policy suite
npm run lint    # Next.js and TypeScript lint rules
npm run build   # production build
npm run check   # all release checks
```

Use **New User** in the sidebar to erase the current profile, agent state, plans, activity, outcomes, and visible conversation, then return to onboarding.

## The implemented loop

1. A heartbeat ranks Bluebird from a hiring + intent signal.
2. MadeThis CMO selects `direct_intro@1` and proposes Jordan, the strongest relationship.
3. Lena rejects the request with a 90-day customer cooldown directive.
4. The exact directive becomes a visible, user-owned policy. Jordan becomes ineligible.
5. The same opportunity is re-ranked through Sam with `permission_first_artifact_share@1`.
6. Lena approves the canonical payload and the simulator records one idempotent action.
7. Synthetic accepted-share, positive-reply, and meeting outcomes update the matching play.
8. An inferred play broadening appears as a pending semantic diff; it is not silently activated.
9. In scoped Autopilot, the next heartbeat filters Northstar's recent customer path, selects Devon, cites the policy and outcome, and executes only because the narrow simulator grant matches.

## Architecture

```text
Synthetic signals + relationship graph
               │
               ▼
     Deterministic eligibility filter ─── active, scoped policies
               │
               ▼
     MadeThis CMO decision engine ─────── eligible versioned GTM plays
               │
               ▼
       Typed proposal validator
               │
      exact approval or narrow grant
               │
               ▼
 beforeAction authority perimeter
               │
               ▼
       simulate_send adapter only
               │
               ▼
 afterAction receipt + outcome memory ─── pending strategy diff

 Founder chat ─── Cursor Agent CLI (Ask mode, structured output)
                         │
                         ▼
          typed plan + safe dashboard action allowlist
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
       ranked execution map    numbered chat choice
              │                     │
              └──────────┬──────────┘
                         ▼
             code-owned difficulty policy
                         │
            Propose: founder choice required
            Autopilot: first easy step only
                         │
                         └────── deterministic reducer above
```

The web application uses Next.js, React, and TypeScript. SQLite stores the latest durable workspace snapshot behind an immediate transaction. The core reducer is pure and separately testable. A heartbeat gets a context hash and terminal run receipt, and only one proposal may be created per run.

The operating loop remains deterministic, while the conversation rail uses Cursor Agent CLI for real planning and reasoning. Cursor runs in read-only Ask mode from an isolated temporary workspace, and every final response must pass a strict schema. The model may return a bounded ranked plan or request heartbeat, Pause, Resume, Propose mode, scoped Autopilot mode, or one numbered priority from the current plan. It may never assign difficulty, activate its own inference, approve an action, broaden authority, bypass caps, edit payloads, or invoke an adapter directly.

## Propose and Autopilot

- **Propose** requires exact approval for every outbound payload. Editing any outbound field changes its SHA-256 canonical hash and invalidates authority.
- **Autopilot** is not a global permission switch. The included grant authorizes only `permission_first_artifact_share` through `simulate_send`, to synthetic former colleagues, at low relationship cost, at most twice per day, before expiry.

For generated marketing plans, Propose asks the founder which ranked priority to execute. Autopilot advances exactly one highest-ranked action that application code classifies as easy internal work (`research_brief`, `content_draft`, or `campaign_outline`). Funnel analysis and heartbeats remain medium; outbound publication, messaging, spend, and live integrations are absent from the plan action vocabulary.

The code-owned `beforeAction` perimeter checks status, policy, expiry, caps, idempotency, authority, and payload integrity immediately before execution. Any exception or malformed state fails closed. `afterAction` stores the simulator receipt and its correlated activity event. There is no live adapter in this project.

## Memory and self-improvement

MadeThis CMO separates five concerns:

- Evidence stays attached to synthetic source IDs.
- Explicit founder directives become scoped, attributable policies.
- GTM plays are typed and versioned procedural memory.
- Outcomes update only the matching play's transparent performance counts.
- Current proposals and heartbeat state remain run context, not generalized memory.

Clear user-authored policy can activate at exactly the stated scope. Vague feedback and every agent-inferred generalization remain pending. Approving a pending play change creates new immutable version metadata; rollback restores the prior version without erasing history.

## Synthetic fixtures and reset

The seed contains eight accounts, twelve signal records represented across opportunity evidence, eighteen relationship paths, three governed plays, stale/duplicate/untrusted negative cases, and deterministic Bluebird and Northstar proof cycles. All outbound activity and outcomes carry simulation labels.

SQLite is written to `data/madethis-cmo.sqlite` and excluded from version control. Reset replaces the current demo snapshot with a clean seed; it does not touch any external system.

## Testing

The full acceptance contract is in [TEST_SPEC.md](./TEST_SPEC.md). The automated suite covers policy compilation, re-ranking, hash invalidation, fail-closed execution, pause, caps, idempotency, outcome replay, scoped Autopilot, durable plan ranking, code-owned difficulty, founder selection, plan execution while paused, pending learning, version approval/rollback, heartbeat de-duplication, structured agent output validation, prompt isolation, and the chat action allowlist.

## Limitations

- This is a hackathon vertical slice, not a live marketing integration.
- Research and chat depend on a locally installed and authenticated Cursor Agent CLI; there is no synthetic answer fallback when the runtime is unavailable.
- It has no email, CRM, calendar, publishing, ad-spend, or enrichment connector.
- Plan steps advance durable workstream status and produce internal/synthetic completion receipts; external content, lifecycle, analytics, and strategy integrations remain intentionally unwired.
- Performance estimates from one synthetic outcome are illustrative, labeled low-sample, and are not causal lift claims.
- SQLite stores a durable single-workspace state snapshot rather than a production multi-user relational schema.

## Safety statement

No real person is contacted, no public content is published, and no money is spent. All identities, signals, messages, and outcomes are synthetic. MadeThis CMO can recommend broad marketing work, but only a narrowly scoped simulator action can produce a side effect in this build.
