import { registerSimccRepeatableSchedules } from './simccRepeatableSchedule';

it('agenda SIMCC uma vez por dia no fuso da Bahia', async () => {
  const queue = { add: jest.fn().mockResolvedValue({}), getRepeatableJobs: jest.fn().mockResolvedValue([]) };
  await registerSimccRepeatableSchedules(queue as any);
  expect(queue.add).toHaveBeenCalledTimes(2);
  expect(queue.add).toHaveBeenCalledWith('enqueue-dgp-scraper',
    expect.objectContaining({ scope: 'simcc', limite: 300 }),
    expect.objectContaining({ repeat: { pattern: '0 0 * * *', tz: 'America/Bahia' }, jobId: 'enqueue-dgp-simcc-daily' }));
  expect(queue.add).toHaveBeenCalledWith('verificar-etl-simcc',
    expect.objectContaining({ version: 1 }),
    expect.objectContaining({ repeat: { pattern: '* * * * *', tz: 'America/Bahia' }, jobId: 'verificar-etl-simcc' }));
});
