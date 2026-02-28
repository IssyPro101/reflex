import { Controller, Get, Headers, Query } from '@nestjs/common';

import { ObservabilityService } from './observability.service';

@Controller('observability')
export class ObservabilityController {
  constructor(private readonly observabilityService: ObservabilityService) {}

  @Get('overview')
  async overview(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Query('limit') limitQuery?: string,
  ): Promise<unknown> {
    const limit = limitQuery ? Number.parseInt(limitQuery, 10) : 20;
    return this.observabilityService.getOverview(authorizationHeader, limit);
  }
}
