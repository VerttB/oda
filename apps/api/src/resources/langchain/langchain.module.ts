import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { LANGCHAIN_SERVICE } from './langchain.contracts';
import { LangchainController } from './langchain.controller';
import { LangchainGatewayService } from './langchain.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: LANGCHAIN_SERVICE,
        transport: Transport.TCP,
        options: {
          host: process.env.LANGCHAIN_HOST ?? '127.0.0.1',
          port: Number(process.env.LANGCHAIN_PORT ?? 8877),
        },
      },
    ]),
  ],
  controllers: [LangchainController],
  providers: [LangchainGatewayService],
})
export class LangchainGatewayModule {}
