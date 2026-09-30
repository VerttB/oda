import { PrismaClient, prismaConfig } from '@oda/database';

export const prisma: PrismaClient = new PrismaClient(prismaConfig);
