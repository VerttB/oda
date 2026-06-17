import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient, prismaConfig } from '@oda/database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly configService:ConfigService){
      super(prismaConfig)
  }
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
      await this.$disconnect();
  }
}