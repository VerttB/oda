import { systemProcessor } from '../queue/systemProcessor';

describe('systemProcessor', () => {
  it('should export processor function', () => {
    expect(typeof systemProcessor).toBe('function');
  });

  it('should be async function', () => {
    expect(systemProcessor.constructor.name).toBe('AsyncFunction');
  });
});