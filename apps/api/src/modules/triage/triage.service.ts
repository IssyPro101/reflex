import { Injectable, Logger } from '@nestjs/common';

import { InjectAppConfig } from '../config/get-config';
import { AppConfig } from '../config/app-config';
import { TriageResult, triageResultSchema } from './triage.types';

interface MistralResponse {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
}

@Injectable()
export class TriageService {
  private readonly logger = new Logger(TriageService.name);
  private mistralClient: unknown | null = null;

  constructor(@InjectAppConfig() private readonly config: AppConfig) {}

  async classify(text: string): Promise<TriageResult> {
    const prompt = this.buildPrompt(text);
    const raw = await this.complete(prompt);
    const parsed = this.parseResponse(raw);
    return triageResultSchema.parse(parsed);
  }

  private buildPrompt(text: string): string {
    return [
      'Classify this Discord message into one intent:',
      '- bug_report',
      '- feature_request',
      '- question',
      '- spam',
      '- harmful',
      '',
      'Return strict JSON with keys: intent, confidence (0-1), severity (low|medium|high), summary.',
      '',
      `Message: ${text}`,
    ].join('\n');
  }

  private async getClient(): Promise<any> {
    if (this.mistralClient) {
      return this.mistralClient;
    }

    const sdk = await import('@mistralai/mistralai');
    const MistralClient = (sdk as any).Mistral ?? (sdk as any).default;
    if (!MistralClient) {
      throw new Error('Mistral SDK client constructor not found');
    }

    this.mistralClient = new MistralClient({ apiKey: this.config.MISTRAL_API_KEY });
    return this.mistralClient;
  }

  private async complete(prompt: string): Promise<string> {
    const client = await this.getClient();

    try {
      const response = (await client.chat.complete({
        model: this.config.MISTRAL_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
      })) as MistralResponse;

      return this.extractText(response);
    } catch (error) {
      this.logger.error('Mistral triage call failed', error as Error);
      throw error;
    }
  }

  private extractText(response: MistralResponse): string {
    const content = response.choices?.[0]?.message?.content;

    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (typeof part === 'string') {
            return part;
          }
          if (typeof part === 'object' && part && 'text' in part) {
            const maybeText = (part as Record<string, unknown>).text;
            return typeof maybeText === 'string' ? maybeText : '';
          }
          return '';
        })
        .join('\n');
    }

    throw new Error('No text content in Mistral response');
  }

  parseResponse(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error('Triage response did not contain JSON');
      }
      return JSON.parse(match[0]);
    }
  }
}
