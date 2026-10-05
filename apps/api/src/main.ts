import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './filters/prisma.exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

const isProduction = (): boolean => process.env.NODE_ENV === 'production';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'verbose'],
  });
  app.enableCors({ origin: '*' });
  app.useStaticAssets(join(process.cwd(), 'static'), {
    prefix: '/static/',
  });
  app.useGlobalFilters(new PrismaExceptionFilter());


  const config = new DocumentBuilder()
    .setTitle('Open DGP API')
    .setDescription('API para coleta e busca semântica de dados do DGP/CNPq')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('grupos-pesquisa')
    .addTag('pesquisadores')
    .addTag('linha-pesquisa')
    .addTag('instituicao')
    .addTag('area-conhecimento')
    .addTag('producoes')
    .addTag('uf')
    .addTag('auth')
    .addTag('metricas')
    .addTag('langchain')
    .addTag('admin-filas')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
  });

  if (isProduction()) {
    if (document.paths) {
      Object.keys(document.paths).forEach((pathKey) => {
        if (pathKey.startsWith('/admin/filas') || pathKey.startsWith('/auth')) {
          delete document.paths[pathKey];
        } else {
          const pathItem = document.paths[pathKey];
          Object.keys(pathItem).forEach((method) => {
            if (method !== 'get' && method !== 'parameters') {
              delete pathItem[method];
            }
          });
        }
      });
    }
    if (document.tags) {
      document.tags = document.tags.filter((tag) => tag.name !== 'admin-filas' && tag.name !== 'auth');
    }
  }

  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
