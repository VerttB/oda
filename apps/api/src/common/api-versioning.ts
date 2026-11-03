import { INestApplication, VersioningType } from '@nestjs/common';

export const API_VERSION = '1';
export const API_VERSION_PATH = `/v${API_VERSION}`;

export function configureApiVersioning(app: INestApplication) {
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: API_VERSION,
  });
}
