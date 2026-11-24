import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { prismaMock } from './setup';
import { isOriginAllowed } from '../src/lib/env';

describe('login rate limit', () => {
  it('returns 429 after too many failed logins from one IP', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const attempt = () =>
      request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '203.0.113.7')
        .send({ email: 'nobody@test.com', password: 'wrong' });

    for (let i = 0; i < 10; i++) {
      expect((await attempt()).status).toBe(401);
    }
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body).toHaveProperty('error');
  });

  it('does not limit a different IP', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '198.51.100.9')
      .send({ email: 'nobody@test.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });
});

describe('CORS origin policy', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    // Isolate from any local backend/.env loaded by dotenv.
    for (const key of ['CORS_ORIGIN', 'FRONTEND_URL', 'CLIENT_URL', 'EXTRA_CORS_ORIGINS']) delete process.env[key];
  });
  afterEach(() => { process.env = { ...saved }; });

  it('rejects localhost origins in production by default', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_LOCALHOST_ORIGINS;
    expect(isOriginAllowed('http://localhost:5173')).toBe(false);
  });

  it('allows localhost in production when explicitly opted in', () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_LOCALHOST_ORIGINS = 'true';
    expect(isOriginAllowed('http://localhost:7754')).toBe(true);
  });

  it('allows the configured frontend origin in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://aitudesk.vercel.app';
    expect(isOriginAllowed('https://aitudesk.vercel.app')).toBe(true);
    expect(isOriginAllowed('https://evil.example')).toBe(false);
  });

  it('allows localhost outside production', () => {
    process.env.NODE_ENV = 'development';
    expect(isOriginAllowed('http://localhost:5173')).toBe(true);
  });
});

describe('/metrics access', () => {
  const saved = process.env.METRICS_TOKEN;
  afterEach(() => { process.env.METRICS_TOKEN = saved; if (saved === undefined) delete process.env.METRICS_TOKEN; });

  it('requires the bearer token when METRICS_TOKEN is set', async () => {
    process.env.METRICS_TOKEN = 'test-metrics-token';
    expect((await request(app).get('/metrics')).status).toBe(401);
    const ok = await request(app).get('/metrics').set('Authorization', 'Bearer test-metrics-token');
    expect(ok.status).toBe(200);
  });
});
