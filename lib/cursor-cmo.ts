import "server-only";

import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { cmoOutputSchema, parseCmoOutput, type CmoOutput } from "./cmo-chat";

const runtimeDirectory = path.join(os.tmpdir(), "madethis-cmo-cursor");
const MAX_OUTPUT_BYTES = 1_000_000;
const DEFAULT_TIMEOUT_MS = 150_000;

mkdirSync(runtimeDirectory, { recursive: true, mode: 0o700 });

function installLinkedInSearchSkill() {
  const source = path.join(process.cwd(), ".cursor/skills/linkedin-search/SKILL.md");
  if (!existsSync(source)) return;
  const destDir = path.join(runtimeDirectory, ".cursor", "skills", "linkedin-search");
  mkdirSync(destDir, { recursive: true, mode: 0o700 });
  copyFileSync(source, path.join(destDir, "SKILL.md"));
}

function installProjectCursorFiles() {
  installLinkedInSearchSkill();
  const sourceDir = path.join(process.cwd(), ".cursor/agents");
  if (!existsSync(sourceDir)) return;
  const destDir = path.join(runtimeDirectory, ".cursor", "agents");
  mkdirSync(destDir, { recursive: true, mode: 0o700 });
  for (const file of readdirSync(sourceDir)) {
    if (!file.endsWith(".md")) continue;
    copyFileSync(path.join(sourceDir, file), path.join(destDir, file));
  }
}

installProjectCursorFiles();

export class CursorCmoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CursorCmoError";
  }
}

function childEnvironment(): NodeJS.ProcessEnv {
  const allowed = [
    "PATH",
    "HOME",
    "CURSOR_API_KEY",
    "CURSOR_API_ENDPOINT",
    "LANG",
    "LC_ALL",
    "TMPDIR",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "NO_PROXY",
    "SSL_CERT_FILE",
  ] as const;
  const environment: NodeJS.ProcessEnv = {
    NODE_ENV: process.env.NODE_ENV ?? "production",
  };
  for (const key of allowed) {
    if (process.env[key]) environment[key] = process.env[key];
  }
  return environment;
}

function runtimeArgs(prompt: string, streaming: boolean) {
  const modelArgs = process.env.MADETHIS_CURSOR_MODEL
    ? ["--model", process.env.MADETHIS_CURSOR_MODEL]
    : [];

  return [
    "--print",
    "--output-format",
    streaming ? "stream-json" : "text",
    ...(streaming ? ["--stream-partial-output"] : []),
    "--mode",
    "ask",
    "--trust",
    "--workspace",
    runtimeDirectory,
    ...modelArgs,
    prompt,
  ];
}

export type CursorProgressEvent = {
  id: string;
  title: string;
  detail: string;
};

type CursorStreamLine = {
  progress?: CursorProgressEvent;
  transcriptDelta?: string;
  result?: string;
  error?: string;
};

const COARSE_PROGRESS_IDS = new Set(["connected", "analysis", "research", "drafting"]);

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
}

function truncateDetail(value: string, max = 160) {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

function extractJsonStringField(raw: string, field: string) {
  const match = raw.match(new RegExp(`"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`));
  if (!match) return;
  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return match[1];
  }
}

export function visibleAgentTranscript(raw: string) {
  const withoutFence = raw
    .replace(/^\u001b\[[0-9;]*m/g, "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  if (!withoutFence) return "";
  const prose = withoutFence.split("{")[0]?.trim();
  const reply = extractJsonStringField(withoutFence, "reply");
  const summary = extractJsonStringField(withoutFence, "summary");
  const name = extractJsonStringField(withoutFence, "name");
  const parts = [
    prose,
    name && summary ? `${name} — ${summary}` : reply || summary,
  ].filter((part): part is string => Boolean(part));
  const text = parts.join("\n\n").replace(/[ \t]+\n/g, "\n").trim();
  if (text) return truncateDetail(text, 1_200);
  if (withoutFence.startsWith("{")) return "Drafting the company brief and GTM plan…";
  return truncateDetail(withoutFence, 1_200);
}

function assistantText(event: Record<string, unknown>) {
  const message = asRecord(event.message);
  const content = message?.content ?? event.text ?? event.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      const item = asRecord(part);
      if (!item || item.type === "thinking") return "";
      return typeof item.text === "string" ? item.text : "";
    })
    .join("");
}

function parseToolArgs(value: unknown): Record<string, unknown> {
  const record = asRecord(value);
  if (record) return record;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    return asRecord(JSON.parse(value)) ?? {};
  } catch {
    return { query: value };
  }
}

function hostnameFrom(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return;
  }
}

