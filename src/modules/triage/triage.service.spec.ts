import { TriageService } from './triage.service';
import { triageResultSchema } from './triage.types';
import { makeAppConfig } from '../../../test/support/app-config';

describe('TriageService parseResponse', () => {
  const service = new TriageService(makeAppConfig());

  it('parses strict JSON output', () => {
    const parsed = service.parseResponse(
      JSON.stringify({
        intent: 'bug_report',
        confidence: 0.91,
        severity: 'high',
        summary: 'Export crashes on iOS',
      }),
    );

    expect(triageResultSchema.parse(parsed).intent).toBe('bug_report');
  });

  it('parses JSON embedded in text', () => {
    const parsed = service.parseResponse(
      'Result:\n{\n"intent":"question","confidence":0.55,"severity":"low","summary":"How to export?"\n}\n',
    );

    expect(triageResultSchema.parse(parsed).intent).toBe('question');
  });

  it('throws when no JSON is present', () => {
    expect(() => service.parseResponse('not json')).toThrow(
      'Triage response did not contain JSON',
    );
  });
});
