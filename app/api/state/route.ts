import { NextResponse } from "next/server";
import { z } from "zod";
import { dispatch, getState } from "@/lib/store";

export const dynamic = "force-dynamic";

const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("reset") }),
  z.object({ type: z.literal("new_user") }),
  z.object({ type: z.literal("run_heartbeat") }),
  z.object({
    type: z.literal("reject"),
    proposalId: z.string().min(1),
    rationale: z.string().trim().min(1).max(500),
  }),
  z.object({
    type: z.literal("edit"),
    proposalId: z.string().min(1),
    message: z.string().trim().min(1).max(2_000),
  }),
  z.object({ type: z.literal("approve_execute"), proposalId: z.string().min(1) }),
  z.object({ type: z.literal("snooze"), proposalId: z.string().min(1) }),
  z.object({ type: z.literal("inject_positive_outcome") }),
  z.object({ type: z.literal("toggle_pause") }),
  z.object({ type: z.literal("stop") }),
  z.object({ type: z.literal("set_mode"), mode: z.enum(["propose", "autopilot"]) }),
  z.object({
    type: z.literal("execute_plan_step"),
    planId: z.string().min(1),
    stepId: z.string().min(1),
  }),
  z.object({ type: z.literal("disable_rule"), ruleId: z.string().min(1) }),
  z.object({ type: z.literal("enable_rule"), ruleId: z.string().min(1) }),
  z.object({
    type: z.literal("decide_change"),
    changeId: z.string().min(1),
    decision: z.enum(["approved", "rejected"]),
  }),
  z.object({ type: z.literal("rollback_play"), playId: z.string().min(1) }),
]);

export async function GET() {
  return NextResponse.json(getState(), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  try {
    const command = commandSchema.parse(await request.json());
    return NextResponse.json(dispatch(command), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid command";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
