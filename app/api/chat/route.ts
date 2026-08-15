import { NextResponse } from "next/server";
import { z } from "zod";
import {
  actionReceipt,
  buildCmoPrompt,
  commandForCmoAction,
  type CmoAction,
} from "@/lib/cmo-chat";
import { CursorCmoError, runCursorCmo } from "@/lib/cursor-cmo";
import { executePlanStepWithSubagent } from "@/lib/plan-subagent";
import { dispatch, getState } from "@/lib/store";
import type { MadeThisState } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 180;

const requestSchema = z
  .object({
    message: z.string().trim().min(1).max(4000),
    history: z
      .array(
        z
          .object({
            role: z.enum(["agent", "user"]),
            content: z.string().trim().min(1).max(4000),
          })
          .strict(),
      )
      .max(12)
      .default([]),
  })
  .strict();

function noChangeReceipt(action: CmoAction, state: MadeThisState) {
  if (action === "pause" || action === "resume") return `Agent status · ${state.status}.`;
  if (action === "set_autopilot" || action === "set_propose") {
    return `Operating mode · ${state.mode}.`;
  }
  return undefined;
}

function planReceipt(planId: string, state: MadeThisState) {
  const plan = state.marketingPlans.find((item) => item.id === planId);
  if (!plan) return undefined;
  const autoStep = plan.steps.find((step) => step.id === plan.autoExecutedStepId);
  return autoStep
    ? `Autopilot completed ${plan.id} priority ${autoStep.priority} · ${autoStep.title}.`
    : `${plan.id} prioritized · choose a priority in chat to execute.`;
}

export async function POST(request: Request) {
  let input: z.infer<typeof requestSchema>;
  try {
    input = requestSchema.parse(await request.json());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid chat request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const before = getState();
    if (!before.companyProfile) {
      return NextResponse.json(
        { error: "Start by introducing your company in the welcome screen." },
        { status: 409 },
      );
    }
    const output = await runCursorCmo(buildCmoPrompt(input.message, input.history, before), {
      signal: request.signal,
    });
    const current = getState();
    const command = output.plan
      ? ({ type: "create_marketing_plan", draft: output.plan } as const)
      : commandForCmoAction(output.requestedAction, current);
    const state =
      command?.type === "execute_plan_step"
        ? await executePlanStepWithSubagent(command.planId, command.stepId, {
            signal: request.signal,
          })
        : command
          ? dispatch(command)
          : current;
    const marketingPlan = output.plan
      ? state.marketingPlans.find((item) => item.id === state.activeMarketingPlanId)
      : undefined;
    const receipt = marketingPlan
      ? planReceipt(marketingPlan.id, state)
      : command
        ? actionReceipt(output.requestedAction, state)
        : noChangeReceipt(output.requestedAction, state);

    return NextResponse.json(
      {
        reply: output.reply,
        requestedAction: output.requestedAction,
        actionReason: output.actionReason,
        actionReceipt: receipt,
        marketingPlan,
        state,
        engine: "cursor-cli",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof CursorCmoError
        ? error.message
        : "MadeThis CMO could not complete this turn.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