function toolProgress(event: Record<string, unknown>): CursorProgressEvent | undefined {
  const toolCall = asRecord(event.tool_call) ?? asRecord(event.toolCall);
  if (!toolCall) return;
  const callId = firstString(event.call_id, event.callId, event.id) ?? "research";
  const completed = event.subtype === "completed" || event.subtype === "success";

  let toolKey = "research";
  let args: Record<string, unknown> = {};
  const functionCall = asRecord(toolCall.function);
  if (functionCall) {
    toolKey = firstString(functionCall.name) ?? "function";
    args = parseToolArgs(functionCall.arguments ?? functionCall.args);
  } else {
    const named = Object.entries(toolCall).find(([, value]) => asRecord(value));
    if (named) {
      toolKey = named[0];
      const body = asRecord(named[1]) ?? {};
      args = parseToolArgs(body.args ?? body.arguments ?? body);
    }
  }

  const query = firstString(args.query, args.search, args.q, args.prompt, args.question, args.keywords);
  const url = firstString(args.url, args.uri, args.href);
  const host = url ? hostnameFrom(url) : undefined;
  const lowered = toolKey.toLowerCase();
  const detail = query
    ? `${completed ? "Reviewed" : "Searching"} “${truncateDetail(query, 90)}”`
    : host
      ? `${completed ? "Read" : "Reading"} ${host}`
      : lowered.includes("search")
        ? completed
          ? "Finished a web search"
          : "Searching the public web"
        : completed
          ? "Recorded a market source"
          : "Reviewing available company and industry sources";

  return {
    id: `research-${callId}`,
    title: "Checking market evidence",
    detail,
  };
}

function isAssistantDelta(event: Record<string, unknown>) {
  const hasPartialFields = "timestamp_ms" in event || "model_call_id" in event;
  if (!hasPartialFields) return true;
  return typeof event.timestamp_ms === "number" && event.model_call_id == null;
}

export function parseCursorStreamLine(line: string): CursorStreamLine {
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(line) as Record<string, unknown>;
  } catch {
    return {};
  }

  if (event.type === "system" && event.subtype === "init") {
    return {
      progress: {
        id: "connected",
        title: "CMO agent connected",
        detail: typeof event.model === "string" ? event.model : "Cursor Agent CLI",
      },
    };
  }
  if (event.type === "thinking") {
    return {
      progress: {
        id: "analysis",
        title: "Analyzing your market",
        detail: "Working through the company, audience, category, and strongest route to market",
      },
    };
  }
  if (event.type === "tool_call" || (typeof event.type === "string" && event.type.includes("tool"))) {
    return {
      progress:
        toolProgress(event) ?? {
          id: "research",
          title: "Checking market evidence",
          detail: "Reviewing available company and industry sources",
        },
    };
  }
  if (event.type === "assistant") {
    const text = assistantText(event);
    if (!isAssistantDelta(event)) return {};
    return {
      progress: {
        id: "drafting",
        title: "Writing your GTM plan",
        detail: "Turning the research into a ranked, visual execution map",
      },
      transcriptDelta: text || undefined,
    };
  }
  if (event.type === "result") {
    if (event.is_error === true) {
      return {
        error:
          typeof event.result === "string"
            ? event.result
            : "Cursor Agent CLI could not complete this turn.",
      };
    }
    if (typeof event.result === "string") return { result: event.result };
  }
  return {};
}

function sanitizedFailure(stderr: string) {
  const normalized = stderr.toLowerCase();
  if (
    normalized.includes("not logged in") ||
    normalized.includes("authentication") ||
    normalized.includes("unauthorized")
  ) {
    return "Cursor Agent CLI is not authenticated. Run `cursor-agent login` on the server and try again.";
  }
  if (normalized.includes("command not found") || normalized.includes("enoent")) {
    return "Cursor Agent CLI is not installed or is not available on the server PATH.";
  }
  return "Cursor Agent CLI could not complete this turn. Please try again.";
}

