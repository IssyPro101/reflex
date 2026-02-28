"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Terminal,
  ChevronDown,
  ChevronRight,
  FileText,
  Pencil,
  Search,
  Eye,
  MessageSquare,
  User,
  Wrench,
} from "lucide-react";
import type { VibeSession, VibeSessionEvent } from "@/lib/types";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  accessToken: string;
};

interface ToolCall {
  id: string;
  index?: number;
  function: {
    name: string;
    arguments: string;
  };
  type?: string;
}

interface StreamMessage {
  role: string;
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
  reasoning_content?: string | null;
}

function tryParseJson(line: string): StreamMessage | null {
  const trimmed = line.trim();
  const candidates = [trimmed];

  if (trimmed.startsWith("data:")) {
    candidates.push(trimmed.slice(5).trim());
  }

  if (
    (trimmed.startsWith(`"`) && trimmed.endsWith(`"`)) ||
    (trimmed.startsWith(`'`) && trimmed.endsWith(`'`))
  ) {
    candidates.push(trimmed.slice(1, -1));
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && typeof parsed.role === "string") {
        return parsed as StreamMessage;
      }

      if (typeof parsed === "string") {
        const nested = JSON.parse(parsed);
        if (
          nested &&
          typeof nested === "object" &&
          typeof (nested as { role?: unknown }).role === "string"
        ) {
          return nested as StreamMessage;
        }
      }
    } catch {
      // Try next candidate shape.
    }
  }

  return null;
}

function looksLikeSystemPreamble(line: string): boolean {
  const trimmed = line.trim();
  return (
    /"role"\s*:\s*"system"/.test(trimmed) ||
    /\\"role\\"\s*:\s*\\"system\\"/.test(trimmed)
  );
}

function reassembleFragments(
  entries: Array<{ msg: StreamMessage | null; raw: string }>,
): Array<{ msg: StreamMessage | null; raw: string }> {
  const result: Array<{ msg: StreamMessage | null; raw: string }> = [];
  let accumulator = "";

  for (const entry of entries) {
    if (entry.msg) {
      if (accumulator) {
        const parsed = tryParseJson(accumulator);
        result.push({ msg: parsed, raw: accumulator });
        accumulator = "";
      }
      result.push(entry);
      continue;
    }

    const trimmed = entry.raw.trim();

    if (accumulator) {
      accumulator += "\n" + entry.raw;
      const parsed = tryParseJson(accumulator);
      if (parsed) {
        result.push({ msg: parsed, raw: accumulator });
        accumulator = "";
      }
    } else if (trimmed.startsWith("{")) {
      accumulator = entry.raw;
      const parsed = tryParseJson(accumulator);
      if (parsed) {
        result.push({ msg: parsed, raw: accumulator });
        accumulator = "";
      }
    } else {
      result.push(entry);
    }
  }

  if (accumulator) {
    const parsed = tryParseJson(accumulator);
    result.push({ msg: parsed, raw: accumulator });
  }

  return result;
}

function extractToolArgs(argsStr: string): Record<string, unknown> | null {
  try {
    return JSON.parse(argsStr);
  } catch {
    return null;
  }
}

function summarizeToolCall(tc: ToolCall): { label: string; detail: string } {
  const args = extractToolArgs(tc.function.arguments);
  const name = tc.function.name;

  if (name === "read_file") {
    const path = (args?.path as string) ?? "";
    const shortPath = path.split("/").slice(-2).join("/");
    return { label: "Reading file", detail: shortPath };
  }
  if (name === "search_replace") {
    const path = (args?.file_path as string) ?? "";
    const shortPath = path.split("/").slice(-2).join("/");
    return { label: "Editing file", detail: shortPath };
  }
  if (name === "write_file") {
    const path = (args?.path as string) ?? "";
    const shortPath = path.split("/").slice(-2).join("/");
    return { label: "Writing file", detail: shortPath };
  }
  if (name === "grep") {
    const pattern = (args?.pattern as string) ?? "";
    return { label: "Searching", detail: `"${pattern}"` };
  }
  if (name === "bash") {
    const cmd = (args?.command as string) ?? "";
    return { label: "Running command", detail: cmd.slice(0, 60) };
  }
  if (name === "task") {
    return { label: "Delegating task", detail: "" };
  }
  if (name === "web_search") {
    const query = (args?.query as string) ?? (args?.search_term as string) ?? "";
    return { label: "Web search", detail: query.slice(0, 60) };
  }
  if (name === "ask_user_question") {
    return { label: "Asking user", detail: "" };
  }

  return { label: name, detail: "" };
}

