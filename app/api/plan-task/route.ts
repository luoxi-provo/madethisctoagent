import { NextResponse } from "next/server";
import { z } from "zod";
import { CursorCmoError } from "@/lib/cursor-cmo";
import { executePlanStepWithSubagent } from "@/lib/plan-subagent";
import { getState } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 180;

const requestSchema = z
  .object({
    planId: z.string().trim().min(1),
    stepId: z.string().trim().min(1),
  })
  .strict();

export async function POST(request: Request) {
  let input: z.infer<typeof requestSchema>;
  try {
    input = requestSchema.parse(await request.json());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Choose a plan priority first.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const current = getState();
  if (!current.companyProfile) {
    return NextResponse.json(
      { error: "Start by introducing your company in the welcome screen." },
      { status: 409 },
    );
  }

  try {
    const state = await executePlanStepWithSubagent(input.planId, input.stepId, {
      signal: request.signal,
    });
    const plan = state.marketingPlans.find((item) => item.id === input.planId);
    const step = plan?.steps.find((item) => item.id === input.stepId);
    return NextResponse.json(
      {
        state,
        plan,
        step,
        subagent: step?.subagent,
        engine: "cursor-cli",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof CursorCmoError
        ? error.message
        : error instanceof Error
          ? error.message
          : "MadeThis CMO could not spawn a subagent for this task.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
