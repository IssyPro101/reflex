import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';

import { DbService } from '../db/db.service';

export interface VibeSession {
  id: string;
  complaintId: string;
  summary: string;
  status: 'running' | 'completed' | 'failed';
  outputLines: string[];
  startedAt: string;
  completedAt: string | null;
}

export interface VibeSessionEvent {
  type: 'session_started' | 'session_output' | 'session_ended';
  sessionId: string;
  session: VibeSession;
  newChunk?: string;
}

interface InternalSession extends VibeSession {
  lineBuffer: string;
  persistTimer: NodeJS.Timeout | null;
}

@Injectable()
export class VibeSessionStore implements OnModuleInit {
  private readonly sessions = new Map<string, InternalSession>();
  private readonly updates$ = new Subject<VibeSessionEvent>();
  private readonly logger = new Logger(VibeSessionStore.name);
  private readonly persistDebounceMs = 400;

  constructor(private readonly db: DbService) {}

  async onModuleInit(): Promise<void> {
    await this.restoreRecentSessions();
  }

  createSession(complaintId: string, summary: string): string {
    const id = `${complaintId}-${Date.now().toString(36)}`;
    const session: InternalSession = {
      id,
      complaintId,
      summary,
      status: 'running',
      outputLines: [],
      startedAt: new Date().toISOString(),
      completedAt: null,
      lineBuffer: '',
      persistTimer: null,
    };

    this.sessions.set(id, session);
    this.schedulePersist(id);
    this.updates$.next({
      type: 'session_started',
      sessionId: id,
      session: this.toPublic(session),
    });
    return id;
  }

  appendOutput(sessionId: string, chunk: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.lineBuffer += chunk;
    const completedLines = this.extractCompleteLines(session);
    if (completedLines.length === 0) return;

    session.outputLines.push(...completedLines);
    this.schedulePersist(sessionId);

    this.updates$.next({
      type: 'session_output',
      sessionId,
      session: this.toPublic(session),
      newChunk: chunk,
    });
  }

  endSession(sessionId: string, status: 'completed' | 'failed'): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Flush any remaining buffered data
    if (session.lineBuffer.trim().length > 0) {
      session.outputLines.push(session.lineBuffer.trim());
      session.lineBuffer = '';
    }

    session.status = status;
    session.completedAt = new Date().toISOString();
    if (session.persistTimer) {
      clearTimeout(session.persistTimer);
      session.persistTimer = null;
    }
    void this.persistById(sessionId);