function toolIcon(name: string) {
  if (name === "read_file") return <Eye className="w-3 h-3" />;
  if (name === "search_replace" || name === "write_file")
    return <Pencil className="w-3 h-3" />;
  if (name === "grep") return <Search className="w-3 h-3" />;
  if (name === "bash") return <Terminal className="w-3 h-3" />;
  return <Wrench className="w-3 h-3" />;
}

function summarizeToolResult(msg: StreamMessage): string {
  const content = msg.content ?? "";
  const name = msg.name ?? "tool";

  if (name === "read_file") {
    const pathMatch = content.match(/^path:\s*(.+)/m);
    const linesMatch = content.match(/lines_read:\s*(\d+)/);
    const path = pathMatch?.[1]?.split("/").slice(-2).join("/") ?? "";
    const lines = linesMatch?.[1] ?? "?";
    return `${path} (${lines} lines)`;
  }

  if (name === "search_replace") {
    const fileMatch = content.match(/^file:\s*(.+)/m);
    const blocksMatch = content.match(/blocks_applied:\s*(\d+)/);
    const path = fileMatch?.[1]?.split("/").slice(-2).join("/") ?? "";
    const blocks = blocksMatch?.[1] ?? "?";
    return `${path} (${blocks} block${blocks === "1" ? "" : "s"} applied)`;
  }

  if (name === "bash") {
    const firstLine = content.split("\n")[0] ?? "";
    return firstLine.slice(0, 80);
  }

  return content.slice(0, 100);
}

function MessageRow({ msg, index }: { msg: StreamMessage; index: number }) {
  const [toolExpanded, setToolExpanded] = useState(false);

  if (msg.role === "system") {
    return null;
  }

  if (msg.role === "user") {
    const content = msg.content ?? "";
    const preview =
      content.length > 200 ? content.slice(0, 200) + "..." : content;
    return (
      <div className="py-2 border-b border-white/[0.04]">
        <div className="flex items-center gap-1.5 mb-1">
          <User className="w-3 h-3 text-cyan-400" />
          <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">
            prompt
          </span>
        </div>
        <p className="text-[12px] text-zinc-300 whitespace-pre-wrap break-words pl-[18px]">
          {preview}
        </p>
      </div>
    );
  }

  if (msg.role === "assistant") {
    const hasContent = msg.content && msg.content.trim().length > 0;
    const hasTools = msg.tool_calls && msg.tool_calls.length > 0;

    return (
      <div className="py-2 border-b border-white/[0.04]">
        {hasContent && (
          <div className="mb-1">
            <div className="flex items-center gap-1.5 mb-1">
              <MessageSquare className="w-3 h-3 text-violet-400" />
              <span className="text-[11px] font-semibold text-violet-400 uppercase tracking-wider">
                agent
              </span>
            </div>
            <p className="text-[12px] text-zinc-300 whitespace-pre-wrap break-words pl-[18px]">
              {msg.content}
            </p>
          </div>
        )}
        {hasTools &&
          msg.tool_calls!.map((tc, i) => {
            const summary = summarizeToolCall(tc);
            return (
              <div
                key={tc.id ?? i}
                className="flex items-center gap-2 py-1 pl-[18px] text-[12px]"
              >
                <span className="text-amber-400/70">
                  {toolIcon(tc.function.name)}
                </span>
                <span className="text-amber-400 font-medium">
                  {summary.label}
                </span>
                {summary.detail && (
                  <span className="text-zinc-500 font-mono truncate max-w-[300px]">
                    {summary.detail}
                  </span>
                )}
              </div>
            );
          })}
      </div>
    );
  }

  if (msg.role === "tool") {
    const summary = summarizeToolResult(msg);
    const name = msg.name ?? "tool";
    const fullContent = msg.content ?? "";

    return (
      <div className="py-1 border-b border-white/[0.04]">
        <button
          onClick={() => setToolExpanded(!toolExpanded)}
          className="flex items-center gap-2 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors pl-[18px] cursor-pointer w-full text-left"
        >
          {toolExpanded ? (
            <ChevronDown className="w-3 h-3 shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 shrink-0" />
          )}
          <FileText className="w-3 h-3 shrink-0 text-zinc-600" />
          <span className="font-mono text-zinc-600">{name}:</span>
          <span className="truncate">{summary}</span>
        </button>
        {toolExpanded && (
          <pre className="mt-1 ml-[18px] p-2 bg-white/[0.02] rounded border border-white/[0.04] text-[11px] text-zinc-500 max-h-[200px] overflow-auto whitespace-pre-wrap break-all custom-scrollbar">
            {fullContent.length > 2000
              ? fullContent.slice(0, 2000) + "\n... (truncated)"
              : fullContent}
          </pre>
        )}
      </div>
    );
  }

  return (
    <div className="py-1 text-[11px] text-zinc-600">
      <span className="font-mono">[{msg.role}]</span>{" "}
      {(msg.content ?? "").slice(0, 100)}
    </div>
  );
}

