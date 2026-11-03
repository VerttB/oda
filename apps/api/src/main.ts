import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './filters/prisma.exception.filter';
import { SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { configureApiVersioning } from './common/api-versioning';
import { createApiDocument } from './common/openapi';

const isProduction = (): boolean => process.env.NODE_ENV === 'production';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'verbose'],
  });
  configureApiVersioning(app);
  const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
  if (Number.isInteger(trustProxyHops) && trustProxyHops >= 0) {
    app.set('trust proxy', trustProxyHops);
  }
  app.enableCors({
    origin: '*',
    exposedHeaders: [
      'Retry-After',
      'RateLimit-Limit',
      'RateLimit-Remaining',
      'RateLimit-Reset',
    ],
  });
  app.useStaticAssets(join(process.cwd(), 'static'), {
    prefix: '/static/',
  });
  app.useGlobalFilters(new PrismaExceptionFilter());
  SwaggerModule.setup('api', app, createApiDocument(app, isProduction()));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
