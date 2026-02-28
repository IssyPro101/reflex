import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { discordIngestSchema } from './ingestion.types';
import { IngestionService } from './ingestion.service';

@Controller('ingest')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post('discord')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestDiscord(@Body() body: unknown): Promise<{ messageId: string }> {
    const payload = discordIngestSchema.parse(body);
    return this.ingestionService.ingestDiscord(payload);
  }
}
