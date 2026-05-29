import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { GruposPesquisaModule } from './resources/grupos-pesquisa/grupos-pesquisa.module';
import { InstituicaoModule } from './resources/instituicao/instituicao.module';
import { LangchainGatewayModule } from './resources/langchain/langchain.module';
import { LinhaPesquisaModule } from './resources/linha-pesquisa/linha-pesquisa.module';
import { PesquisadoresModule } from './resources/pesquisadores/pesquisadores.module';
import { ProducoesModule } from './resources/producoes/producoes.module';
import { CacheModule } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    {
      module: PrismaModule,
      global: true,
    },
    CacheModule.registerAsync({
      useFactory: async (configService: ConfigService) => ({
        stores: [
          createKeyv(
            `${configService.getOrThrow<string>('REDIS_URL')}:${configService.getOrThrow<string>('REDIS_PORT')} `,
          ),
        ],
        ttl: 60 * 1000,
      }),
      isGlobal: true,
    }),
    GruposPesquisaModule,
    InstituicaoModule,
    LangchainGatewayModule,
    LinhaPesquisaModule,
    PesquisadoresModule,
    ProducoesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
