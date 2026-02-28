import { Controller, Get, Headers, Query, Sse, MessageEvent } from '@nestjs/common';
import { Observable, map, startWith } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { VibeSessionStore, VibeSession } from './vibe-session.store';

@Controller('vibe')
export class VibeController {
  constructor(
    private readonly sessionStore: VibeSessionStore,
    private readonly authService: AuthService,
  ) {}

  @Get('sessions')
  async getSessions(
    @Headers('authorization') authorizationHeader: string | undefined,
  ): Promise<{ sessions: VibeSession[] }> {
    await this.authService.requireSupabaseUser(authorizationHeader);
    return { sessions: this.sessionStore.getActiveSessions() };
  }

  @Sse('sessions/stream')
  streamSessions(
    @Query('token') token?: string,
  ): Observable<MessageEvent> {
    const authHeader = token ? `Bearer ${token}` : undefined;
    void this.authService.requireSupabaseUser(authHeader);

    const initial: MessageEvent = {
      data: JSON.stringify({
        type: 'snapshot',
        sessions: this.sessionStore.getActiveSessions(),
      }),
      type: 'snapshot',
    };

    return this.sessionStore.subscribe().pipe(
      map((event) => ({
        data: JSON.stringify(event),
        type: event.type,
        id: event.sessionId,
      })),
      startWith(initial),
    );
  }
}
