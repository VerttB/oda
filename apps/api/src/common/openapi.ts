import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OperationObject } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { API_VERSION_PATH } from './api-versioning';

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
const httpMethods = new Set([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
  'trace',
]);

export function createApiDocument(
  app: INestApplication,
  production = false,
  publicServerUrl = '/',
) {
  const config = new DocumentBuilder()
    .setTitle('Open DGP API')
    .setDescription('API v1 para coleta e busca semântica de dados do DGP/CNPq')
    .setVersion('1.0')
    .addServer(publicServerUrl.trim().replace(/\/+$/, '') || '/')
    .addBearerAuth();
  for (const tag of [
    'grupos-pesquisa',
    'pesquisadores',
    'linha-pesquisa',
    'instituicao',
    'area-conhecimento',
    'producoes',
    'uf',
    'auth',
    'metricas',
    'langchain',
    'admin-filas',
  ])
    config.addTag(tag);

  const document = SwaggerModule.createDocument(app, config.build(), {
    deepScanRoutes: true,
  });
  for (const [path, item] of Object.entries(document.paths)) {
    // As políticas são definidas pelo recurso, independentemente do prefixo de versão.
    const resource =
      path === API_VERSION_PATH
        ? '/'
        : path.startsWith(`${API_VERSION_PATH}/`)
          ? path.slice(API_VERSION_PATH.length)
          : path;
    const administrative = resource.startsWith('/admin/filas');
    if (production && administrative) {
      delete document.paths[path];
      continue;
    }
    for (const [method, value] of Object.entries(item)) {
      if (!httpMethods.has(method) || !value || typeof value !== 'object')
        continue;
      const publicPost = method === 'post' && publicPostPaths.has(resource);
      if (production && method !== 'get' && !publicPost) {
        delete item[method];
        continue;
      }
      const operation = value as OperationObject;
      const requiresJwt =
        administrative ||
        (['post', 'patch', 'put', 'delete'].includes(method) && !publicPost);
      const optionalAiAuth =
        publicAiPaths.has(resource) ||
        (method === 'get' && semanticSearchPaths.has(resource));
      if (requiresJwt) operation.security = [{ bearer: [] }];
      else if (optionalAiAuth) operation.security = [{ bearer: [] }, {}];
      else if (resource === '/auth/login' && method === 'post')
        delete operation.security;
    }
  }
  if (production)
    document.tags = document.tags?.filter((tag) => tag.name !== 'admin-filas');
  return cleanupOpenApiDoc(document);
}
