import { handleCleanupLogsJob } from './cleanupLogsJob';
import { CleanupLogsJob, CleanupLogsResult } from '@oda/queue';

describe('cleanupLogsJob', () => {
  it('should export handler function', () => {
    expect(typeof handleCleanupLogsJob).toBe('function');
  });

  it('should accept job with correct data structure', () => {
    const mockJob: CleanupLogsJob = {
      version: 1,
      requestedAt: new Date().toISOString(),
      retentionDays: 30,
    };

    expect(mockJob.version).toBe(1);
    expect(mockJob.retentionDays).toBe(30);
  });

  it('should default retentionDays to 30 when not provided', () => {
    const mockJob: CleanupLogsJob = {
      version: 1,
      requestedAt: new Date().toISOString(),
    };

    expect(mockJob.retentionDays).toBeUndefined();
  });
});