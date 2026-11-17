import type { Queue } from 'bullmq';

/** O system-worker central apenas publica jobs; os arquivos ficam no servidor SIMCC. */
export async function registerSimccRepeatableSchedules(queue: Queue) {
  const options = { removeOnComplete: { age: 86400, count: 30 }, removeOnFail: false };
  await queue.add('enqueue-dgp-scraper', {
    version: 1, requestedAt: new Date().toISOString(), scope: 'simcc', limite: 300,
  }, {
    ...options, repeat: { pattern: '0 0 * * *', tz: 'America/Bahia' },
    jobId: 'enqueue-dgp-simcc-daily',
  });
  // Remove apenas o antigo horário SIMCC, caso tenha sido registrado.
  for (const schedule of await queue.getRepeatableJobs()) {
    if (schedule.name === 'enqueue-etl' && schedule.id === 'enqueue-etl-simcc-daily') {
      await queue.removeRepeatableByKey(schedule.key);
    }
  }
  await queue.add('verificar-etl-simcc', {
    version: 1,
  }, {
    ...options, repeat: { pattern: '* * * * *', tz: 'America/Bahia' },
    jobId: 'verificar-etl-simcc',
  });
}
