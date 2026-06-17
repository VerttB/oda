import { PrismaPg } from '@prisma/adapter-pg';
export * from '../generated/prisma';

export const prismaConfig = {
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
};