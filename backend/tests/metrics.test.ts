import { describe, it, expect } from 'vitest';
import {
  ticketsTotal,
  ticketsResolvedTotal,
  ticketResolutionDuration,
  httpRequestsTotal,
  httpRequestDuration,
  register,
} from '../src/lib/metrics';

describe('Prometheus metrics module', () => {
  it('exports all custom counters and histograms', () => {
    expect(ticketsTotal).toBeDefined();
    expect(ticketsResolvedTotal).toBeDefined();
    expect(ticketResolutionDuration).toBeDefined();
    expect(httpRequestsTotal).toBeDefined();
    expect(httpRequestDuration).toBeDefined();
  });

  it('register.metrics() returns valid Prometheus text', async () => {
    const output = await register.metrics();
    expect(typeof output).toBe('string');
    expect(output).toContain('tickets_total');
    expect(output).toContain('tickets_resolved_total');
    expect(output).toContain('ticket_resolution_duration_seconds');
    expect(output).toContain('http_requests_total');
    expect(output).toContain('http_request_duration_seconds');
  });

  it('tickets_total increments correctly', async () => {
    const before = (await register.getSingleMetricAsString('tickets_total'));
    ticketsTotal.inc();
    const after = (await register.getSingleMetricAsString('tickets_total'));
    expect(after).not.toBe(before);
  });

  it('tickets_resolved_total increments correctly', async () => {
    ticketsResolvedTotal.inc();
    const output = await register.getSingleMetricAsString('tickets_resolved_total');
    expect(output).toContain('tickets_resolved_total');
  });

  it('ticket_resolution_duration_seconds observes values', async () => {
    ticketResolutionDuration.observe(120);
    ticketResolutionDuration.observe(3600);
    const output = await register.getSingleMetricAsString('ticket_resolution_duration_seconds');
    expect(output).toContain('ticket_resolution_duration_seconds_bucket');
    expect(output).toContain('ticket_resolution_duration_seconds_count');
    expect(output).toContain('ticket_resolution_duration_seconds_sum');
  });

  it('http_requests_total increments with labels', async () => {
    httpRequestsTotal.inc({ method: 'GET', route: '/test', status: '200' });
    const output = await register.getSingleMetricAsString('http_requests_total');
    expect(output).toContain('method="GET"');
    expect(output).toContain('route="/test"');
    expect(output).toContain('status="200"');
  });

  it('http_request_duration_seconds observes with labels', async () => {
    httpRequestDuration.observe({ method: 'POST', route: '/api/tickets', status: '201' }, 0.123);
    const output = await register.getSingleMetricAsString('http_request_duration_seconds');
    expect(output).toContain('method="POST"');
  });

  it('register content type is set for Prometheus', () => {
    expect(register.contentType).toContain('text/');
  });
});
