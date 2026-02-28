import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';

import { AuthService } from './auth.service';
import {
  discordGuildLinkSchema,
  githubTargetSchema,
  telegramLinkSchema,
} from './auth.types';

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

  @Get('github/target')
  async githubTarget(
    @Headers('authorization') authorizationHeader: string | undefined,
  ): Promise<{ target: { repoUrl: string; baseBranch: string } | null }> {
    const target = await this.authService.getGithubTarget(authorizationHeader);
    return { target };
  }

  @Put('github/target')
  async setGithubTarget(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: unknown,
  ): Promise<{ target: { repoUrl: string; baseBranch: string } }> {
    const input = githubTargetSchema.parse(body);
    const target = await this.authService.setGithubTarget(authorizationHeader, input);
    return { target };
  }

  @Get('discord/guild-links')
  async listDiscordGuildLinks(
    @Headers('authorization') authorizationHeader: string | undefined,
  ): Promise<{ guildIds: string[] }> {
    const guildIds = await this.authService.listDiscordGuildLinks(authorizationHeader);
    return { guildIds };
  }

  @Post('discord/guild-link')
  @HttpCode(HttpStatus.OK)
  async linkDiscordGuild(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: unknown,
  ): Promise<{ linked: boolean }> {
    const input = discordGuildLinkSchema.parse(body);
    await this.authService.linkDiscordGuild(authorizationHeader, input.guildId);
    return { linked: true };
  }

  @Delete('discord/guild-link')
  @HttpCode(HttpStatus.OK)
  async unlinkDiscordGuild(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: unknown,
  ): Promise<{ unlinked: boolean }> {
    const input = discordGuildLinkSchema.parse(body);
    await this.authService.unlinkDiscordGuild(authorizationHeader, input.guildId);
    return { unlinked: true };
  }

  @Post('telegram/link')
  @HttpCode(HttpStatus.OK)
  async linkTelegram(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: unknown,
  ): Promise<{ linked: boolean }> {
    const input = telegramLinkSchema.parse(body);
    await this.authService.linkTelegram(authorizationHeader, input.telegramChatId);
    return { linked: true };
  }

  @Delete('telegram/link')
  @HttpCode(HttpStatus.OK)
  async unlinkTelegram(
    @Headers('authorization') authorizationHeader: string | undefined,
  ): Promise<{ unlinked: boolean }> {
    await this.authService.unlinkTelegram(authorizationHeader);
    return { unlinked: true };
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