    this.updates$.next({
      type: 'session_ended',
      sessionId,
      session: this.toPublic(session),
    });

  }

  getActiveSessions(): VibeSession[] {
    return Array.from(this.sessions.values())
      .sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      )
      .map((s) => this.toPublic(s));
  }

  getSession(sessionId: string): VibeSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    return this.toPublic(session);
  }

  subscribe(): Observable<VibeSessionEvent> {
    return this.updates$.asObservable();
  }

  private extractCompleteLines(session: InternalSession): string[] {
    const lines: string[] = [];
    const maxLookahead = 200;

    while (true) {
      const nlIndex = session.lineBuffer.indexOf('\n');
      if (nlIndex === -1) break;

      const candidate = session.lineBuffer.substring(0, nlIndex).trim();

      if (!candidate) {
        session.lineBuffer = session.lineBuffer.substring(nlIndex + 1);
        continue;
      }

      if (this.isValidJson(candidate)) {
        lines.push(candidate);
        session.lineBuffer = session.lineBuffer.substring(nlIndex + 1);
        continue;
      }

      // If it looks like the start of a JSON object that was split across
      // multiple physical lines (e.g. unescaped newlines in string values),
      // scan ahead through subsequent newlines to reassemble it.
      if (candidate.startsWith('{')) {
        let resolved = false;
        let searchFrom = nlIndex + 1;
        let lookahead = 0;

        while (searchFrom < session.lineBuffer.length && lookahead < maxLookahead) {
          const nextNl = session.lineBuffer.indexOf('\n', searchFrom);
          if (nextNl === -1) break;

          const extended = session.lineBuffer.substring(0, nextNl).trim();
          if (this.isValidJson(extended)) {
            lines.push(extended);
            session.lineBuffer = session.lineBuffer.substring(nextNl + 1);
            resolved = true;
            break;
          }

          searchFrom = nextNl + 1;
          lookahead++;
        }

        if (!resolved) {
          // Not enough data yet, or stuck — wait for more chunks
          break;
        }
      } else {
        lines.push(candidate);
        session.lineBuffer = session.lineBuffer.substring(nlIndex + 1);
      }
    }

    return lines;
  }

  private isValidJson(text: string): boolean {
    try {
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  }

  private toPublic(session: InternalSession): VibeSession {
    return {
      id: session.id,
      complaintId: session.complaintId,
      summary: session.summary,
      status: session.status,
      outputLines: [...session.outputLines],
      startedAt: session.startedAt,
      completedAt: session.completedAt,
    };
  }

  private schedulePersist(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    if (session.persistTimer) return;

    session.persistTimer = setTimeout(() => {
      const fresh = this.sessions.get(sessionId);
      if (!fresh) return;
      fresh.persistTimer = null;
      void this.persistById(sessionId);
    }, this.persistDebounceMs);
  }

  private async persistById(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      await this.db.query(
        `
        INSERT INTO vibe_sessions (
          id, complaint_id, summary, status, output_lines, started_at, completed_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, NOW())
        ON CONFLICT (id) DO UPDATE
        SET
          complaint_id = EXCLUDED.complaint_id,
          summary = EXCLUDED.summary,
          status = EXCLUDED.status,
          output_lines = EXCLUDED.output_lines,
          started_at = EXCLUDED.started_at,
          completed_at = EXCLUDED.completed_at,
          updated_at = NOW()
        `,
        [
          session.id,
          session.complaintId,
          session.summary,
          session.status,
          JSON.stringify(session.outputLines),
          session.startedAt,
          session.completedAt,
        ],
      );
    } catch (error) {
      this.logger.warn(
        `Failed to persist vibe session ${sessionId}: ${(error as Error).message}`,
      );
    }
  }

  private async restoreRecentSessions(limit: number = 100): Promise<void> {
    try {
      interface VibeSessionRow {
        id: string;
        complaint_id: string;
        summary: string;
        status: string;
        output_lines: unknown;
        started_at: string | Date;
        completed_at: string | Date | null;
      }

      const result = await this.db.query<VibeSessionRow>(
        `
        SELECT
          id,
          complaint_id,
          summary,
          status,
          output_lines,
          started_at,
          completed_at
        FROM vibe_sessions
        ORDER BY started_at DESC
        LIMIT $1
        `,
        [limit],
      );

      for (const row of result.rows) {
        const session: InternalSession = {
          id: row.id,
          complaintId: row.complaint_id,
          summary: row.summary,
          status: this.parseStatus(row.status),
          outputLines: this.parseOutputLines(row.output_lines),
          startedAt: this.normalizeTimestamp(row.started_at),
          completedAt: row.completed_at ? this.normalizeTimestamp(row.completed_at) : null,
          lineBuffer: '',
          persistTimer: null,
        };
        this.sessions.set(session.id, session);
      }
    } catch (error) {
      this.logger.warn(
        `Skipping vibe session restore (table may be missing): ${(error as Error).message}`,
      );
    }
  }

  private parseStatus(value: string): VibeSession['status'] {
    if (value === 'running' || value === 'completed' || value === 'failed') {
      return value;
    }
    return 'running';
  }

  private parseOutputLines(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.filter((entry): entry is string => typeof entry === 'string');
    }

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.filter((entry): entry is string => typeof entry === 'string');
        }
      } catch {
        return [];
      }
    }

    return [];
  }

  private normalizeTimestamp(value: string | Date): string {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return new Date(value).toISOString();
  }
}
