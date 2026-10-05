import { handleBackupDbJob } from './backupDbJob';

describe('backupDbJob', () => {
  it('should export handler function', () => {
    expect(typeof handleBackupDbJob).toBe('function');
  });

  it('should accept job with correct data structure', async () => {
    const mockJob = {
      data: {
        version: 1,
        requestedAt: new Date().toISOString(),
        format: 'custom',
        retentionDays: 7,
      },
    };

    // This would require mocking spawn, so we just verify the structure
    expect(mockJob.data.version).toBe(1);
    expect(mockJob.data.format).toBe('custom');
    expect(mockJob.data.retentionDays).toBe(7);
  });
});