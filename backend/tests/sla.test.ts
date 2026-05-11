import { describe, it, expect } from 'vitest';
import { calculateSlaDeadlines } from '../src/services/sla.service';

describe('calculateSlaDeadlines', () => {
  const base = new Date('2024-06-01T12:00:00Z');

  it('CRITICAL: response 2h, resolve 4h', () => {
    const result = calculateSlaDeadlines('CRITICAL', base);
    expect(result.slaDeadlineResponse.getTime()).toBe(base.getTime() + 2 * 3600_000);
    expect(result.slaDeadlineResolve.getTime()).toBe(base.getTime() + 4 * 3600_000);
  });

  it('HIGH: response 4h, resolve 8h', () => {
    const result = calculateSlaDeadlines('HIGH', base);
    expect(result.slaDeadlineResponse.getTime()).toBe(base.getTime() + 4 * 3600_000);
    expect(result.slaDeadlineResolve.getTime()).toBe(base.getTime() + 8 * 3600_000);
  });

  it('MEDIUM: response 8h, resolve 24h', () => {
    const result = calculateSlaDeadlines('MEDIUM', base);
    expect(result.slaDeadlineResponse.getTime()).toBe(base.getTime() + 8 * 3600_000);
    expect(result.slaDeadlineResolve.getTime()).toBe(base.getTime() + 24 * 3600_000);
  });

  it('LOW: response 24h, resolve 72h', () => {
    const result = calculateSlaDeadlines('LOW', base);
    expect(result.slaDeadlineResponse.getTime()).toBe(base.getTime() + 24 * 3600_000);
    expect(result.slaDeadlineResolve.getTime()).toBe(base.getTime() + 72 * 3600_000);
  });

  it('returns dates in the future relative to createdAt', () => {
    const now = new Date();
    const result = calculateSlaDeadlines('MEDIUM', now);
    expect(result.slaDeadlineResponse.getTime()).toBeGreaterThan(now.getTime());
    expect(result.slaDeadlineResolve.getTime()).toBeGreaterThan(now.getTime());
    expect(result.slaDeadlineResolve.getTime()).toBeGreaterThan(result.slaDeadlineResponse.getTime());
  });
});
