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
  const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
  if (Number.isInteger(trustProxyHops) && trustProxyHops >= 0) {
    app.set('trust proxy', trustProxyHops);
  }
  app.enableCors({
    origin: '*',
    exposedHeaders: ['Retry-After', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
  });
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

  const publicAiPaths = new Set(['/langchain/generate', '/langchain/summarize']);
  const publicPostPaths = new Set(['/auth/login', ...publicAiPaths]);
  const semanticSearchPaths = new Set([
    '/grupos-pesquisa/busca-semantica',
    '/grupos-pesquisa',
    '/grupos-pesquisa/simcc',
    '/grupos-pesquisa/{id}/pesquisadores',
    '/pesquisadores/busca-semantica',
    '/pesquisadores',
    '/pesquisadores/{id}/producoes',
    '/linha-pesquisa/busca-semantica',
    '/linha-pesquisa',
    '/producoes/busca-semantica',
    '/producoes',
  ]);

  if (isProduction()) {
    if (document.paths) {
      Object.keys(document.paths).forEach((pathKey) => {
        if (pathKey.startsWith('/admin/filas')) {
          delete document.paths[pathKey];
        } else {
          const pathItem = document.paths[pathKey];
          Object.keys(pathItem).forEach((method) => {
            const isPublicPost = method === 'post' && publicPostPaths.has(pathKey);
            if (method !== 'get' && method !== 'parameters' && !isPublicPost) {
              delete pathItem[method];
            }
          });
        }
      });
    }
    if (document.tags) {
      document.tags = document.tags.filter((tag) => tag.name !== 'admin-filas');
    }
  }

  if (document.paths) {
    Object.entries(document.paths).forEach(([pathKey, pathItem]) => {
      Object.entries(pathItem).forEach(([method, operation]) => {
        if (!operation || typeof operation !== 'object' || method === 'parameters') return;
        const isPublicPost = method === 'post' && publicPostPaths.has(pathKey);
        const isLogin = pathKey === '/auth/login' && method === 'post';
        const supportsOptionalAiAuth = publicAiPaths.has(pathKey)
          || (method === 'get' && semanticSearchPaths.has(pathKey));
        const requiresJwt = pathKey.startsWith('/admin/filas')
          || (['post', 'patch', 'put', 'delete'].includes(method) && !isPublicPost);

        if (requiresJwt) {
          (operation as any).security = [{ bearer: [] }];
        } else if (supportsOptionalAiAuth) {
          (operation as any).security = [{ bearer: [] }, {}];
        } else if (isLogin) {
          delete (operation as any).security;
        }
      });
    });
  }

  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
