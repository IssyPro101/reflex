import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';

import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('github/url')
  async githubUrl(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Query('next') next: string | undefined,
  ): Promise<{ url: string }> {
    const url = await this.authService.getGithubConnectUrl(authorizationHeader, next);
    return { url };
  }

  @Get('github/callback')
  async githubCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (!code || !state) {
      res.redirect(this.authService.getFrontendUrl('/?github=error'));
      return;
    }

    try {
      const result = await this.authService.completeGithubOAuth(code, state);
      const next = result.next && result.next.startsWith('/') ? result.next : '/';
      const suffix = next.includes('?') ? '&' : '?';
      res.redirect(this.authService.getFrontendUrl(`${next}${suffix}github=connected`));
    } catch {
      res.redirect(this.authService.getFrontendUrl('/?github=error'));
    }
  }

  @Get('me')
  async me(@Headers('authorization') authorizationHeader: string | undefined) {
    return this.authService.getMe(authorizationHeader);
  }

  @Get('github/repos')
  async repos(@Headers('authorization') authorizationHeader: string | undefined) {
    const repos = await this.authService.listRepos(authorizationHeader);
    return { repos };
  }

  @Post('github/disconnect')
  @HttpCode(HttpStatus.OK)
  async disconnectGithub(
    @Headers('authorization') authorizationHeader: string | undefined,
  ): Promise<{ disconnected: boolean }> {
    await this.authService.disconnectGithub(authorizationHeader);
    return { disconnected: true };
  }
}