function SessionTerminal({ session }: { session: VibeSession }) {
  const [expanded, setExpanded] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (expanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session.outputLines.length, expanded]);

  const statusDotColor =
    session.status === "running"
      ? "bg-emerald-400"
      : session.status === "completed"
        ? "bg-blue-400"
        : "bg-red-400";

  const rawParsed: Array<{ msg: StreamMessage | null; raw: string }> =
    session.outputLines.map((line) => ({
      msg: tryParseJson(line),
      raw: line,
    }));

  const parsedMessages = reassembleFragments(rawParsed);

  const firstUserIndex = parsedMessages.findIndex(
    (entry) => entry.msg?.role === "user",
  );
  const visibleMessages =
    firstUserIndex >= 0
      ? parsedMessages.slice(firstUserIndex)
      : parsedMessages.filter(
          (entry) =>
            entry.msg?.role !== "system" && !looksLikeSystemPreamble(entry.raw),
        );

  return (
    <div className="border border-white/[0.08] rounded-lg overflow-hidden bg-[#0A0A0A]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors cursor-pointer"
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        )}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className={cn(
              "w-2 h-2 rounded-full shrink-0",
              statusDotColor,
              session.status === "running" && "animate-pulse",
            )}
          />
          <span className="text-[13px] font-medium text-zinc-200 truncate">
            {session.summary || session.complaintId}
          </span>
        </div>
        <span
          className={cn(
            "text-[11px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0",
            session.status === "running"
              ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/10"
              : session.status === "completed"
                ? "text-blue-400 border-blue-400/20 bg-blue-400/10"
                : "text-red-400 border-red-400/20 bg-red-400/10",
          )}
        >
          {session.status}
        </span>
        <span className="text-[11px] text-zinc-600 shrink-0">
          {new Date(session.startedAt).toLocaleTimeString()}
        </span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              ref={scrollRef}
              className="max-h-[500px] overflow-y-auto border-t border-white/[0.06] font-mono text-[12px] leading-5 custom-scrollbar"
            >
              {visibleMessages.length === 0 ? (
                <div className="px-4 py-6 text-zinc-600 text-center flex items-center justify-center gap-2">
                  <Activity className="w-3.5 h-3.5 animate-pulse" />
                  Waiting for output...
                </div>
              ) : (
                <div className="px-4 py-2">
                  {visibleMessages.map((entry, i) => {
                    if (entry.msg) {
                      return (
                        <MessageRow key={i} msg={entry.msg} index={i} />
                      );
                    }
                    return (
                      <div
                        key={i}
                        className="py-0.5 text-[11px] text-zinc-600 whitespace-pre-wrap break-all"
                      >
                        {entry.raw}
                      </div>
                    );
                  })}
                  {session.status === "running" && (
                    <div className="flex items-center gap-1.5 pt-2 pb-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-zinc-600 text-[11px]">
                        streaming...
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ActiveSessions({ accessToken }: Props) {
  const [sessions, setSessions] = useState<VibeSession[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = api.getSessionsStreamUrl(accessToken);
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener("snapshot", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setSessions(data.sessions ?? []);
        setConnected(true);
        setError(null);
      } catch {
        /* ignore */
      }
    });

    es.addEventListener("session_started", (e: MessageEvent) => {
      try {
        const event: VibeSessionEvent = JSON.parse(e.data);
        setSessions((prev) => {
          const exists = prev.some((s) => s.id === event.session.id);
          return exists ? prev : [...prev, event.session];
        });
      } catch {
        /* ignore */
      }
    });

    es.addEventListener("session_output", (e: MessageEvent) => {
      try {
        const event: VibeSessionEvent = JSON.parse(e.data);
        setSessions((prev) =>
          prev.map((s) =>
            s.id === event.sessionId
              ? { ...s, outputLines: event.session.outputLines }
              : s,
          ),
        );
      } catch {
        /* ignore */
      }
    });

    es.addEventListener("session_ended", (e: MessageEvent) => {
      try {
        const event: VibeSessionEvent = JSON.parse(e.data);
        setSessions((prev) =>
          prev.map((s) =>
            s.id === event.sessionId
              ? {
                  ...s,
                  status: event.session.status,
                  completedAt: event.session.completedAt,
                  outputLines: event.session.outputLines,
                }
              : s,
          ),
        );
      } catch {
        /* ignore */
      }
    });

    es.onerror = () => {
      setConnected(false);
      setError("Connection lost. Reconnecting...");
      es.close();
      setTimeout(connect, 3000);
    };
  }, [accessToken]);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
    };
  }, [connect]);

  const runningSessions = sessions.filter((s) => s.status === "running");
  const finishedSessions = sessions.filter((s) => s.status !== "running");

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="flex items-center gap-2 text-[12px]">
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              connected ? "bg-emerald-400" : "bg-yellow-400 animate-pulse",
            )}
          />
          <span className="text-zinc-500">
            {connected ? "Connected" : "Connecting..."}
          </span>
        </div>
        {error && (
          <span className="text-[12px] text-yellow-500/70">{error}</span>
        )}
      </div>

      {runningSessions.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4 border-b border-white/[0.08] pb-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h2 className="text-[13px] font-medium text-zinc-300">
              Active Sessions
            </h2>
            <span className="text-[11px] bg-emerald-400/10 text-emerald-400 px-1.5 py-0.5 rounded-sm ml-auto font-medium">
              {runningSessions.length}
            </span>
          </div>
          <div className="space-y-3">
            {runningSessions.map((session) => (
              <SessionTerminal key={session.id} session={session} />
            ))}
          </div>
        </div>
      )}

      {finishedSessions.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4 border-b border-white/[0.08] pb-2">
            <Terminal className="w-4 h-4 text-zinc-500" />
            <h2 className="text-[13px] font-medium text-zinc-300">
              Recent Sessions
            </h2>
            <span className="text-[11px] text-zinc-600 bg-white/[0.04] px-1.5 py-0.5 rounded-sm ml-auto">
              {finishedSessions.length}
            </span>
          </div>
          <div className="space-y-3">
            {finishedSessions.map((session) => (
              <SessionTerminal key={session.id} session={session} />
            ))}
          </div>
        </div>
      )}

      {sessions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-xl border border-white/[0.08] bg-[#0A0A0A] flex items-center justify-center mb-4">
            <Terminal className="w-5 h-5 text-zinc-600" />
          </div>
          <p className="text-[14px] font-medium text-zinc-400 mb-1">
            No active sessions
          </p>
          <p className="text-[13px] text-zinc-600 max-w-[300px]">
            When the coding agent starts working on an issue, you&apos;ll see
            the live output here.
          </p>
        </div>
      )}
    </div>
  );
}
