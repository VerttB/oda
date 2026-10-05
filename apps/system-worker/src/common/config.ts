import * as dotenv from 'dotenv';

dotenv.config({ path: '../../../.env' });

export const SYSTEM_WORKER_CONFIG = {
  nodeEnv: process.env['NODE_ENV'] || 'development',
  timezone: process.env['TZ'] || 'America/Sao_Paulo',
} as const;