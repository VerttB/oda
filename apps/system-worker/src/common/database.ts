import { PrismaClient } from '@oda/database';
import { prismaConfig } from '@oda/database';

export const prisma: PrismaClient = new PrismaClient(prismaConfig);