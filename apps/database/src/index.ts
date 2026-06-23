import { PrismaPg } from '@prisma/adapter-pg';
export * from '../generated/prisma/index.js';
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

function loadEnv() {
  if (process.env.DATABASE_URL) {
    return;
  }
  let currentDir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const envPath = path.resolve(currentDir, '.env');
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      return;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }
}

loadEnv();


export const prismaConfig = {
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
};