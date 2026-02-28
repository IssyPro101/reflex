import { Injectable } from '@nestjs/common';
import { QueryResultRow } from 'pg';

import { AuthService } from '../auth/auth.service';
import { DbService } from '../db/db.service';

interface CountsRow extends QueryResultRow {
  messages_total: string | number;
  complaints_total: string | number;
  complaints_pending: string | number;
  complaints_manual: string | number;
  prs_open: string | number;
  prs_merged: string | number;
}

interface RecentComplaintRow extends QueryResultRow {
  id: string;
  summary: string;
  severity: string;
  status: string;
  intent: string;
  created_at: string;
  username: string;
  message_text: string;
  pr_url: string | null;
  pr_number: number | null;
  pr_status: string | null;
}

interface RecentPrRow extends QueryResultRow {
  id: string;
  repo: string;
  pr_number: number;
  pr_url: string;
  status: string;
  created_at: string;
  summary: string | null;
  severity: string | null;
}

@Injectable()
export class ObservabilityService {
  constructor(
    private readonly authService: AuthService,
    private readonly dbService: DbService,
  ) {}

  async getOverview(authorizationHeader: string | undefined, limit: number = 20) {
    await this.authService.requireSupabaseUser(authorizationHeader);

    const safeLimit = Number.isFinite(limit)
      ? Math.min(Math.max(limit, 1), 100)
      : 20;

    const countsResult = await this.dbService.query<CountsRow>(
      `
      SELECT
        (SELECT COUNT(*) FROM messages) AS messages_total,
        (SELECT COUNT(*) FROM complaints) AS complaints_total,
        (SELECT COUNT(*) FROM complaints WHERE status = 'pending') AS complaints_pending,
        (SELECT COUNT(*) FROM complaints WHERE status = 'needs_manual') AS complaints_manual,
        (SELECT COUNT(*) FROM prs WHERE status = 'open') AS prs_open,
        (SELECT COUNT(*) FROM prs WHERE status = 'merged') AS prs_merged
      `,
    );

    const recentComplaintsResult = await this.dbService.query<RecentComplaintRow>(
      `
      SELECT
        c.id,
        c.summary,
        c.severity,
        c.status,
        c.intent,
        c.created_at,
        m.username,
        m.message_text,
        p.pr_url,
        p.pr_number,
        p.status AS pr_status
      FROM complaints c
      JOIN messages m ON m.id = c.message_id
      LEFT JOIN prs p ON p.id = c.pr_id
      ORDER BY c.created_at DESC
      LIMIT $1
      `,
      [safeLimit],
    );

    const recentPrsResult = await this.dbService.query<RecentPrRow>(
      `
      SELECT
        p.id,
        p.repo,
        p.pr_number,
        p.pr_url,
        p.status,
        p.created_at,
        c.summary,
        c.severity
      FROM prs p
      LEFT JOIN complaints c ON c.id = p.complaint_id
      ORDER BY p.created_at DESC
      LIMIT $1
      `,
      [safeLimit],
    );

    const counts = countsResult.rows[0];

    return {
      counts: {
        messagesTotal: this.toNumber(counts?.messages_total),
        complaintsTotal: this.toNumber(counts?.complaints_total),
        complaintsPending: this.toNumber(counts?.complaints_pending),
        complaintsManual: this.toNumber(counts?.complaints_manual),
        prsOpen: this.toNumber(counts?.prs_open),
        prsMerged: this.toNumber(counts?.prs_merged),
      },
      recentComplaints: recentComplaintsResult.rows,
      recentPrs: recentPrsResult.rows,
      generatedAt: new Date().toISOString(),
    };
  }

  private toNumber(value: string | number | undefined): number {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      return Number.parseInt(value, 10) || 0;
    }

    return 0;
  }
}
