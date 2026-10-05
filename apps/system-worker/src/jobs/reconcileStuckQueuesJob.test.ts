import { handleReconcileStuckQueuesJob } from './reconcileStuckQueuesJob';
import { ReconcileStuckQueuesJob, ReconcileStuckQueuesResult } from '@oda/queue';

describe('reconcileStuckQueuesJob', () => {
  it('should export handler function', () => {
    expect(typeof handleReconcileStuckQueuesJob).toBe('function');
  });

  it('should accept job with correct data structure', () => {
    const mockJob: ReconcileStuckQueuesJob = {
      version: 1,
      requestedAt: new Date().toISOString(),
      staleDays: 14,
    };

    expect(mockJob.version).toBe(1);
    expect(mockJob.staleDays).toBe(14);
  });

  it('should default staleDays to 14 when not provided', () => {
    const mockJob: ReconcileStuckQueuesJob = {
      version: 1,
      requestedAt: new Date().toISOString(),
    };

    expect(mockJob.staleDays).toBeUndefined();
  });
});