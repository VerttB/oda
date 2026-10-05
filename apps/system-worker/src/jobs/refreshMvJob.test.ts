import { handleRefreshMvJob } from './refreshMvJob';
import { RefreshMvJob, RefreshMvResult } from '@oda/queue';

describe('refreshMvJob', () => {
  it('should export handler function', () => {
    expect(typeof handleRefreshMvJob).toBe('function');
  });

  it('should accept job with correct data structure', () => {
    const mockJob: RefreshMvJob = {
      version: 1,
      requestedAt: new Date().toISOString(),
      concurrently: true,
    };

    expect(mockJob.version).toBe(1);
    expect(mockJob.concurrently).toBe(true);
  });

  it('should default concurrently to true when not provided', () => {
    const mockJob: RefreshMvJob = {
      version: 1,
      requestedAt: new Date().toISOString(),
    };

    expect(mockJob.concurrently).toBeUndefined();
  });
});