import { Inject } from '@nestjs/common';

import { APP_CONFIG, AppConfig } from './app-config';

export const InjectAppConfig = () => Inject(APP_CONFIG);

export type { AppConfig };
