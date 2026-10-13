import type { Queue } from 'bullmq';

const JOB_NAME = 'enqueue-lattes-scraper';
const LEGACY_PATTERN = '0 5,17 * * *';
const CURRENT_PATTERN = '0 5,13,21 * * *';

export async function registerLattesRepeatableSchedule(queue: Queue, timezone: string) {
  await queue.add(JOB_NAME, {
    version: 1,
    requestedAt: new Date().toISOString(),
  }, {
    repeat: { pattern: CURRENT_PATTERN, tz: timezone },
    jobId: 'enqueue-lattes-scraper-8h',
    removeOnComplete: { age: 12 * 60 * 60, count: 100 },
    removeOnFail: false,
  });

  const schedules = await queue.getRepeatableJobs();
  const legacySchedules = schedules.filter(schedule =>
    schedule.name === JOB_NAME
    && schedule.pattern === LEGACY_PATTERN
    && schedule.tz === timezone,
  );

  await Promise.all(legacySchedules.map(schedule => queue.removeRepeatableByKey(schedule.key)));
}