function cleanJsonOutput(raw: string) {
  const withoutAnsi = raw.replace(/\u001b\[[0-9;]*m/g, "").trim();
  const withoutFence = withoutAnsi
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON object returned");
  return withoutFence.slice(start, end + 1);
}

export function runCursorStructured<T>(
  prompt: string,
  outputSchema: object,
  parse: (raw: string) => T,
  options: {
    signal?: AbortSignal;
    timeoutMs?: number;
    onProgress?: (event: CursorProgressEvent) => void;
  } = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const streaming = Boolean(options.onProgress);
  const structuredPrompt = `${prompt}

<required_response_schema>
${JSON.stringify(outputSchema)}
</required_response_schema>

Return one JSON object matching the schema exactly. Do not wrap it in markdown or add commentary.`;

  return new Promise((resolve, reject) => {
    const child = spawn(
      /* turbopackIgnore: true */ process.env.MADETHIS_CURSOR_BIN ?? "cursor-agent",
      runtimeArgs(structuredPrompt, streaming),
      {
        cwd: runtimeDirectory,
        env: childEnvironment(),
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    let streamBuffer = "";
    let streamResult = "";
    let streamError = "";
    let settled = false;
    const emittedProgress = new Set<string>();
    let transcript = "";
    let transcriptTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (transcriptTimer) clearTimeout(transcriptTimer);
      options.signal?.removeEventListener("abort", abort);
      callback();
    };

    const emitTranscript = () => {
      if (transcriptTimer) {
        clearTimeout(transcriptTimer);
        transcriptTimer = undefined;
      }
      const detail = visibleAgentTranscript(transcript);
      if (!detail) return;
      try {
        options.onProgress?.({
          id: "transcript",
          title: "CMO notes",
          detail,
        });
      } catch {
        // The response stream may already be closed after a client disconnect.
      }
    };

    const queueTranscript = () => {
      if (transcriptTimer) return;
      transcriptTimer = setTimeout(emitTranscript, 80);
      transcriptTimer.unref?.();
    };

    const emitProgress = (progress: CursorProgressEvent) => {
      const coarse = COARSE_PROGRESS_IDS.has(progress.id);
      if (coarse && emittedProgress.has(progress.id)) return;
      if (coarse) emittedProgress.add(progress.id);
      try {
        options.onProgress?.(progress);
      } catch {
        // The response stream may already be closed after a client disconnect.
      }
    };

    const stop = () => {
      child.kill("SIGTERM");
      const forceTimer = setTimeout(() => child.kill("SIGKILL"), 2_000);
      forceTimer.unref();
    };

    const abort = () => {
      stop();
      finish(() => reject(new CursorCmoError("The Cursor Agent turn was cancelled.")));
    };

    const tryParsePartial = (raw: string) => {
      if (!raw.trim()) return undefined;
      try {
        return parse(cleanJsonOutput(raw));
      } catch {
        return undefined;
      }
    };

    const timeout = setTimeout(() => {
      const parsed = tryParsePartial(streamResult) ?? tryParsePartial(stdout);
      stop();
      if (parsed) {
        finish(() => resolve(parsed));
        return;
      }
      finish(() =>
        reject(
          new CursorCmoError(
            "Cursor Agent CLI took too long to respond. Try a shorter company brief, or run the task again.",
          ),
        ),
      );
    }, timeoutMs);
    timeout.unref();

    options.signal?.addEventListener("abort", abort, { once: true });

    child.on("error", (error) => {
      finish(() => reject(new CursorCmoError(sanitizedFailure(error.message))));
    });

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stdout += text;
      if (Buffer.byteLength(stdout) > MAX_OUTPUT_BYTES) {
        stop();
        finish(() => reject(new CursorCmoError("Cursor Agent CLI returned too much output.")));
        return;
      }
      if (!streaming) return;

      streamBuffer += text;
      const lines = streamBuffer.split("\n");
      streamBuffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = parseCursorStreamLine(line);
        if (event.result) streamResult = event.result;
        if (event.error) streamError = event.error;
        if (event.transcriptDelta) {
          const delta = event.transcriptDelta;
          if (!transcript) {
            transcript = delta;
          } else if (
            delta.length > 40 &&
            (delta === transcript || transcript.endsWith(delta) || delta.startsWith(transcript))
          ) {
            if (delta.startsWith(transcript) && delta.length > transcript.length) transcript = delta;
          } else {
            transcript += delta;
          }
          queueTranscript();
        }
        if (event.progress) {
          if (event.progress.id.startsWith("research")) emitTranscript();
          emitProgress(event.progress);
        }
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      if (Buffer.byteLength(stderr) <= MAX_OUTPUT_BYTES) stderr += chunk.toString("utf8");
    });

    child.on("close", (code) => {
      emitTranscript();
      finish(() => {
        if (code !== 0) {
          reject(new CursorCmoError(sanitizedFailure(stderr)));
          return;
        }
        if (streamError) {
          reject(new CursorCmoError("Cursor Agent CLI could not complete this turn."));
          return;
        }
        try {
          resolve(parse(cleanJsonOutput(streaming ? streamResult : stdout)));
        } catch {
          reject(new CursorCmoError("Cursor Agent CLI returned an invalid structured response."));
        }
      });
    });

    if (options.signal?.aborted) abort();
  });
}

export function runCursorCmo(
  prompt: string,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<CmoOutput> {
  return runCursorStructured(prompt, cmoOutputSchema, parseCmoOutput, options);
}
