import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildCompanyResearchPrompt,
  companyResearchOutputSchema,
  extractWebsite,
  fetchWebsiteSnapshot,
  parseCompanyResearchOutput,
  researchPlan,
  toCompanyProfile,
} from "@/lib/company-research";
import {
  CursorCmoError,
  runCursorStructured,
  type CursorProgressEvent,
} from "@/lib/cursor-cmo";
import { dispatch } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 180;

const requestSchema = z
  .object({
    message: z.string().trim().min(3).max(5_000),
  })
  .strict();

export async function POST(request: Request) {
  let input: z.infer<typeof requestSchema>;
  try {
    input = requestSchema.parse(await request.json());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tell me about the company first.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: object) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          closed = true;
        }
      };
      const progress = (event: CursorProgressEvent | { id: string; title: string; detail: string }) => {
        if (event.id === "transcript") {
          send({ type: "transcript", text: event.detail });
          return;
        }
        send({ type: "progress", ...event });
      };

      void (async () => {
        try {
          progress({
            id: "brief",
            title: "Company brief received",
            detail: "Preparing the research workspace",
          });
          const suppliedWebsite = extractWebsite(input.message);
          if (suppliedWebsite) {
            progress({
              id: "website",
              title: "Reading your website",
              detail: new URL(suppliedWebsite).hostname,
            });
          }
          const website = suppliedWebsite
            ? await fetchWebsiteSnapshot(suppliedWebsite)
            : undefined;
          if (website) {
            progress({
              id: "website-read",
              title: "Website context captured",
              detail: website.title || website.url,
            });
          }
          const researchPrompt = buildCompanyResearchPrompt(input.message, website);
          const runResearch = () =>
            runCursorStructured(
              researchPrompt,
              companyResearchOutputSchema,
              parseCompanyResearchOutput,
              {
                signal: request.signal,
                timeoutMs: 75_000,
                onProgress: progress,
              },
            );
          let output: Awaited<ReturnType<typeof runResearch>>;
          try {
            output = await runResearch();
          } catch (error) {
            if (
              !(error instanceof CursorCmoError) ||
              !error.message.includes("invalid structured response")
            ) {
              throw error;
            }
            progress({
              id: "format-retry",
              title: "Tightening the plan format",
              detail: "The research is intact; the CMO is fitting it to the visual workspace",
            });
            output = await runResearch();
          }
          const profile = toCompanyProfile(
            output,
            input.message,
            new Date().toISOString(),
            website?.url ?? suppliedWebsite,
          );
          const state = dispatch({
            type: "onboard_company",
            profile,
            draft: researchPlan(output),
          });
          const marketingPlan = state.marketingPlans.find(
            (plan) => plan.id === state.activeMarketingPlanId,
          );

          send({
            type: "result",
            reply: output.reply,
            profile,
            marketingPlan,
            state,
            engine: "cursor-cli",
          });
        } catch (error) {
          const message =
            error instanceof CursorCmoError
              ? error.message
              : error instanceof Error
                ? error.message
                : "MadeThis CMO could not research this company.";
          send({ type: "error", message });
        } finally {
          if (!closed) controller.close();
          closed = true;
        }
      })();
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-store, no-transform",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
