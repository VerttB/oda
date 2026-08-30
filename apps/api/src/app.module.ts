import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { GruposPesquisaModule } from './resources/grupos-pesquisa/grupos-pesquisa.module';
import { InstituicaoModule } from './resources/instituicao/instituicao.module';
import { LangchainGatewayModule } from './resources/langchain/langchain.module';
import { LinhaPesquisaModule } from './resources/linha-pesquisa/linha-pesquisa.module';
import { PesquisadoresModule } from './resources/pesquisadores/pesquisadores.module';
import { ProducoesModule } from './resources/producoes/producoes.module';
import { CacheModule } from './cache/cache.module';
import { AreaConhecimentoModule } from './resources/area-conhecimento/area-conhecimento.module';
import { UfModule } from './resources/uf/uf.module';
import { AuthModule } from './resources/auth/auth.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { MetricasModule } from './resources/metricas/metricas.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    {
      module: PrismaModule,
      global: true,
    },
    CacheModule,
    AuthModule,
    GruposPesquisaModule,
    InstituicaoModule,
    LangchainGatewayModule,
    LinhaPesquisaModule,
    PesquisadoresModule,
    ProducoesModule,
    AreaConhecimentoModule,
    UfModule,
    MetricasModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // {
    //   provide: APP_GUARD,
    //   useClass: JwtAuthGuard,
    // },
  ],
})
export class AppModule {}
