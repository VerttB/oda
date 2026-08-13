import { PrismaPg } from '@prisma/adapter-pg';
export * from '../generated/prisma';
export * from './pipelineLogger';
import path from "path";
import dotenv from "dotenv";

dotenv.config({
  path: path.resolve(__dirname, '../../../.env'),
});

export const prismaConfig = {
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
};