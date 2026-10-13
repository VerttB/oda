import { registerLattesRepeatableSchedule } from './lattesRepeatableSchedule';

describe('registerLattesRepeatableSchedule', () => {
  it('registers the 8-hour schedule and removes only the previous Lattes schedule', async () => {
    const queue = {
      add: jest.fn().mockResolvedValue(undefined),
      getRepeatableJobs: jest.fn().mockResolvedValue([
        { key: 'legacy-lattes', name: 'enqueue-lattes-scraper', pattern: '0 5,17 * * *', tz: 'America/Sao_Paulo' },
        { key: 'other-pattern', name: 'enqueue-lattes-scraper', pattern: '0 6 * * *', tz: 'America/Sao_Paulo' },
        { key: 'other-job', name: 'enqueue-dgp-scraper', pattern: '0 5,17 * * *', tz: 'America/Sao_Paulo' },
      ]),
      removeRepeatableByKey: jest.fn().mockResolvedValue(true),
    };

    await registerLattesRepeatableSchedule(queue as any, 'America/Sao_Paulo');

    expect(queue.add).toHaveBeenCalledWith('enqueue-lattes-scraper', expect.objectContaining({ version: 1 }), expect.objectContaining({
      repeat: { pattern: '0 5,13,21 * * *', tz: 'America/Sao_Paulo' },
      jobId: 'enqueue-lattes-scraper-8h',
    }));
    expect(queue.removeRepeatableByKey).toHaveBeenCalledTimes(1);
    expect(queue.removeRepeatableByKey).toHaveBeenCalledWith('legacy-lattes');
  });
});
