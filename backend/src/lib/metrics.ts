import client from 'prom-client';

// Collect default Node.js metrics (CPU, memory, event loop, etc.)
client.collectDefaultMetrics({ prefix: 'aitudesk_' });

// ── Custom Metrics ────────────────────────────────────────────────────────

export const ticketsTotal = new client.Counter({
  name: 'tickets_total',
  help: 'Total number of created tickets',
});

export const ticketsResolvedTotal = new client.Counter({
  name: 'tickets_resolved_total',
  help: 'Total number of resolved tickets',
});

export const ticketResolutionDuration = new client.Histogram({
  name: 'ticket_resolution_duration_seconds',
  help: 'Time to resolve a ticket in seconds',
  buckets: [60, 300, 900, 1800, 3600, 7200, 14400, 28800, 86400, 259200],
});

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'] as const,
});

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});

export const register = client.register;
