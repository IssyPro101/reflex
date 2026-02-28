import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';

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
}

@Injectable()
export class VibeSessionStore {
  private readonly sessions = new Map<string, InternalSession>();
  private readonly updates$ = new Subject<VibeSessionEvent>();

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
    };

    this.sessions.set(id, session);
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

    const buffered = session.lineBuffer + chunk;
    const parts = buffered.split('\n');

    // Last part may be incomplete — keep it in the buffer
    session.lineBuffer = parts.pop() ?? '';

    const completedLines = parts.filter((l) => l.trim().length > 0);
    if (completedLines.length === 0) return;

    session.outputLines.push(...completedLines);

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

    this.updates$.next({
      type: 'session_ended',
      sessionId,
      session: this.toPublic(session),
    });

    setTimeout(() => this.sessions.delete(sessionId), 5 * 60 * 1000);
  }

  getActiveSessions(): VibeSession[] {
    return Array.from(this.sessions.values()).map((s) => this.toPublic(s));
  }

  getSession(sessionId: string): VibeSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    return this.toPublic(session);
  }

  subscribe(): Observable<VibeSessionEvent> {
    return this.updates$.asObservable();
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
}
